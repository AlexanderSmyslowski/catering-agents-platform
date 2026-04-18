export interface DashboardState {
  intakeRequests: Array<Record<string, unknown>>;
  acceptedSpecs: Array<Record<string, unknown>>;
  offerDrafts: Array<Record<string, unknown>>;
  productionPlans: Array<Record<string, unknown>>;
  purchaseLists: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
}

export interface IntakeRequestDetail extends Record<string, unknown> {
  requestId: string;
  source?: {
    channel?: string;
    receivedAt?: string;
  };
  rawInputs?: Array<{
    kind: string;
    mimeType?: string;
    content?: string;
    documentId?: string;
  }>;
}

export type RecipeUploadTarget = "offer" | "production";
export type RecipeReviewDecision = "approve" | "verify" | "reject";
export type IntakeDocumentChannel = "pdf_upload" | "email" | "text";

export interface ServiceHealth {
  service: string;
  status: string;
  timestamp: string;
  counts: Record<string, number>;
}

export interface ServiceHealthState {
  intake: ServiceHealth;
  offers: ServiceHealth;
  production: ServiceHealth;
  exports: ServiceHealth;
}

const OPERATOR_NAME_STORAGE_KEY = "catering.operatorName";
const AUDIT_OPERATOR_NAME = "Betriebs-/Audit-Operator";
const GENERIC_OPERATOR_NAME = "Mitarbeiter";
const DEFAULT_MUTATION_ACTOR_NAMES = {
  intake: "Intake-Mitarbeiter",
  offer: "Angebots-Mitarbeiter",
  production: "Produktions-Mitarbeiter",
  audit: AUDIT_OPERATOR_NAME
} as const;

function getStoredOperatorName(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const stored = window.localStorage.getItem(OPERATOR_NAME_STORAGE_KEY)?.trim();
  return stored || undefined;
}

function getRequestActorName(defaultActorName?: string): string {
  const storedOperatorName = getStoredOperatorName();
  if (storedOperatorName && storedOperatorName !== GENERIC_OPERATOR_NAME) {
    return storedOperatorName;
  }

  return defaultActorName ?? storedOperatorName ?? GENERIC_OPERATOR_NAME;
}

function buildHeaders(
  initHeaders?: HeadersInit,
  includeJsonContentType = true,
  defaultActorName?: string
): Headers {
  const headers = new Headers(initHeaders);
  if (includeJsonContentType && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("x-actor-name")) {
    headers.set("x-actor-name", getRequestActorName(defaultActorName));
  }
  return headers;
}

async function fetchJson<T>(input: string, init?: RequestInit, defaultActorName?: string): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: buildHeaders(init?.headers, true, defaultActorName)
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function loadDashboardState(): Promise<DashboardState> {
  const [intakeRequests, acceptedSpecs, offerDrafts, productionPlans, purchaseLists, recipes, auditEvents] =
    await Promise.all([
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/requests"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/specs"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/offers/v1/offers/drafts"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/plans"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/purchase-lists"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/recipes"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/audit/events?limit=30", {
        headers: {
          "x-actor-name": AUDIT_OPERATOR_NAME
        }
      })
    ]);

  return {
    intakeRequests: intakeRequests.items,
    acceptedSpecs: acceptedSpecs.items,
    offerDrafts: offerDrafts.items,
    productionPlans: productionPlans.items,
    purchaseLists: purchaseLists.items,
    recipes: recipes.items,
    auditEvents: auditEvents.items
  };
}

export async function loadIntakeRequestDetail(requestId: string): Promise<IntakeRequestDetail> {
  return fetchJson<IntakeRequestDetail>(`/api/intake/v1/intake/requests/${requestId}`);
}

export async function loadServiceHealth(): Promise<ServiceHealthState> {
  const [intake, offers, production, exportsHealth] = await Promise.all([
    fetchJson<ServiceHealth>("/api/intake/health"),
    fetchJson<ServiceHealth>("/api/offers/health"),
    fetchJson<ServiceHealth>("/api/production/health"),
    fetchJson<ServiceHealth>("/api/exports/health")
  ]);

  return {
    intake,
    offers,
    production,
    exports: exportsHealth
  };
}

export async function createAcceptedSpecFromText(text: string) {
  return fetchJson<Record<string, unknown>>("/api/intake/v1/intake/normalize", {
    method: "POST",
    body: JSON.stringify({ text })
  }, DEFAULT_MUTATION_ACTOR_NAMES.intake);
}

