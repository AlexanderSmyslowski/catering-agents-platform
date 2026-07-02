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
    sourceMetadata?: {
      filename?: string;
      mimeType?: string;
      sizeBytes?: number;
      sha256?: string;
      ingestedAt?: string;
      uploadContext?: string;
    };
    documentIngestion?: {
      status?: string;
      warnings?: string[];
    };
  }>;
}

export type RecipeUploadTarget = "offer" | "production";
export type RecipeReviewDecision = "approve" | "verify" | "reject";
export type IntakeDocumentChannel = "pdf_upload" | "email" | "text";
export type IntakeArchiveReasonCode =
  | "wrong_upload"
  | "duplicate_test_data"
  | "operator_rehearsal_cleanup";

export interface ClarificationDraft {
  draftId: string;
  specId: string;
  questions: Array<{
    text: string;
    reason: string;
    reasonCode: string;
  }>;
  status: "pending_review" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  modelMetadata?: Record<string, unknown>;
}

export type ProductionDraftReviewDecision = "pending" | "fits" | "change_requested" | "unclear" | "blocked";

export interface ProductionDraftReviewCard {
  cardId: string;
  kind: string;
  title: string;
  summary: string;
  decision: ProductionDraftReviewDecision;
  targetId?: string;
  riskLevel?: "low" | "medium" | "high" | "blocking";
  requiredApproval?: boolean;
  operatorComment?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface ProductionDraft {
  draftId: string;
  status: "pending_review" | "approved" | "rejected" | "superseded";
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
  appliedArtifactIds?: {
    specId?: string;
    planId?: string;
    purchaseListId?: string;
  };
  source?: {
    kind?: string;
    receivedAt?: string;
    providerId?: string;
    modelId?: string;
  };
  reviewCards: ProductionDraftReviewCard[];
  draftArtifacts?: {
    eventSpec?: Record<string, unknown>;
    productionPlan?: Record<string, unknown>;
    purchaseList?: Record<string, unknown>;
    recipes?: Array<Record<string, unknown>>;
    openQuestions?: Array<Record<string, unknown>>;
    notes?: string[];
  };
}

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
const MINI_PILOT_RESULT_STORAGE_KEY = "catering.miniPilotRawResult";
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

async function responseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.clone().json()) as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch {
    // Keep the generic HTTP fallback when the server did not return JSON.
  }

  return `${response.status} ${response.statusText}`.trim();
}

