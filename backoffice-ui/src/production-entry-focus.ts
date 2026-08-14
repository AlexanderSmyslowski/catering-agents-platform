export function productionDraftEntryId(draftId: string): string {
  return `production-draft-${encodeURIComponent(draftId)}`;
}

/** Handoff-created drafts use a deterministic ID so a persisted offer can
 * reopen its production review after the browser state has been reloaded. */
export function productionDraftIdForHandoff(handoffId: string): string {
  return `production-draft-handoff-${handoffId}`;
}

export function productionDraftEntryUrl(draftId: string): string {
  const encodedDraftId = encodeURIComponent(draftId);
  return `/produktion?productionDraftId=${encodedDraftId}#${productionDraftEntryId(draftId)}`;
}

export function openProductionDraftEntry(draftId: string): void {
  if (typeof window !== "undefined") window.location.assign(productionDraftEntryUrl(draftId));
}
