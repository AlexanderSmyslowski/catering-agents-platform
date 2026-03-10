import { FileBackedCollection, type OfferDraft } from "@catering/shared-core";

export class OfferStore {
  private readonly drafts: FileBackedCollection<OfferDraft>;

  constructor(options?: { dataRoot?: string }) {
    this.drafts = new FileBackedCollection({
      collectionName: "offers/drafts",
      getId: (draft) => draft.draftId,
      rootDir: options?.dataRoot
    });
  }

  saveDraft(draft: OfferDraft): void {
    this.drafts.set(draft);
  }

  getDraft(draftId: string): OfferDraft | undefined {
    return this.drafts.get(draftId);
  }

  listDrafts(): OfferDraft[] {
    return this.drafts.list();
  }
}
