import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection,
  type OfferDraft
} from "@catering/shared-core";

export class OfferStore {
  private readonly drafts: PersistentCollection<OfferDraft>;

  readonly storageOptions?: CollectionStorageOptions;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options;
    this.drafts = createPersistentCollection<OfferDraft>({
      collectionName: "offers/drafts",
      getId: (draft) => draft.draftId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async saveDraft(draft: OfferDraft): Promise<void> {
    await this.drafts.set(draft);
  }

  async getDraft(draftId: string): Promise<OfferDraft | undefined> {
    return this.drafts.get(draftId);
  }

  async listDrafts(): Promise<OfferDraft[]> {
    return this.drafts.list();
  }
}
