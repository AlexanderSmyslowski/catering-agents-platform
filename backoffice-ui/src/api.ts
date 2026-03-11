export interface DashboardState {
  intakeRequests: Array<Record<string, unknown>>;
  acceptedSpecs: Array<Record<string, unknown>>;
  offerDrafts: Array<Record<string, unknown>>;
  productionPlans: Array<Record<string, unknown>>;
  purchaseLists: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function loadDashboardState(): Promise<DashboardState> {
  const [intakeRequests, acceptedSpecs, offerDrafts, productionPlans, purchaseLists, recipes] =
    await Promise.all([
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/requests"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/specs"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/offers/v1/offers/drafts"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/plans"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/purchase-lists"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/recipes")
    ]);

  return {
    intakeRequests: intakeRequests.items,
    acceptedSpecs: acceptedSpecs.items,
    offerDrafts: offerDrafts.items,
    productionPlans: productionPlans.items,
    purchaseLists: purchaseLists.items,
    recipes: recipes.items
  };
}

export async function createAcceptedSpecFromText(text: string) {
  return fetchJson<Record<string, unknown>>("/api/intake/v1/intake/normalize", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export async function createOfferFromText(text: string) {
  return fetchJson<Record<string, unknown>>("/api/offers/v1/offers/from-text", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export async function createProductionPlan(eventSpec: Record<string, unknown>) {
  return fetchJson<Record<string, unknown>>("/api/production/v1/production/plans", {
    method: "POST",
    body: JSON.stringify({ eventSpec })
  });
}

export function offerExportUrl(draftId: string): string {
  return `/api/exports/v1/exports/offers/${draftId}/html`;
}

export function productionExportUrl(planId: string): string {
  return `/api/exports/v1/exports/production-plans/${planId}/html`;
}

export function purchaseListExportUrl(purchaseListId: string): string {
  return `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
}
