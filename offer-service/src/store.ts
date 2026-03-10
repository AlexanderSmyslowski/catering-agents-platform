import type { OfferDraft } from "@catering/shared-core";

export class OfferStore {
  private readonly drafts = new Map<string, OfferDraft>();

  saveDraft(draft: OfferDraft): void {
    this.drafts.set(draft.draftId, draft);
  }

  getDraft(draftId: string): OfferDraft | undefined {
    return this.drafts.get(draftId);
  }
}

