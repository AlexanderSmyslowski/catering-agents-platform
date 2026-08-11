import {
  createBusinessScopedPersistentCollection,
  withBusinessTargetCriticalSection,
  validateApprovalRequestRecord,
  validateApprovedProductionSpec,
  validateProductionDraft,
  type ApprovedProductionSpec,
  type ApprovalRequestRecord,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type ProductionDraft
} from "@catering/shared-core";
import {
  validateProductionDecisionAggregate,
  type ProductionDecisionAggregate
} from "../production-decision-aggregate.js";

const decisionRepositories = new WeakMap<object, InternalProductionDecisionRepository>();

export interface ProductionDecisionCollections {
  drafts: BusinessScopedPersistentCollection<ProductionDraft>;
  decisionAggregates: BusinessScopedPersistentCollection<ProductionDecisionAggregate>;
  approvals: BusinessScopedPersistentCollection<ApprovalRequestRecord>;
  approvedProductionSpecs: BusinessScopedPersistentCollection<ApprovedProductionSpec>;
}

export interface ProductionDecisionTargetScope {
  getDraft: (draftId: string) => Promise<ProductionDraft | undefined>;
  setDraft: (draft: ProductionDraft) => Promise<void>;
  insertDraft: (draft: ProductionDraft) => Promise<"created" | "exists">;
  insertDecisionAggregate: (aggregate: ProductionDecisionAggregate) => Promise<"created" | "exists">;
  getDecisionAggregate: (approvalRequestId: string) => Promise<ProductionDecisionAggregate | undefined>;
  getApproval: (approvalRequestId: string) => Promise<ApprovalRequestRecord | undefined>;
  listApprovalsForTarget: () => Promise<ApprovalRequestRecord[]>;
  insertApproval: (approval: ApprovalRequestRecord) => Promise<"created" | "exists">;
  getApprovedProductionSpec: (id: string) => Promise<ApprovedProductionSpec | undefined>;
  insertApprovedProductionSpec: (spec: ApprovedProductionSpec) => Promise<"created" | "exists">;
}

export interface ProductionDecisionRepository {
  insertDecisionAggregate: (
    context: BusinessContext,
    aggregate: ProductionDecisionAggregate
  ) => Promise<"created" | "exists">;
  getDecisionAggregate: (
    context: BusinessContext,
    approvalRequestId: string
  ) => Promise<ProductionDecisionAggregate | undefined>;
  listDecisionAggregatesForDraft: (
    context: BusinessContext,
    draftId: string
  ) => Promise<ProductionDecisionAggregate[]>;
  withTargetCriticalSection: <T>(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"],
    operation: (scope: ProductionDecisionTargetScope) => Promise<T>
  ) => Promise<T>;
}

export function createProductionDecisionCollections(
  options: CollectionStorageOptions
): ProductionDecisionCollections {
  const storage = {
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  };
  return {
    drafts: createBusinessScopedPersistentCollection({
      collectionName: "production/drafts",
      getId: (draft: ProductionDraft) => draft.draftId,
      getVersion: (draft: ProductionDraft) => draft.revision,
      validate: validateProductionDraft,
      ...storage
    }),
    decisionAggregates: createBusinessScopedPersistentCollection({
      collectionName: "production/decision-aggregates",
      getId: (aggregate: ProductionDecisionAggregate) => aggregate.approval.approvalRequestId,
      validate: validateProductionDecisionAggregate,
      ...storage
    }),
    approvals: createBusinessScopedPersistentCollection({
      collectionName: "production/approvals",
      getId: (approval: ApprovalRequestRecord) => approval.approvalRequestId,
      validate: validateApprovalRequestRecord,
      ...storage
    }),
    approvedProductionSpecs: createBusinessScopedPersistentCollection({
      collectionName: "production/approved-specs",
      getId: (spec: ApprovedProductionSpec) => spec.approvedProductionSpecId,
      validate: validateApprovedProductionSpec,
      ...storage
    })
  };
}

class InternalProductionDecisionRepository implements ProductionDecisionRepository {
  constructor(
    private readonly options: CollectionStorageOptions,
    private readonly collections: ProductionDecisionCollections
  ) {}

  async insertDecisionAggregate(context: BusinessContext, aggregate: ProductionDecisionAggregate) {
    return this.collections.decisionAggregates.insert(context, aggregate);
  }

  async getDecisionAggregate(context: BusinessContext, approvalRequestId: string) {
    return this.collections.decisionAggregates.get(context, approvalRequestId);
  }

  async listDecisionAggregatesForDraft(context: BusinessContext, draftId: string) {
    return (await this.collections.decisionAggregates.list(context)).filter(
      (aggregate) => aggregate.approval.target.artifactId === draftId
    );
  }

  async withTargetCriticalSection<T>(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"],
    operation: (scope: ProductionDecisionTargetScope) => Promise<T>
  ): Promise<T> {
    return withBusinessTargetCriticalSection({
      storage: this.options,
      context,
      // Revision remains part of the evidence scope below, while every revision of one draft ID shares one lock.
      target: { ...target, revision: 0 },
      // During the Stage-A protocol transition, new writers also honor the revision-specific key used by
      // the previous build. The supported local launcher still requires all old writers to be quiescent.
      compatibilityTargets: [target],
      collectionNamespace: "production",
      queueFullMessage: "Die Produktionsentscheidungs-Warteschlange benötigt eine betriebliche Bereinigung.",
      timeoutMessage: "Die zielbezogene Produktionsentscheidung konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Die alte zielbezogene Produktionsentscheidung konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Produktionsentscheidungen benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: (transactionalQueryable) => {
        const collections = transactionalQueryable
          ? createProductionDecisionCollections({ pgPool: transactionalQueryable })
          : this.collections;
        return operation(this.scopeFor(collections, context, target));
      }
    });
  }

  private scopeFor(
    collections: ProductionDecisionCollections,
    context: BusinessContext,
    target: ApprovalRequestRecord["target"]
  ): ProductionDecisionTargetScope {
    return {
      getDraft: (draftId) => collections.drafts.get(context, draftId),
      setDraft: (draft) => collections.drafts.set(context, draft),
      insertDraft: (draft) => collections.drafts.insert(context, draft),
      insertDecisionAggregate: (aggregate) => collections.decisionAggregates.insert(context, aggregate),
      getDecisionAggregate: (approvalRequestId) => collections.decisionAggregates.get(context, approvalRequestId),
      getApproval: (approvalRequestId) => collections.approvals.get(context, approvalRequestId),
      listApprovalsForTarget: async () => (await collections.approvals.list(context)).filter(
        (approval) => approval.target.kind === target.kind &&
          approval.target.artifactId === target.artifactId &&
          approval.target.revision === target.revision
      ),
      insertApproval: (approval) => collections.approvals.insert(context, approval),
      getApprovedProductionSpec: (id) => collections.approvedProductionSpecs.get(context, id),
      insertApprovedProductionSpec: (spec) => collections.approvedProductionSpecs.insert(context, spec)
    };
  }

}

export function registerProductionDecisionRepository(
  owner: object,
  options: CollectionStorageOptions,
  collections: ProductionDecisionCollections
): void {
  decisionRepositories.set(owner, new InternalProductionDecisionRepository(options, collections));
}

export function productionDecisionRepositoryFor(owner: object): ProductionDecisionRepository {
  const repository = decisionRepositories.get(owner);
  if (!repository) throw new Error("ProductionStore wurde nicht regulär initialisiert.");
  return repository;
}
