import {
  createBusinessScopedPersistentCollection,
  areJsonValuesEqual,
  withBusinessTargetCriticalSection,
  type ApprovalRequestRecord,
  type ApprovedOffer,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type OfferDraft,
  type ProductionHandoff,
  validateApprovalRequestRecord,
  validateApprovedOffer,
  validateOfferDraft,
  validateProductionHandoff
} from "@catering/shared-core";
import {
  validateOfferDecisionAggregate,
  type OfferDecisionAggregate
} from "./offer-decision-aggregate.js";

const decisionRepositories = new WeakMap<OfferStore, InternalOfferDecisionRepository>();

interface OfferDecisionCollections {
  drafts: BusinessScopedPersistentCollection<OfferDraft>;
  decisionAggregates: BusinessScopedPersistentCollection<OfferDecisionAggregate>;
  approvals: BusinessScopedPersistentCollection<ApprovalRequestRecord>;
  approvedOffers: BusinessScopedPersistentCollection<ApprovedOffer>;
}

export interface OfferDecisionTargetScope {
  getDraft: (draftId: string) => Promise<OfferDraft | undefined>;
  insertDecisionAggregate: (aggregate: OfferDecisionAggregate) => Promise<"created" | "exists">;
  getDecisionAggregate: (approvalRequestId: string) => Promise<OfferDecisionAggregate | undefined>;
  getApproval: (approvalRequestId: string) => Promise<ApprovalRequestRecord | undefined>;
  listApprovalsForTarget: () => Promise<ApprovalRequestRecord[]>;
  getApprovedOffer: (approvedOfferId: string) => Promise<ApprovedOffer | undefined>;
  insertApproval: (approval: ApprovalRequestRecord) => Promise<"created" | "exists">;
  insertApprovedOffer: (offer: ApprovedOffer) => Promise<"created" | "exists">;
}

export interface OfferDecisionRepository {
  insertDecisionAggregate: (context: BusinessContext, aggregate: OfferDecisionAggregate) => Promise<"created" | "exists">;
  getDecisionAggregate: (context: BusinessContext, approvalRequestId: string) => Promise<OfferDecisionAggregate | undefined>;
  listDecisionAggregatesForApprovedOffer: (context: BusinessContext, approvedOfferId: string) => Promise<OfferDecisionAggregate[]>;
  withTargetCriticalSection: <T>(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"],
    operation: (scope: OfferDecisionTargetScope) => Promise<T>
  ) => Promise<T>;
}

function createOfferDecisionCollections(options: CollectionStorageOptions): OfferDecisionCollections {
  const storage = { rootDir: options.rootDir, databaseUrl: options.databaseUrl, pgPool: options.pgPool };
  return {
    drafts: createBusinessScopedPersistentCollection({ collectionName: "offers/drafts", getId: (draft: OfferDraft) => draft.draftId, getVersion: (draft: OfferDraft) => draft.revision, validate: validateOfferDraft, ...storage }),
    decisionAggregates: createBusinessScopedPersistentCollection({ collectionName: "offers/decision-aggregates", getId: (aggregate: OfferDecisionAggregate) => aggregate.approval.approvalRequestId, validate: validateOfferDecisionAggregate, ...storage }),
    approvals: createBusinessScopedPersistentCollection({ collectionName: "offers/approvals", getId: (approval: ApprovalRequestRecord) => approval.approvalRequestId, validate: validateApprovalRequestRecord, ...storage }),
    approvedOffers: createBusinessScopedPersistentCollection({ collectionName: "offers/approved", getId: (offer: ApprovedOffer) => offer.approvedOfferId, validate: validateApprovedOffer, ...storage })
  };
}

class InternalOfferDecisionRepository implements OfferDecisionRepository {
  constructor(
    private readonly owner: OfferStore,
    private readonly options: CollectionStorageOptions,
    private readonly collections: OfferDecisionCollections
  ) {}

  async insertDecisionAggregate(context: BusinessContext, aggregate: OfferDecisionAggregate): Promise<"created" | "exists"> {
    return this.collections.decisionAggregates.insert(context, aggregate);
  }

  async getDecisionAggregate(context: BusinessContext, approvalRequestId: string): Promise<OfferDecisionAggregate | undefined> {
    return this.collections.decisionAggregates.get(context, approvalRequestId);
  }