async function fetchJson<T>(input: string, init?: RequestInit, defaultActorName?: string): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: buildHeaders(init?.headers, true, defaultActorName)
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function loadDashboardState(): Promise<DashboardState> {
  const [intakeRequests, acceptedSpecs, offerDrafts, productionPlans, purchaseLists, recipes, auditEvents] =
    await Promise.all([
      fetchJson<{ items: Array<Record<string, unknown>> }>(
        "/api/intake/v1/intake/requests",
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.intake
      ),
      fetchJson<{ items: Array<Record<string, unknown>> }>(
        "/api/intake/v1/intake/specs",
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.intake
      ),
      fetchJson<{ items: Array<Record<string, unknown>> }>(
        "/api/offers/v1/offers/drafts",
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.offer
      ),
      fetchJson<{ items: Array<Record<string, unknown>> }>(
        "/api/production/v1/production/plans",
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.production
      ),
      fetchJson<{ items: Array<Record<string, unknown>> }>(
        "/api/production/v1/production/purchase-lists",
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.production
      ),
      fetchJson<{ items: Array<Record<string, unknown>> }>(
        "/api/production/v1/production/recipes",
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.production
      ),
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
  return fetchJson<IntakeRequestDetail>(
    `/api/intake/v1/intake/requests/${requestId}`,
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.intake
  );
}

export async function archiveIntakeRequest(
  requestId: string,
  reasonCode: IntakeArchiveReasonCode = "wrong_upload"
) {
  return fetchJson<Record<string, unknown>>(
    `/api/intake/v1/intake/requests/${encodeURIComponent(requestId)}/archive`,
    {
      method: "POST",
      body: JSON.stringify({ reasonCode })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.intake
  );
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
    throw new Error(await responseErrorMessage(response));
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

export async function createProductionPlan(
  eventSpec: Record<string, unknown>,
  options?: { sourceReviewConfirmed?: boolean }
) {
  return fetchJson<Record<string, unknown>>("/api/production/v1/production/plans", {
    method: "POST",
    body: JSON.stringify({
      eventSpec,
      ...(options?.sourceReviewConfirmed ? { sourceReviewConfirmed: true } : {})
    })
  }, DEFAULT_MUTATION_ACTOR_NAMES.production);
}

export async function loadClarificationDrafts(specId: string) {
  return fetchJson<{ items: ClarificationDraft[] }>(
    `/api/production/v1/production/specs/${encodeURIComponent(specId)}/clarification-drafts`,
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function createClarificationDraft(specId: string) {
  return fetchJson<{ draft: ClarificationDraft }>(
    `/api/production/v1/production/specs/${encodeURIComponent(specId)}/clarification-drafts`,
    {
      method: "POST",
      body: "{}"
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function decideClarificationDraft(draftId: string, approve: boolean) {
  return fetchJson<{ draft: ClarificationDraft; acceptedEventSpec?: Record<string, unknown> }>(
    `/api/production/v1/production/clarification-drafts/${encodeURIComponent(draftId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify({ approve })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function loadProductionDrafts() {
  return fetchJson<{ items: ProductionDraft[] }>(
    "/api/production/v1/production/drafts",
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function decideProductionDraftReviewCard(
  draftId: string,
  cardId: string,
  decision: Exclude<ProductionDraftReviewDecision, "pending">
) {
  return fetchJson<{ draft: ProductionDraft; reviewCard: ProductionDraftReviewCard }>(
    `/api/production/v1/production/drafts/${encodeURIComponent(draftId)}/review-cards/${encodeURIComponent(cardId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function decideProductionDraft(draftId: string, approve: boolean) {
  return fetchJson<{ draft: ProductionDraft }>(
    `/api/production/v1/production/drafts/${encodeURIComponent(draftId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify({ approve })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function applyProductionDraft(draftId: string) {
  return fetchJson<{ draft: ProductionDraft; applied: ProductionDraft["appliedArtifactIds"] }>(
    `/api/production/v1/production/drafts/${encodeURIComponent(draftId)}/apply`,
    {
      method: "POST"
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
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
    throw new Error(await responseErrorMessage(response));
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

export function readMiniPilotRawResult(): string {
  return readMiniPilotStoredResult().rawResult;
}

export type MiniPilotStoredResult = {
  rawResult: string;
  updatedAt?: string;
};

export function readMiniPilotStoredResult(): MiniPilotStoredResult {
  if (typeof window === "undefined") {
    return { rawResult: "" };
  }

  const stored = window.localStorage.getItem(MINI_PILOT_RESULT_STORAGE_KEY);
  if (!stored) {
    return { rawResult: "" };
  }

  try {
    const parsed = JSON.parse(stored) as { rawResult?: unknown; updatedAt?: unknown };
    if (typeof parsed.rawResult === "string") {
      return {
        rawResult: parsed.rawResult,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined
      };
    }
  } catch {
    // Legacy raw storage remains readable as-is.
  }

  return { rawResult: stored };
}

export function persistMiniPilotRawResult(rawResult: string): string {
  return persistMiniPilotStoredResult(rawResult).rawResult;
}

export function persistMiniPilotStoredResult(rawResult: string): MiniPilotStoredResult {
  const normalized = typeof rawResult === "string" ? rawResult : "";
  if (typeof window === "undefined") {
    return { rawResult: normalized };
  }

  if (!normalized.trim()) {
    window.localStorage.removeItem(MINI_PILOT_RESULT_STORAGE_KEY);
    return { rawResult: "" };
  }

  const updatedAt = new Date().toISOString();
  window.localStorage.setItem(
    MINI_PILOT_RESULT_STORAGE_KEY,
    JSON.stringify({
      rawResult: normalized,
      updatedAt
    })
  );
  return {
    rawResult: normalized,
    updatedAt
  };
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

export function productionFolderExportUrl(planId: string): string {
  return `/api/exports/v1/exports/production-folders/${planId}/html`;
}

export function purchaseListExportUrl(purchaseListId: string): string {
  return `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
}
