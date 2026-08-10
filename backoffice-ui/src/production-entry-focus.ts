export function productionDraftEntryId(draftId: string): string {
  return `production-draft-${encodeURIComponent(draftId)}`;
}

export function productionDraftEntryUrl(draftId: string): string {
  const encodedDraftId = encodeURIComponent(draftId);
  return `/produktion?productionDraftId=${encodedDraftId}#${productionDraftEntryId(draftId)}`;
}

export function openProductionDraftEntry(draftId: string): void {
  if (typeof window !== "undefined") window.location.assign(productionDraftEntryUrl(draftId));
}