  async listDecisionAggregatesForApprovedOffer(context: BusinessContext, approvedOfferId: string): Promise<OfferDecisionAggregate[]> {
    return (await this.collections.decisionAggregates.list(context)).filter(
      (aggregate) => aggregate.approvedOffer?.approvedOfferId === approvedOfferId
    );
  }

  async withTargetCriticalSection<T>(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"],
    operation: (scope: OfferDecisionTargetScope) => Promise<T>
  ): Promise<T> {
    return withBusinessTargetCriticalSection({
      storage: this.options,
      context,
      target,
      collectionNamespace: "offers",
      queueFullMessage: "Die Dateisperren-Warteschlange benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Dateisperren-Warteschlange ist ausgeschöpft.",
      timeoutMessage: "Die zielbezogene Angebotsentscheidung konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Die alte zielbezogene Angebotsentscheidung konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Angebotsentscheidungen benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: (transactionalQueryable) => {
        if (!transactionalQueryable) return operation(this.scopeForOwner(context, target));
        const transactionalCollections = createOfferDecisionCollections({
          rootDir: this.options.rootDir,
          pgPool: transactionalQueryable
        });
        return operation(this.scopeForCollections(transactionalCollections, context, target));
      }
    });
  }

  private scopeForOwner(context: BusinessContext, target: ApprovalRequestRecord["target"]): OfferDecisionTargetScope {
    return {
      getDraft: (draftId) => this.owner.getDraft(context, draftId),
      insertDecisionAggregate: (aggregate) => this.insertDecisionAggregate(context, aggregate),
      getDecisionAggregate: (approvalRequestId) => this.getDecisionAggregate(context, approvalRequestId),
      getApproval: (approvalRequestId) => this.owner.getApproval(context, approvalRequestId),
      listApprovalsForTarget: () => this.owner.listApprovalsForTarget(context, target),
      getApprovedOffer: (approvedOfferId) => this.owner.getApprovedOffer(context, approvedOfferId),
      insertApproval: (approval) => this.collections.approvals.insert(context, approval),
      insertApprovedOffer: (offer) => this.collections.approvedOffers.insert(context, offer)
    };
  }

  private scopeForCollections(
    collections: OfferDecisionCollections,
    context: BusinessContext,
    target: ApprovalRequestRecord["target"]
  ): OfferDecisionTargetScope {
    return {
      getDraft: (draftId) => collections.drafts.get(context, draftId),
      insertDecisionAggregate: (aggregate) => collections.decisionAggregates.insert(context, aggregate),
      getDecisionAggregate: (approvalRequestId) => collections.decisionAggregates.get(context, approvalRequestId),
      getApproval: (approvalRequestId) => collections.approvals.get(context, approvalRequestId),
      listApprovalsForTarget: async () => (await collections.approvals.list(context)).filter(
        (approval) => approval.target.kind === target.kind
          && approval.target.artifactId === target.artifactId
          && approval.target.revision === target.revision
      ),
      getApprovedOffer: (approvedOfferId) => collections.approvedOffers.get(context, approvedOfferId),
      insertApproval: (approval) => collections.approvals.insert(context, approval),
      insertApprovedOffer: (offer) => collections.approvedOffers.insert(context, offer)
    };
  }

}

export function offerDecisionRepositoryFor(store: OfferStore): OfferDecisionRepository {
  const repository = decisionRepositories.get(store);
  if (!repository) throw new Error("OfferStore wurde nicht regulär initialisiert.");
  return repository;
}

export class OfferStore {
  private readonly drafts: BusinessScopedPersistentCollection<OfferDraft>;
  private readonly approvals: BusinessScopedPersistentCollection<ApprovalRequestRecord>;
  private readonly approvedOffers: BusinessScopedPersistentCollection<ApprovedOffer>;
  private readonly handoffs: BusinessScopedPersistentCollection<ProductionHandoff>;