export async function createAcceptedSpecFromDocument(
  file: File,
  channel: IntakeDocumentChannel
) {
  const formData = new FormData();
  formData.append("channel", channel);
  formData.append("file", file, file.name);

  const response = await fetch("/api/intake/v1/intake/documents/upload", {
    method: "POST",
    body: formData,
    headers: buildHeaders(undefined, false, DEFAULT_MUTATION_ACTOR_NAMES.intake)
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function updateAcceptedSpec(
  specId: string,
  input: {
    eventDate?: string;
    attendeeCount?: number;
    serviceForm?: string;
    eventType?: string;
    menuItems?: string[];
    componentUpdates?: Array<{
      componentId: string;
      menuCategory?: "classic" | "vegetarian" | "vegan";
      productionMode?: "scratch" | "hybrid" | "convenience_purchase" | "external_finished";
      purchasedElements?: string[];
      recipeOverrideId?: string;
      notes?: string;
    }>;
  }
) {
  return fetchJson<{ acceptedEventSpec: Record<string, unknown> }>(
    `/api/intake/v1/intake/specs/${specId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input)
    },
    DEFAULT_MUTATION_ACTOR_NAMES.intake
  );
}

export async function createAcceptedSpecFromManualForm(input: {
  eventType?: string;
  eventDate?: string;
  attendeeCount?: number;
  serviceForm?: string;
  menuItems?: string[];
  customerName?: string;
  venueName?: string;
  notes?: string;
}) {
  return fetchJson<Record<string, unknown>>("/api/intake/v1/intake/specs/manual", {
    method: "POST",
    body: JSON.stringify(input)
  }, DEFAULT_MUTATION_ACTOR_NAMES.intake);
}

export async function createOfferFromText(text: string) {
  return fetchJson<Record<string, unknown>>("/api/offers/v1/offers/from-text", {
    method: "POST",
    body: JSON.stringify({ text })
  }, DEFAULT_MUTATION_ACTOR_NAMES.offer);
}

export async function promoteOfferDraft(draftId: string, variantId?: string) {
  return fetchJson<Record<string, unknown>>(`/api/offers/v1/offers/drafts/${draftId}/promote`, {
    method: "POST",
    body: JSON.stringify(variantId ? { variantId } : {})
  }, DEFAULT_MUTATION_ACTOR_NAMES.offer);
}

export async function createProductionPlan(eventSpec: Record<string, unknown>) {
  return fetchJson<Record<string, unknown>>("/api/production/v1/production/plans", {
    method: "POST",
    body: JSON.stringify({ eventSpec })
  }, DEFAULT_MUTATION_ACTOR_NAMES.production);
}

export async function uploadRecipeFile(
  target: RecipeUploadTarget,
  file: File,
  recipeName?: string
) {
  const formData = new FormData();
  formData.append("file", file);
  if (recipeName?.trim()) {
    formData.append("recipeName", recipeName.trim());
  }

  const endpoint =
    target === "offer"
      ? "/api/offers/v1/offers/recipes/upload"
      : "/api/production/v1/production/recipes/upload";

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
    headers: buildHeaders(
      undefined,
      false,
      target === "offer" ? DEFAULT_MUTATION_ACTOR_NAMES.offer : DEFAULT_MUTATION_ACTOR_NAMES.production
    )
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as { recipe: Record<string, unknown> };
}

export function readOperatorName(): string {
  return getStoredOperatorName() ?? GENERIC_OPERATOR_NAME;
}

export function persistOperatorName(name: string): string {
  const trimmed = name.trim() || GENERIC_OPERATOR_NAME;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OPERATOR_NAME_STORAGE_KEY, trimmed);
  }
  return trimmed;
}

export async function reviewRecipe(
  target: RecipeUploadTarget,
  recipeId: string,
  decision: RecipeReviewDecision
) {
  const endpoint =
    target === "offer"
      ? `/api/offers/v1/offers/recipes/${recipeId}/review`
      : `/api/production/v1/production/recipes/${recipeId}/review`;

  return fetchJson<{ recipe: Record<string, unknown> }>(endpoint, {
    method: "PATCH",
    body: JSON.stringify({ decision })
  }, target === "offer" ? DEFAULT_MUTATION_ACTOR_NAMES.offer : DEFAULT_MUTATION_ACTOR_NAMES.production);
}

export async function seedDemoData() {
  const [intake, offers, production] = await Promise.all([
    fetchJson<Record<string, unknown>>("/api/intake/v1/intake/seed-demo", {
      method: "POST",
      body: "{}"
    }, DEFAULT_MUTATION_ACTOR_NAMES.audit),
    fetchJson<Record<string, unknown>>("/api/offers/v1/offers/seed-demo", {
      method: "POST",
      body: "{}"
    }, DEFAULT_MUTATION_ACTOR_NAMES.audit),
    fetchJson<Record<string, unknown>>("/api/production/v1/production/seed-demo", {
      method: "POST",
      body: "{}"
    }, DEFAULT_MUTATION_ACTOR_NAMES.audit)
  ]);

  return {
    intake,
    offers,
    production
  };
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
