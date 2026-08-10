import {
  createBusinessScopedPersistentCollection,
  areJsonValuesEqual,
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

export class OfferStore {
  private readonly drafts: BusinessScopedPersistentCollection<OfferDraft>;
  private readonly approvals: BusinessScopedPersistentCollection<ApprovalRequestRecord>;
  private readonly approvedOffers: BusinessScopedPersistentCollection<ApprovedOffer>;
  private readonly handoffs: BusinessScopedPersistentCollection<ProductionHandoff>;

  readonly storageOptions?: CollectionStorageOptions;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options;
    const storage = { rootDir: options?.rootDir, databaseUrl: options?.databaseUrl, pgPool: options?.pgPool };
    this.drafts = createBusinessScopedPersistentCollection({ collectionName: "offers/drafts", getId: (draft: OfferDraft) => draft.draftId, getVersion: (draft: OfferDraft) => draft.revision, validate: validateOfferDraft, ...storage });
    this.approvals = createBusinessScopedPersistentCollection({ collectionName: "offers/approvals", getId: (approval: ApprovalRequestRecord) => approval.approvalRequestId, validate: validateApprovalRequestRecord, ...storage });
    this.approvedOffers = createBusinessScopedPersistentCollection({ collectionName: "offers/approved", getId: (offer: ApprovedOffer) => offer.approvedOfferId, validate: validateApprovedOffer, ...storage });
    this.handoffs = createBusinessScopedPersistentCollection({ collectionName: "offers/handoffs", getId: (handoff: ProductionHandoff) => handoff.handoffId, validate: validateProductionHandoff, ...storage });
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
  async insertApproval(context: BusinessContext, record: ApprovalRequestRecord): Promise<"created" | "exists"> { return this.approvals.insert(context, record); }
  async listApprovalsForTarget(context: BusinessContext, target: ApprovalRequestRecord["target"]): Promise<ApprovalRequestRecord[]> {
    return (await this.approvals.list(context)).filter((record) => record.target.kind === target.kind && record.target.artifactId === target.artifactId && record.target.revision === target.revision);
  }
  async insertApprovedOffer(context: BusinessContext, offer: ApprovedOffer): Promise<"created" | "exists"> { return this.approvedOffers.insert(context, offer); }
  async getApprovedOffer(context: BusinessContext, id: string): Promise<ApprovedOffer | undefined> { return this.approvedOffers.get(context, id); }
  async listApprovedOffers(context: BusinessContext): Promise<ApprovedOffer[]> { return this.approvedOffers.list(context); }
  async insertHandoff(context: BusinessContext, handoff: ProductionHandoff): Promise<"created" | "exists"> { return this.handoffs.insert(context, handoff); }
  async getHandoff(context: BusinessContext, id: string): Promise<ProductionHandoff | undefined> { return this.handoffs.get(context, id); }
}
