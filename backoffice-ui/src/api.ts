import type {
  ApprovedOffer,
  ApprovedProductionSpec,
  AcceptedEventSpec,
  AuditEntry,
  CaseEvent,
  CaseSourceRef,
  CaseSummary,
  OfferCase,
  OfferDraft,
  ProductionCase,
  ProductionPlan,
  ProductionHandoff,
  PurchaseList,
  Recipe
} from "@catering/shared-core";

export type { CaseSummary } from "@catering/shared-core";

export interface DashboardState {
  intakeRequests: Array<Record<string, unknown>>;
  acceptedSpecs: Array<Record<string, unknown>>;
  offerDrafts: Array<Record<string, unknown>>;
  productionPlans: Array<Record<string, unknown>>;
  purchaseLists: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
}

export interface OfferWorkspaceState {
  cases: CaseSummary[];
  activeCase?: OfferCase;
  activeEvents: CaseEvent[];
  activeSources: CaseSourceRef[];
  currentDraft?: OfferDraft;
  approvedOffer?: ApprovedOffer;
  handoff?: ProductionHandoff;
}

export interface ProductionWorkspaceState {
  cases: CaseSummary[];
  activeCase?: ProductionCase;
  activeEvents: CaseEvent[];
  activeSources: CaseSourceRef[];
  currentDraft?: ProductionDraft;
  approvedProductionSpec?: ApprovedProductionSpec;
  currentPlan?: ProductionPlan;
  currentPurchaseList?: PurchaseList;
  referencedRecipes: Recipe[];
}

const emptyOfferWorkspaceState: OfferWorkspaceState = {
  cases: [],
  activeEvents: [],
  activeSources: []
};

