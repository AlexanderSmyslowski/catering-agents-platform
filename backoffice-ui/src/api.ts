export interface DashboardState {
  intakeRequests: Array<Record<string, unknown>>;
  acceptedSpecs: Array<Record<string, unknown>>;
  approvalRequests: Array<Record<string, unknown>>;
  specGovernanceEntries: Array<Record<string, unknown>>;
  specHistoryEntries: Array<Record<string, unknown>>;
  extractedContexts: Array<Record<string, unknown>>;
  offerDrafts: Array<Record<string, unknown>>;
  productionPlans: Array<Record<string, unknown>>;
  purchaseLists: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
}

export type RecipeUploadTarget = "offer" | "production";
export type RecipeReviewDecision = "approve" | "verify" | "reject";
export type IntakeDocumentChannel = "pdf_upload" | "email" | "text";
export type OperatorRole = "KitchenEditor" | "ProcurementEditor" | "Approver";

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
const OPERATOR_ROLE_STORAGE_KEY = "catering.operatorRole";

function getDefaultOperatorName(): string {
  if (typeof window === "undefined") {
    return "Mitarbeiter";
  }

  const stored = window.localStorage.getItem(OPERATOR_NAME_STORAGE_KEY)?.trim();
  return stored || "Mitarbeiter";
}

function getDefaultOperatorRole(): OperatorRole {
  if (typeof window === "undefined") {
    return "KitchenEditor";
  }

  const stored = window.localStorage.getItem(OPERATOR_ROLE_STORAGE_KEY);
  if (
    stored === "KitchenEditor" ||
    stored === "ProcurementEditor" ||
    stored === "Approver"
  ) {
    return stored;
  }

  return "KitchenEditor";
}

function buildHeaders(initHeaders?: HeadersInit, includeJsonContentType = true): Headers {
  const headers = new Headers(initHeaders);
  if (includeJsonContentType && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("x-actor-name")) {
    headers.set("x-actor-name", getDefaultOperatorName());
  }
  if (!headers.has("x-actor-role")) {
    headers.set("x-actor-role", getDefaultOperatorRole());
  }
  return headers;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: buildHeaders(init?.headers)
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function loadDashboardState(): Promise<DashboardState> {
  const [
    intakeRequests,
    acceptedSpecs,
    approvalRequests,
    specGovernanceEntries,
    specHistoryEntries,
    extractedContexts,
    offerDrafts,
    productionPlans,
    purchaseLists,
    recipes,
    auditEvents
  ] =
    await Promise.all([
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/requests"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/specs"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/approval-requests"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/spec-governance"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/spec-history"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/intake/v1/intake/extracted-contexts"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/offers/v1/offers/drafts"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/plans"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/purchase-lists"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/recipes"),
      fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/audit/events?limit=30")
    ]);

  return {
    intakeRequests: intakeRequests.items,
    acceptedSpecs: acceptedSpecs.items,
    approvalRequests: approvalRequests.items,
    specGovernanceEntries: specGovernanceEntries.items,
    specHistoryEntries: specHistoryEntries.items,
    extractedContexts: extractedContexts.items,
    offerDrafts: offerDrafts.items,
    productionPlans: productionPlans.items,
    purchaseLists: purchaseLists.items,
    recipes: recipes.items,
    auditEvents: auditEvents.items
  };
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
  });
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
    headers: buildHeaders(undefined, false)
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
  const response = await fetch(`/api/intake/v1/intake/specs/${specId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
    headers: buildHeaders()
  });

  const payload = (await response.json()) as {
    acceptedEventSpec?: Record<string, unknown>;
    approvalRequest?: Record<string, unknown>;
    requiresApproval?: boolean;
    message?: string;
  };

  if (!response.ok && response.status !== 409) {
    throw new Error(payload.message || `${response.status} ${response.statusText}`);
  }

  return payload;
}

export async function archiveAcceptedSpec(specId: string, reason?: string) {
  return fetchJson<{ specId: string; archivedAt: string }>(`/api/intake/v1/intake/specs/${specId}/archive`, {
    method: "POST",
    body: JSON.stringify(reason?.trim() ? { reason } : {})
  });
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
  });
}

export async function createOfferFromText(text: string) {
  return fetchJson<Record<string, unknown>>("/api/offers/v1/offers/from-text", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export async function promoteOfferDraft(draftId: string, variantId?: string) {
  return fetchJson<Record<string, unknown>>(`/api/offers/v1/offers/drafts/${draftId}/promote`, {
    method: "POST",
    body: JSON.stringify(variantId ? { variantId } : {})
  });
}

export async function createProductionPlan(eventSpec: Record<string, unknown>) {
  return fetchJson<Record<string, unknown>>("/api/production/v1/production/plans", {
    method: "POST",
    body: JSON.stringify({ eventSpec })
  });
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
    headers: buildHeaders(undefined, false)
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as { recipe: Record<string, unknown> };
}

export function readOperatorName(): string {
  return getDefaultOperatorName();
}

export function persistOperatorName(name: string): string {
  const trimmed = name.trim() || "Mitarbeiter";
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OPERATOR_NAME_STORAGE_KEY, trimmed);
  }
  return trimmed;
}

export function readOperatorRole(): OperatorRole {
  return getDefaultOperatorRole();
}

export function persistOperatorRole(role: OperatorRole): OperatorRole {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OPERATOR_ROLE_STORAGE_KEY, role);
  }
  return role;
}

export async function approveApprovalRequest(approvalRequestId: string, note?: string) {
  return fetchJson<{
    approvalRequest: Record<string, unknown>;
    acceptedEventSpec: Record<string, unknown>;
  }>(`/api/intake/v1/intake/approval-requests/${approvalRequestId}/approve`, {
    method: "POST",
    body: JSON.stringify(note?.trim() ? { note } : {})
  });
}

export async function finalizeSpecGovernanceChangeSet(input: {
  specId?: string;
  changeSetId?: string;
  confirmCriticalFinalize?: boolean;
}) {
  return fetchJson<{
    changeSet: Record<string, unknown>;
  }>("/api/intake/v1/intake/spec-governance/finalize", {
    method: "POST",
    body: JSON.stringify(input)
  });
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
  });
}

export async function seedDemoData() {
  const [intake, offers, production] = await Promise.all([
    fetchJson<Record<string, unknown>>("/api/intake/v1/intake/seed-demo", {
      method: "POST",
      body: "{}"
    }),
    fetchJson<Record<string, unknown>>("/api/offers/v1/offers/seed-demo", {
      method: "POST",
      body: "{}"
    }),
    fetchJson<Record<string, unknown>>("/api/production/v1/production/seed-demo", {
      method: "POST",
      body: "{}"
    })
  ]);

  return {
    intake,
    offers,
    production
  };
}

export function offerPrintUrl(draftId: string): string {
  return `/api/exports/v1/exports/offers/${draftId}/html`;
}

export function productionPrintUrl(planId: string): string {
  return `/api/exports/v1/exports/production-plans/${planId}/html`;
}

export function purchaseListCsvUrl(purchaseListId: string): string {
  return `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
}

export function purchaseListPrintUrl(purchaseListId: string): string {
  return `/api/exports/v1/exports/purchase-lists/${purchaseListId}/html`;
}