  readonly storageOptions?: CollectionStorageOptions;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options;
    const storage = { rootDir: options?.rootDir, databaseUrl: options?.databaseUrl, pgPool: options?.pgPool };
    const decisionCollections = createOfferDecisionCollections(storage);
    this.drafts = decisionCollections.drafts;
    // This insert-only record is authoritative; Approval and ApprovedOffer stay repairable read projections.
    this.approvals = decisionCollections.approvals;
    this.approvedOffers = decisionCollections.approvedOffers;
    this.handoffs = createBusinessScopedPersistentCollection({ collectionName: "offers/handoffs", getId: (handoff: ProductionHandoff) => handoff.handoffId, validate: validateProductionHandoff, ...storage });
    decisionRepositories.set(this, new InternalOfferDecisionRepository(this, storage, decisionCollections));
  }

  async saveDraft(context: BusinessContext, draft: OfferDraft): Promise<void> {
    if (await this.drafts.insert(context, draft) === "created") return;

    for (;;) {
      const existing = await this.drafts.get(context, draft.draftId);
      if (!existing) {
        if (await this.drafts.insert(context, draft) === "created") return;
        continue;
      }
      if (existing.revision === draft.revision) {
        if (areJsonValuesEqual(existing, draft)) return;
        throw new Error("Eine Angebotsrevision darf nicht nachträglich verändert werden.");
      }
      if (draft.revision < existing.revision) {
        throw new Error("Eine Angebotsrevision darf nicht nachträglich verändert werden.");
      }
      const updated = await this.drafts.compareAndSet(context, draft.draftId, existing.revision, draft);
      if (updated === "updated") return;
    }
  }
  async getDraft(context: BusinessContext, draftId: string): Promise<OfferDraft | undefined> { return this.drafts.get(context, draftId); }
  async listDrafts(context: BusinessContext): Promise<OfferDraft[]> { return this.drafts.list(context); }
  async insertApproval(context: BusinessContext, record: ApprovalRequestRecord): Promise<"created" | "exists"> {
    return offerDecisionRepositoryFor(this).withTargetCriticalSection(
      context,
      record.target,
      (scope) => scope.insertApproval(record)
    );
  }
  async getApproval(context: BusinessContext, approvalRequestId: string): Promise<ApprovalRequestRecord | undefined> { return this.approvals.get(context, approvalRequestId); }
  async listApprovalsForDraft(context: BusinessContext, draftId: string): Promise<ApprovalRequestRecord[]> {
    return (await this.approvals.list(context)).filter(
      (record) => record.target.kind === "offer_draft" && record.target.artifactId === draftId
    );
  }
  async listApprovalsForTarget(context: BusinessContext, target: ApprovalRequestRecord["target"]): Promise<ApprovalRequestRecord[]> {
    return (await this.approvals.list(context)).filter((record) => record.target.kind === target.kind && record.target.artifactId === target.artifactId && record.target.revision === target.revision);
  }
  async insertApprovedOffer(context: BusinessContext, offer: ApprovedOffer): Promise<"created" | "exists"> {
    return offerDecisionRepositoryFor(this).withTargetCriticalSection(
      context,
      { kind: "offer_draft", artifactId: offer.sourceDraft.draftId, revision: offer.sourceDraft.revision },
      async (scope) => {
        const approval = await scope.getApproval(offer.approvalRequestId);
        if (!approval) {
          throw new Error("Freigegebenes Angebot benötigt eine exakt passende genehmigte Approval-Projektion.");
        }
        try {
          validateOfferDecisionAggregate({
            schemaVersion: "1.0",
            businessId: offer.businessId,
            approval,
            approvedOffer: offer
          });
        } catch {
          throw new Error("Freigegebenes Angebot benötigt eine exakt passende genehmigte Approval-Projektion.");
        }
        return scope.insertApprovedOffer(offer);
      }
    );
  }
  async getApprovedOffer(context: BusinessContext, id: string): Promise<ApprovedOffer | undefined> { return this.approvedOffers.get(context, id); }
  async listApprovedOffers(context: BusinessContext): Promise<ApprovedOffer[]> { return this.approvedOffers.list(context); }
  async insertHandoff(context: BusinessContext, handoff: ProductionHandoff): Promise<"created" | "exists"> { return this.handoffs.insert(context, handoff); }
  async getHandoff(context: BusinessContext, id: string): Promise<ProductionHandoff | undefined> { return this.handoffs.get(context, id); }
}