const emptyProductionWorkspaceState: ProductionWorkspaceState = {
  cases: [],
  activeEvents: [],
  activeSources: [],
  referencedRecipes: []
};

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
  businessId?: string;
  draftId: string;
  revision?: number;
  status: "pending_review" | "approved" | "rejected" | "superseded";
  createdAt: string;
  supersedesDraftId?: string;
  approvalRequestId?: string;
  appliedAt?: string;
  appliedBy?: string;
  appliedArtifactIds?: {
    specId?: string;
    planId?: string;
    purchaseListId?: string;
    recipeIds?: string[];
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

export interface ApprovedProductionSpecSummary {
  approvedProductionSpecId: string;
  artifacts: {
    eventSpec: Record<string, unknown>;
    productionPlan: Record<string, unknown>;
    purchaseList: Record<string, unknown>;
    recipes: Array<Record<string, unknown>>;
  };
}

export interface ApprovedProductionSpecProjection {
  approvedProductionSpecId: string;
  sourceDraft: {
    draftId: string;
    revision: number;
  };
  applied: boolean;
}

export interface ProductionDraftListResponse {
  items: ProductionDraft[];
  approvedProductionSpecs?: ApprovedProductionSpecProjection[];
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

export interface OfferProductData {
  workspace: OfferWorkspaceState;
  intakeRequests: IntakeRequestDetail[];
  acceptedSpecs: AcceptedEventSpec[];
  offerDrafts: OfferDraft[];
  serviceHealth: ServiceHealthState;
}

export interface ProductionProductData {
  workspace: ProductionWorkspaceState;
  intakeRequests: IntakeRequestDetail[];
  acceptedSpecs: AcceptedEventSpec[];
  productionPlans: ProductionPlan[];
  purchaseLists: PurchaseList[];
  recipes: Recipe[];
  auditEvents: AuditEntry[];
  serviceHealth: ServiceHealthState;
}

export interface WorkspaceRefreshOptions {
  focusedSpecId?: string;
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

function sourcesFromCaseEvents(events: CaseEvent[]): CaseSourceRef[] {
  const sources = new Map<string, CaseSourceRef>();
  for (const event of events) {
    if (event.sourceRef) {
      sources.set(event.sourceRef.sourceId, event.sourceRef);
    }
  }
  return [...sources.values()];
}

function artifactIdFromCaseEvents(events: CaseEvent[], artifactType: "OfferDraft" | "ProductionDraft"): string | undefined {
  return [...events]
    .sort((left, right) => right.sequence - left.sequence)
    .map((event) => event.revisionRef)
    .find((reference) => reference?.artifactType === artifactType)?.artifactId;
}

function unknownServiceHealth(service: string): ServiceHealth {
  return { service, status: "unknown", timestamp: "", counts: {} };
}

function serviceHealthStateFor(domain: "offer" | "production", health: ServiceHealth): ServiceHealthState {
  return {
    intake: unknownServiceHealth("intake-service"),
    offers: domain === "offer" ? health : unknownServiceHealth("offer-service"),
    production: domain === "production" ? health : unknownServiceHealth("production-service"),
    exports: unknownServiceHealth("print-export")
  };
}

function auditEntriesFromCaseEvents(events: CaseEvent[]): AuditEntry[] {
  return [...events]
    .sort((left, right) => right.sequence - left.sequence)
    .map((event) => ({
    auditId: event.eventId,
    businessId: event.businessId,
    at: event.at,
    action: event.kind,
    entityType: "case",
    entityId: event.caseId,
    actor: {
      name: event.role,
      source: "case-event"
    },
    summary: event.text.trim() || `Fallereignis: ${event.kind}`
  }));
}

export async function loadOfferWorkspaceState(activeCaseId?: string): Promise<OfferWorkspaceState> {
  const { items: cases } = await fetchJson<{ items: CaseSummary[] }>(
    "/api/offers/v1/offers/cases",
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.offer
  );

  if (!activeCaseId) {
    return { ...emptyOfferWorkspaceState, cases };
  }

  const detail = await fetchJson<{
    case: OfferCase;
    events: CaseEvent[];
    currentDraft?: OfferDraft;
    approvedOffer?: ApprovedOffer;
    handoff?: ProductionHandoff;
  }>(
    `/api/offers/v1/offers/cases/${encodeURIComponent(activeCaseId)}`,
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.offer
  );
  if (detail.case.caseId !== activeCaseId || detail.case.product !== "offer") {
    return { ...emptyOfferWorkspaceState, cases };
  }
  const activeEvents = detail.events.filter((event) => event.caseId === activeCaseId);
  const draftId = artifactIdFromCaseEvents(activeEvents, "OfferDraft");
  const currentDraft = detail.currentDraft && (!draftId || detail.currentDraft.draftId === draftId)
    ? detail.currentDraft
    : draftId
      ? await fetchJson<OfferDraft>(
          `/api/offers/v1/offers/drafts/${encodeURIComponent(draftId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.offer
        ).then((draft) => (draft.draftId === draftId ? draft : undefined))
      : undefined;
  const handoff = detail.handoff
    ?? (detail.case.productionHandoffId
      ? await fetchJson<{ handoff: ProductionHandoff }>(
          `/api/offers/v1/offers/handoffs/${encodeURIComponent(detail.case.productionHandoffId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.offer
        ).then((result) => result.handoff)
      : undefined);
  return {
    cases,
    activeCase: detail.case,
    activeEvents,
    activeSources: sourcesFromCaseEvents(activeEvents),
    ...(currentDraft ? { currentDraft } : {}),
    ...(detail.approvedOffer ? { approvedOffer: detail.approvedOffer } : {}),
    ...(handoff ? { handoff } : {})
  };
}

export async function loadProductionWorkspaceState(activeCaseId?: string): Promise<ProductionWorkspaceState> {
  const { items: cases } = await fetchJson<{ items: CaseSummary[] }>(
    "/api/production/v1/production/cases",
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
  const base: ProductionWorkspaceState = { cases, activeEvents: [], activeSources: [], referencedRecipes: [] };
  if (!activeCaseId) return base;

  const detail = await fetchJson<{
    case: ProductionCase;
    events: CaseEvent[];
    currentDraft?: ProductionDraft;
    approvedProductionSpec?: ApprovedProductionSpec;
  }>(
    `/api/production/v1/production/cases/${encodeURIComponent(activeCaseId)}`,
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
  if (detail.case.caseId !== activeCaseId || detail.case.product !== "production") {
    return { ...emptyProductionWorkspaceState, cases };
  }
  const activeEvents = detail.events.filter((event) => event.caseId === activeCaseId);
  const [currentPlan, currentPurchaseList] = await Promise.all([
    detail.case.currentPlanId
      ? fetchJson<ProductionPlan>(
          `/api/production/v1/production/plans/${encodeURIComponent(detail.case.currentPlanId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.production
        ).then((plan) => (
          plan.planId !== detail.case.currentPlanId ||
          (detail.case.sourceSpecId && plan.eventSpecId !== detail.case.sourceSpecId)
            ? undefined
            : plan
        ))
      : Promise.resolve(undefined),
    detail.case.currentPurchaseListId
      ? fetchJson<PurchaseList>(
          `/api/production/v1/production/purchase-lists/${encodeURIComponent(detail.case.currentPurchaseListId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.production
        ).then((purchaseList) => (
          purchaseList.purchaseListId !== detail.case.currentPurchaseListId ||
          (detail.case.sourceSpecId && purchaseList.eventSpecId !== detail.case.sourceSpecId)
            ? undefined
            : purchaseList
        ))
      : Promise.resolve(undefined)
  ]);
  const recipeIds = (currentPlan?.recipeSelections ?? [])
    .map((selection) => selection.recipeId)
    .filter((recipeId): recipeId is string => Boolean(recipeId));
  const referencedRecipes = await Promise.all(
    [...new Set(recipeIds)].map((recipeId) =>
      fetchJson<Recipe>(
        `/api/production/v1/production/recipes/${encodeURIComponent(recipeId)}`,
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.production
      )
    )
  );
  return {
    ...base,
    activeCase: detail.case,
    activeEvents,
    activeSources: sourcesFromCaseEvents(activeEvents),
    referencedRecipes,
    ...(detail.currentDraft ? { currentDraft: detail.currentDraft } : {}),
    ...(detail.approvedProductionSpec ? { approvedProductionSpec: detail.approvedProductionSpec } : {}),
    ...(currentPlan ? { currentPlan } : {}),
    ...(currentPurchaseList ? { currentPurchaseList } : {})
  };
}

export async function loadOfferWorkspaceHealth(): Promise<ServiceHealth> {
  return fetchJson<ServiceHealth>("/api/offers/health");
}

export async function loadProductionWorkspaceHealth(): Promise<ServiceHealth> {
  return fetchJson<ServiceHealth>("/api/production/health");
}

export async function loadOfferProductData(activeCaseId?: string): Promise<OfferProductData> {
  const [workspace, health] = await Promise.all([
    loadOfferWorkspaceState(activeCaseId),
    loadOfferWorkspaceHealth()
  ]);

  const activeRequestIds = new Set(
    [
      ...workspace.activeSources.map((source) => source.requestId?.trim()),
      ...workspace.activeEvents.map((event) => event.sourceRef?.requestId?.trim())
    ]
      .filter((requestId): requestId is string => Boolean(requestId))
  );
  const activeSpecIds = new Set(
    [
      workspace.currentDraft?.proposedEventSpec?.specId,
      workspace.handoff?.eventSpecSnapshot.specId,
      ...workspace.activeEvents.flatMap((event) => [
        event.artifactId,
        event.revisionRef?.artifactId
      ])
    ].filter((specId): specId is string => Boolean(specId?.trim()))
  );
  const [intakeRequests, acceptedSpecs] = await Promise.all([
    Promise.all([...activeRequestIds].map(async (requestId) => {
      try {
        return await fetchJson<IntakeRequestDetail>(
          `/api/intake/v1/intake/requests/${encodeURIComponent(requestId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.intake
        );
      } catch {
        return undefined;
      }
    })).then((items) => items.filter((item): item is IntakeRequestDetail => item !== undefined)),
    Promise.all([...activeSpecIds].map(async (specId) => {
      try {
        return await fetchJson<AcceptedEventSpec>(
          `/api/intake/v1/intake/specs/${encodeURIComponent(specId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.intake
        );
      } catch {
        return undefined;
      }
    })).then((items) => items.filter((item): item is AcceptedEventSpec => item !== undefined))
  ]);

  return {
    workspace,
    intakeRequests: activeCaseId ? intakeRequests : [],
    acceptedSpecs: activeCaseId ? acceptedSpecs : [],
    offerDrafts: workspace.currentDraft ? [workspace.currentDraft] : [],
    serviceHealth: serviceHealthStateFor("offer", health)
  };
}

export async function loadProductionProductData(
  activeCaseId?: string,
  focusedSpecId?: string
): Promise<ProductionProductData> {
  const [workspace, health] = await Promise.all([
    loadProductionWorkspaceState(activeCaseId),
    loadProductionWorkspaceHealth()
  ]);

  const activeRequestIds = new Set(
    [
      ...workspace.activeSources.map((source) => source.requestId?.trim()),
      ...workspace.activeEvents.map((event) => event.sourceRef?.requestId?.trim())
    ]
      .filter((requestId): requestId is string => Boolean(requestId))
  );
  const activeSpecIds = new Set(
    [
      workspace.activeCase?.sourceSpecId,
      workspace.currentPlan?.eventSpecId,
      workspace.currentPurchaseList?.eventSpecId
    ].filter((specId): specId is string => Boolean(specId?.trim()))
  );
  if (focusedSpecId) activeSpecIds.add(focusedSpecId);
  const [intakeRequests, acceptedSpecs] = await Promise.all([
    Promise.all([...activeRequestIds].map(async (requestId) => {
      try {
        return await fetchJson<IntakeRequestDetail>(
          `/api/intake/v1/intake/requests/${encodeURIComponent(requestId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.intake
        );
      } catch {
        return undefined;
      }
    })).then((items) => items.filter((item): item is IntakeRequestDetail => item !== undefined)),
    Promise.all([...activeSpecIds].map(async (specId) => {
      try {
        return await fetchJson<AcceptedEventSpec>(
          `/api/intake/v1/intake/specs/${encodeURIComponent(specId)}`,
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.intake
        );
      } catch {
        return undefined;
      }
    })).then((items) => items.filter((item): item is AcceptedEventSpec => item !== undefined))
  ]);

  return {
    workspace,
    intakeRequests: activeCaseId ? intakeRequests : [],
    acceptedSpecs: activeCaseId || focusedSpecId ? acceptedSpecs : [],
    productionPlans: workspace.currentPlan ? [workspace.currentPlan] : [],
    purchaseLists: workspace.currentPurchaseList ? [workspace.currentPurchaseList] : [],
    recipes: workspace.referencedRecipes,
    auditEvents: activeCaseId ? auditEntriesFromCaseEvents(workspace.activeEvents) : [],
    serviceHealth: serviceHealthStateFor("production", health)
  };
}

export type DashboardScope = "home" | "offer" | "production";

export async function loadDashboardState(scope: DashboardScope = "home"): Promise<DashboardState> {
  const intakeRequestsPromise = fetchJson<{ items: Array<Record<string, unknown>> }>(
    "/api/intake/v1/intake/requests",
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.intake
  );
  const acceptedSpecsPromise = fetchJson<{ items: Array<Record<string, unknown>> }>(
    "/api/intake/v1/intake/specs",
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.intake
  );

  const offerDraftsPromise = scope === "production"
    ? Promise.resolve({ items: [] as Array<Record<string, unknown>> })
    : fetchJson<{ items: Array<Record<string, unknown>> }>(
        "/api/offers/v1/offers/drafts",
        undefined,
        DEFAULT_MUTATION_ACTOR_NAMES.offer
      );
  const productionPromises = scope === "offer"
    ? {
        plans: Promise.resolve({ items: [] as Array<Record<string, unknown>> }),
        purchaseLists: Promise.resolve({ items: [] as Array<Record<string, unknown>> }),
        recipes: Promise.resolve({ items: [] as Array<Record<string, unknown>> }),
        auditEvents: Promise.resolve({ items: [] as Array<Record<string, unknown>> })
      }
    : {
        plans: fetchJson<{ items: Array<Record<string, unknown>> }>(
          "/api/production/v1/production/plans",
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.production
        ),
        purchaseLists: fetchJson<{ items: Array<Record<string, unknown>> }>(
          "/api/production/v1/production/purchase-lists",
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.production
        ),
        recipes: fetchJson<{ items: Array<Record<string, unknown>> }>(
          "/api/production/v1/production/recipes",
          undefined,
          DEFAULT_MUTATION_ACTOR_NAMES.production
        ),
        auditEvents: fetchJson<{ items: Array<Record<string, unknown>> }>("/api/production/v1/production/audit/events?limit=30", {
          headers: {
            "x-actor-name": AUDIT_OPERATOR_NAME
          }
        })
      };

  const [intakeRequests, acceptedSpecs, offerDrafts, productionPlans, purchaseLists, recipes, auditEvents] = await Promise.all([
    intakeRequestsPromise,
    acceptedSpecsPromise,
    offerDraftsPromise,
    productionPromises.plans,
    productionPromises.purchaseLists,
    productionPromises.recipes,
    productionPromises.auditEvents
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

export async function loadServiceHealth(scope: DashboardScope = "home"): Promise<ServiceHealthState> {
  const intakePromise = fetchJson<ServiceHealth>("/api/intake/health");
  const offersPromise = scope === "production"
    ? Promise.resolve(undefined)
    : fetchJson<ServiceHealth>("/api/offers/health");
  const productionPromise = scope === "offer"
    ? Promise.resolve(undefined)
    : fetchJson<ServiceHealth>("/api/production/health");
  const exportsPromise = fetchJson<ServiceHealth>("/api/exports/health");
  const [intake, offers, production, exportsHealth] = await Promise.all([
    intakePromise,
    offersPromise,
    productionPromise,
    exportsPromise
  ]);

  return {
    intake,
    offers: offers ?? { service: "offer-service", status: "unknown", timestamp: "", counts: {} },
    production: production ?? { service: "production-service", status: "unknown", timestamp: "", counts: {} },
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

export type ProductCaseSummary = {
  caseId: string;
  displayName: string;
  status: string;
};

function caseSearchQuery(search: string): string {
  const normalized = search.normalize("NFKC").replace(/\s+/gu, " ").trim();
  return normalized ? `?search=${encodeURIComponent(normalized)}` : "";
}

export async function loadOfferCaseSummaries(search = ""): Promise<CaseSummary[]> {
  const response = await fetchJson<{ items: CaseSummary[] }>(
    `/api/offers/v1/offers/cases${caseSearchQuery(search)}`,
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.offer
  );
  return response.items;
}

export async function loadProductionCaseSummaries(search = ""): Promise<CaseSummary[]> {
  const response = await fetchJson<{ items: CaseSummary[] }>(
    `/api/production/v1/production/cases${caseSearchQuery(search)}`,
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
  return response.items;
}

export async function copyOfferCase(caseId: string): Promise<{ case: CaseSummary; events: CaseEvent[] }> {
  return fetchJson<{ case: CaseSummary; events: CaseEvent[] }>(
    `/api/offers/v1/offers/cases/${encodeURIComponent(caseId)}/copies`,
    { method: "POST", body: "{}" },
    DEFAULT_MUTATION_ACTOR_NAMES.offer
  );
}

export async function copyProductionCase(caseId: string): Promise<{ case: CaseSummary; events: CaseEvent[] }> {
  return fetchJson<{ case: CaseSummary; events: CaseEvent[] }>(
    `/api/production/v1/production/cases/${encodeURIComponent(caseId)}/copies`,
    { method: "POST", body: "{}" },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export type StoredSourceDocumentSummary = {
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  dataClass: string;
  createdAt: string;
};

export async function uploadSourceDocument(file: File): Promise<StoredSourceDocumentSummary> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch("/api/intake/v1/intake/source-documents", {
    method: "POST",
    body: formData,
    headers: buildHeaders(undefined, false, DEFAULT_MUTATION_ACTOR_NAMES.intake)
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  return (await response.json()) as StoredSourceDocumentSummary;
}

export async function createProductionCase(input: {
  customerName?: string;
  eventTypeLabel?: string;
  eventDate?: string;
  attendeeCount?: number;
} = {}) {
  return fetchJson<{ case: ProductCaseSummary }>("/api/production/v1/production/cases", {
    method: "POST",
    body: JSON.stringify(input)
  }, DEFAULT_MUTATION_ACTOR_NAMES.production);
}

export async function createProductionDraftFromDocument(caseId: string, documentId: string) {
  return fetchJson<{ draft: ProductionDraft }>(
    "/api/production/v1/production/drafts/from-document",
    {
      method: "POST",
      body: JSON.stringify({ caseId, documentId })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function updateAcceptedSpec(
  specId: string,
  input: {
    eventDate?: string;
    eventSchedule?: Array<{ label: string; start?: string; end?: string }>;
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

export async function createOfferCase(input: {
  customerName?: string;
  eventTypeLabel?: string;
  eventDate?: string;
  attendeeCount?: number;
} = {}) {
  return fetchJson<{ case: ProductCaseSummary }>("/api/offers/v1/offers/cases", {
    method: "POST",
    body: JSON.stringify(input)
  }, DEFAULT_MUTATION_ACTOR_NAMES.offer);
}

export async function createOfferFromText(caseId: string, text: string, requestId: string) {
  return fetchJson<Record<string, unknown>>("/api/offers/v1/offers/from-text", {
    method: "POST",
    body: JSON.stringify({ caseId, text, requestId })
  }, DEFAULT_MUTATION_ACTOR_NAMES.offer);
}

export async function createOfferDraftFromRequest(
  caseId: string,
  eventRequest: Record<string, unknown>
) {
  return fetchJson<Record<string, unknown>>("/api/offers/v1/offers/drafts", {
    method: "POST",
    body: JSON.stringify({ ...eventRequest, caseId })
  }, DEFAULT_MUTATION_ACTOR_NAMES.offer);
}

export async function decideOfferDraft(draftId: string, revision: number, variantId: string) {
  return fetchJson<{ approval: Record<string, unknown>; approvedOffer?: { approvedOfferId: string } }>(`/api/offers/v1/offers/drafts/${draftId}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision: "approved", revision, variantId })
  }, DEFAULT_MUTATION_ACTOR_NAMES.offer);
}

export async function createProductionHandoff(approvedOfferId: string) {
  return fetchJson<{ handoff?: { handoffId: string } }>(`/api/offers/v1/offers/approved/${approvedOfferId}/handoffs`, {
    method: "POST", body: "{}"
  }, DEFAULT_MUTATION_ACTOR_NAMES.offer);
}

export async function createProductionCaseFromHandoff(handoffId: string) {
  return fetchJson<{ case: ProductCaseSummary }>(
    `/api/production/v1/production/cases/from-handoff/${encodeURIComponent(handoffId)}`,
    {
      method: "POST",
      body: "{}"
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function createProductionDraftFromHandoff(caseId: string, handoffId: string) {
  return fetchJson<{ draft?: { draftId: string } }>(`/api/production/v1/production/drafts/from-handoff/${encodeURIComponent(handoffId)}`, {
    method: "POST",
    body: JSON.stringify({ caseId })
  }, DEFAULT_MUTATION_ACTOR_NAMES.production);
}

export async function createProductionDraftFromAcceptedEventSpec(
  caseId: string,
  eventSpec: Record<string, unknown>
): Promise<{ draft: ProductionDraft }> {
  const specId = typeof eventSpec.specId === "string" ? eventSpec.specId.trim() : "";
  if (!specId) {
    throw new Error("Event-Spezifikation benötigt eine gültige ID.");
  }

  return fetchJson<{ draft: ProductionDraft }>(
    "/api/production/v1/production/drafts",
    {
      method: "POST",
      body: JSON.stringify({ caseId, specId })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
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

export async function loadProductionDrafts(caseId?: string) {
  const query = caseId ? `?caseId=${encodeURIComponent(caseId)}` : "";
  return fetchJson<ProductionDraftListResponse>(
    `/api/production/v1/production/drafts${query}`,
    undefined,
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function decideProductionDraftReviewCard(
  draftId: string,
  cardId: string,
  decision: Exclude<ProductionDraftReviewDecision, "pending">,
  operatorComment?: string
) {
  return fetchJson<{ draft: ProductionDraft; reviewCard: ProductionDraftReviewCard }>(
    `/api/production/v1/production/drafts/${encodeURIComponent(draftId)}/review-cards/${encodeURIComponent(cardId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        decision,
        ...(operatorComment ? { operatorComment } : {})
      })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function reviseProductionDraft(draftId: string) {
  return fetchJson<{ draft: ProductionDraft }>(
    `/api/production/v1/production/drafts/${encodeURIComponent(draftId)}/revise`,
    {
      method: "POST",
      body: "{}"
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function decideProductionDraft(
  draftId: string,
  decision: "approved" | "rejected",
  comment?: string
) {
  return fetchJson<{
    approval: { approvalRequestId: string; decision: "approved" | "rejected" };
    approvedProductionSpec?: ApprovedProductionSpecSummary;
  }>(
    `/api/production/v1/production/drafts/${encodeURIComponent(draftId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify({ decision, ...(comment?.trim() ? { comment: comment.trim() } : {}) })
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function applyApprovedProductionSpec(approvedProductionSpecId: string) {
  return fetchJson<{
    eventSpec: Record<string, unknown>;
    plan: Record<string, unknown>;
    purchaseList: Record<string, unknown>;
    recipes: Array<Record<string, unknown>>;
  }>(
    `/api/production/v1/production/approved-specs/${encodeURIComponent(approvedProductionSpecId)}/apply`,
    {
      method: "POST",
      body: "{}"
    },
    DEFAULT_MUTATION_ACTOR_NAMES.production
  );
}

export async function prepareProductionDraft(draftId: string) {
  return fetchJson<{ draft: ProductionDraft }>(
    `/api/production/v1/production/drafts/${encodeURIComponent(draftId)}/prepare`,
    { method: "POST", body: "{}" },
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
