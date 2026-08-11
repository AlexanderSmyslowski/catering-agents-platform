import { randomUUID } from "node:crypto";
import {
  createBusinessScopedPersistentCollection,
  areJsonValuesEqual,
  initialCaseEventForCase,
  normalizeCaseSearchText,
  persistCaseWithInitialEvent,
  sortCasesByLatestActivity,
  withBusinessTargetCriticalSection,
  type ApprovalRequestRecord,
  type ApprovedOffer,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type CaseEvent,
  type OfferCase,
  type OfferDraft,
  type ProductionHandoff,
  validateApprovalRequestRecord,
  validateApprovedOffer,
  validateCaseEvent,
  validateCaseEventForProduct,
  validateOfferCase,
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

interface OfferCaseCollections {
  cases: BusinessScopedPersistentCollection<OfferCase>;
  events: BusinessScopedPersistentCollection<CaseEvent>;
}

type CaseEventInput = Omit<CaseEvent, "businessId" | "eventId" | "caseId" | "sequence">;

function createOfferCaseCollections(options: CollectionStorageOptions): OfferCaseCollections {
  return {
    cases: createBusinessScopedPersistentCollection({
      collectionName: "offers/cases",
      getId: (item: OfferCase) => item.caseId,
      getVersion: (item: OfferCase) => item.version,
      validate: validateOfferCase,
      ...options
    }),
    events: createBusinessScopedPersistentCollection({
      collectionName: "offers/case-events",
      getId: (item: CaseEvent) => item.eventId,
      validate: validateCaseEvent,
      ...options
    })
  };
}

async function createOfferCaseInCollections(
  collections: OfferCaseCollections,
  context: BusinessContext,
  input: OfferCase
): Promise<"created" | "exists"> {
  const item = validateOfferCase(input);
  const initialEvent = validateCaseEventForProduct(initialCaseEventForCase(item), "offer");
  return persistCaseWithInitialEvent(collections, context, item, initialEvent);
}

function assertOfferCaseUpdate(existing: OfferCase, next: OfferCase, expectedVersion: number): void {
  if (
    next.businessId !== existing.businessId ||
    next.caseId !== existing.caseId ||
    next.product !== existing.product ||
    next.schemaVersion !== existing.schemaVersion ||
    next.createdAt !== existing.createdAt ||
    next.copiedFromCaseId !== existing.copiedFromCaseId
  ) {
    throw new Error("Die Identität eines OfferCase darf nicht verändert werden.");
  }
  if (next.version !== expectedVersion + 1) {
    throw new Error("Eine OfferCase-Aktualisierung muss die Version genau um eins erhöhen.");
  }
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
  private readonly cases: BusinessScopedPersistentCollection<OfferCase>;
  private readonly caseEvents: BusinessScopedPersistentCollection<CaseEvent>;

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
    const caseCollections = createOfferCaseCollections(storage);
    this.cases = caseCollections.cases;
    this.caseEvents = caseCollections.events;
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

  async insertCase(context: BusinessContext, item: OfferCase): Promise<"created" | "exists"> {
    return this.createCase(context, item);
  }

  async createCase(context: BusinessContext, item: OfferCase): Promise<"created" | "exists"> {
    const storage = this.storageOptions ?? {};
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "offer_case", artifactId: item.caseId, revision: 0 },
      collectionNamespace: "offers/case-events",
      queueFullMessage: "Die Warteschlange für Angebotsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Angebotsverläufe ist ausgeschöpft.",
      timeoutMessage: "Der Angebotsverlauf konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Angebotsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Angebotsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: (transactionalQueryable) => createOfferCaseInCollections(
        transactionalQueryable
          ? createOfferCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents },
        context,
        item
      )
    });
  }

  async getCase(context: BusinessContext, caseId: string): Promise<OfferCase | undefined> {
    return this.cases.get(context, caseId);
  }

  async listCases(context: BusinessContext): Promise<OfferCase[]> {
    return sortCasesByLatestActivity(
      await this.cases.list(context),
      await this.caseEvents.list(context)
    );
  }

  async updateCase(
    context: BusinessContext,
    caseId: string,
    expectedVersion: number,
    next: OfferCase
  ): Promise<"updated" | "conflict" | "missing"> {
    const existing = await this.cases.get(context, caseId);
    if (!existing) return "missing";
    assertOfferCaseUpdate(existing, next, expectedVersion);
    return this.cases.compareAndSet(context, caseId, expectedVersion, next);
  }

  async appendEvent(context: BusinessContext, caseId: string, input: CaseEventInput): Promise<CaseEvent> {
    const storage = this.storageOptions ?? {};
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "offer_case", artifactId: caseId, revision: 0 },
      collectionNamespace: "offers/case-events",
      queueFullMessage: "Die Warteschlange für Angebotsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Angebotsverläufe ist ausgeschöpft.",
      timeoutMessage: "Der Angebotsverlauf konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Angebotsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Angebotsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable) => {
        const collections = transactionalQueryable
          ? createOfferCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents };
        if (!await collections.cases.get(context, caseId)) {
          throw new Error("OfferCase wurde nicht gefunden.");
        }
        const sequence = (await collections.events.list(context))
          .filter((event) => event.caseId === caseId)
          .reduce((maximum, event) => Math.max(maximum, event.sequence), 0) + 1;
        const event = validateCaseEventForProduct({
          ...input,
          businessId: context.businessId,
          eventId: `offer-case-event-${randomUUID()}`,
          caseId,
          sequence
        }, "offer");
        if (await collections.events.insert(context, event) !== "created") {
          throw new Error("Der Angebotsverlauf konnte nicht eindeutig fortgeschrieben werden.");
        }
        return event;
      }
    });
  }

  async listEvents(context: BusinessContext, caseId: string): Promise<CaseEvent[]> {
    if (!await this.cases.get(context, caseId)) throw new Error("OfferCase wurde nicht gefunden.");
    return (await this.caseEvents.list(context))
      .filter((event) => event.caseId === caseId)
      .sort((left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId));
  }

  async searchCases(context: BusinessContext, query: string): Promise<OfferCase[]> {
    const normalizedQuery = normalizeCaseSearchText(query);
    const cases = await this.listCases(context);
    if (!normalizedQuery) return cases;
    const events = await this.caseEvents.list(context);
    const sourceNamesByCase = new Map<string, string[]>();
    for (const event of events) {
      const filename = event.sourceRef?.filename;
      if (!filename) continue;
      const names = sourceNamesByCase.get(event.caseId) ?? [];
      names.push(filename);
      sourceNamesByCase.set(event.caseId, names);
    }
    return cases.filter((item) => normalizeCaseSearchText([
      item.displayName,
      ...(sourceNamesByCase.get(item.caseId) ?? [])
    ].join(" ")).includes(normalizedQuery));
  }
}
