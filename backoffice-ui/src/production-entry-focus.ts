export function productionDraftEntryId(draftId: string): string {
  return `production-draft-${encodeURIComponent(draftId)}`;
}

/** Handoff-created drafts use a deterministic ID so a persisted offer can
 * reopen its production review after the browser state has been reloaded. */
export function productionDraftIdForHandoff(handoffId: string): string {
  return `production-draft-handoff-${handoffId}`;
}

export function productionDraftEntryUrl(draftId?: string, productionCaseId?: string): string {
  if (!draftId) {
    return productionCaseId ? `/produktion?productionCaseId=${encodeURIComponent(productionCaseId)}` : "/produktion";
  }
  const encodedDraftId = encodeURIComponent(draftId);
  const encodedCaseId = productionCaseId ? `&productionCaseId=${encodeURIComponent(productionCaseId)}` : "";
  return `/produktion?productionDraftId=${encodedDraftId}${encodedCaseId}#${productionDraftEntryId(draftId)}`;
}

const handoffFocusKey = "catering:production-handoff-focus";
const handoffDraftFocusKey = "catering:production-handoff-draft-focus";

export function consumeProductionHandoffFocus(caseId: string): boolean {
  if (typeof window === "undefined" || window.location.hash) return false;
  try {
    if (window.sessionStorage.getItem(handoffFocusKey) !== caseId) return false;
    window.sessionStorage.removeItem(handoffFocusKey);
    return true;
  } catch { return false; }
}

export function consumeProductionHandoffDraftFocus(draftId: string): boolean {
  if (typeof window === "undefined" || window.location.hash) return false;
  try {
    if (window.sessionStorage.getItem(handoffDraftFocusKey) !== draftId) return false;
    window.sessionStorage.removeItem(handoffDraftFocusKey);
    return true;
  } catch { return false; }
}

export function openProductionDraftEntry(draftId?: string, productionCaseId?: string): void {
  if (typeof window === "undefined") return;
  let target = productionDraftEntryUrl(draftId, productionCaseId);
  if (productionCaseId) {
    try {
      window.sessionStorage.setItem(handoffFocusKey, productionCaseId);
      if (draftId) window.sessionStorage.setItem(handoffDraftFocusKey, draftId);
      else window.sessionStorage.removeItem(handoffDraftFocusKey);
      // The URL still identifies the draft; the handoff begins at its order header.
      target = target.split("#", 1)[0]!;
    } catch { /* The original deep link remains usable. */ }
  }
  window.location.assign(target);
}
