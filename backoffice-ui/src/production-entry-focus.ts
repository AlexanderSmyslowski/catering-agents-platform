export function productionDraftEntryId(draftId: string): string {
  return `production-draft-${encodeURIComponent(draftId)}`;
}

/** Handoff-created drafts use a deterministic ID so a persisted offer can
 * reopen its production review after the browser state has been reloaded. */
export function productionDraftIdForHandoff(handoffId: string): string {
  return `production-draft-handoff-${handoffId}`;
}

export function productionDraftEntryUrl(draftId: string, productionCaseId?: string): string {
  const encodedDraftId = encodeURIComponent(draftId);
  const encodedCaseId = productionCaseId ? `&productionCaseId=${encodeURIComponent(productionCaseId)}` : "";
  return `/produktion?productionDraftId=${encodedDraftId}${encodedCaseId}#${productionDraftEntryId(draftId)}`;
}

export function openProductionDraftEntry(draftId: string, productionCaseId?: string): void {
  if (typeof window !== "undefined") window.location.assign(productionDraftEntryUrl(draftId, productionCaseId));
}
