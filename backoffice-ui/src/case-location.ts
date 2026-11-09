export type CaseProduct = "offer" | "production";

function caseParameter(product: CaseProduct): string {
  return product === "offer" ? "offerCaseId" : "productionCaseId";
}

export function caseIdFromSearch(product: CaseProduct, search: string): string | undefined {
  const values = new URLSearchParams(search).getAll(caseParameter(product));
  if (values.length !== 1) return undefined;
  const value = values[0];
  return value && value === value.trim() && value.length <= 512 ? value : undefined;
}

export function caseIdFromLocation(product: CaseProduct, userId?: string): string | undefined {
  const state = window.history.state;
  const owner = state && typeof state === "object" ? state["catering.caseUrlOwner"] : undefined;
  const oldOfferFocus = state && typeof state === "object" ? state["catering.offerCaseFocus"] : undefined;
  if (typeof owner === "string" && owner !== userId) return undefined;
  if (owner === undefined && oldOfferFocus && typeof oldOfferFocus === "object" &&
      oldOfferFocus.userId !== userId) return undefined;
  return caseIdFromSearch(product, window.location.search);
}

export function navigateToCase(product: CaseProduct, caseId: string | undefined, userId?: string): void {
  const url = new URL(window.location.href);
  if (caseIdFromSearch(product, url.search) === caseId &&
      (caseId !== undefined || !url.searchParams.has(caseParameter(product)))) return;
  url.searchParams.delete(caseParameter(product));
  if (caseId) url.searchParams.set(caseParameter(product), caseId);
  if (product === "production") url.searchParams.delete("productionDraftId");
  url.hash = "";
  const state = window.history.state;
  const next = state && typeof state === "object" && !Array.isArray(state) ? { ...state } : {};
  delete next["catering.offerCaseFocus"];
  if (userId) next["catering.caseUrlOwner"] = userId;
  window.history.pushState(next, "", url);
}
