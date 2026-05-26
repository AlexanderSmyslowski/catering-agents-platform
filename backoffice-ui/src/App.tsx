import {
  startTransition,
  type ChangeEvent,
  type DragEvent,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from "react";
import { buildProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";
import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";
import { OfferConversationalWorkbench } from "./offer-workbench.js";
import { formatDocumentIngestionSummary } from "./production-question-panel.js";
import { ProductionRouteFilterPanel } from "./production-route-filter-panel.js";
import { ProductionRouteMainLayout } from "./production-route-main-layout.js";
import {
  buildWorkbenchSpecFacts,
  buildProductionPlanComponentMap,
  canClearProductionWorkspace as canClearProductionWorkspaceFromState,
  countClarificationAnswerStatuses,
  countPurchaseListItems,
  formatActiveProductionContextLabel,
  formatProductionObjectStatusLabel,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatProductionPlanStatusLabel,
  formatProductionReadinessLabel,
  formatStructuredProductionAnswerSummary,
  formatProductionTimingWindow,
  formatPurchaseZoneStatusLabel,
  selectArchivedProductionItems,
  selectProductionArtifactSpecIds,
  selectCurrentProductionItems,
  selectFocusedProductionSpec,
  selectProductionIntakeRequestId,
  selectProductionPlanSpec,
  selectProductionWorkbenchPlan,
  selectProductionNextStep
} from "./production-route-state.js";
import {
  archiveIntakeRequest,
  createAcceptedSpecFromDocument,
  createAcceptedSpecFromManualForm,
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionPlan,
  loadDashboardState,
  loadServiceHealth,
  persistOperatorName,
  promoteOfferDraft,
  readOperatorName,
  reviewRecipe,
  seedDemoData,
  updateAcceptedSpec,
  uploadRecipeFile,
  type DashboardState,
  type IntakeDocumentChannel,
  type RecipeReviewDecision,
  type ServiceHealthState
} from "./api.js";
import {
  buildProductionAssumptions,
  buildProductionQuestions,
  getSpecLabel
} from "./production-language.js";
import {
  extractAcceptedSpecId,
  extractProductionPlanId
} from "./production-api-response-ids.js";
import { channelForFile } from "./production-document-channel.js";
import { useProductionSpecEditor } from "./use-production-spec-editor.js";
import { useProductionDocumentProgress } from "./use-production-document-progress.js";
import { useProductionIntakeDraft } from "./use-production-intake-draft.js";
import { useProductionIntakeRequestDetail } from "./use-production-intake-request-detail.js";
import { useProductionManualSpecForm } from "./use-production-manual-spec-form.js";
import { useProductionPlanProgress } from "./use-production-plan-progress.js";

type AppRoute = "home" | "offer" | "production";

const emptyState: DashboardState = {
  intakeRequests: [],
  acceptedSpecs: [],
  offerDrafts: [],
  productionPlans: [],
  purchaseLists: [],
  recipes: [],
  auditEvents: []
};

const emptyHealth: ServiceHealthState = {
  intake: {
    service: "intake-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  offers: {
    service: "offer-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  production: {
    service: "production-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  exports: {
    service: "print-export",
    status: "unknown",
    timestamp: "",
    counts: {}
  }
};

function detectRoute(pathname: string): AppRoute {
  if (pathname.startsWith("/angebot")) {
    return "offer";
  }
  if (pathname.startsWith("/produktion")) {
    return "production";
  }
  return "home";
}

function getPathname(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return window.location.pathname;
}

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
}

function translateHealthStatus(value?: string): string {
  const labels: Record<string, string> = {
    ok: "bereit",
    unknown: "unbekannt"
  };
  return value ? labels[value] ?? value : "-";
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "Keine Zähler";
  }

  const labels: Record<string, string> = {
    requests: "Anfragen",
    acceptedSpecs: "Spezifikationen",
    offerDrafts: "Angebotsentwürfe",
    productionPlans: "Produktionspläne",
    purchaseLists: "Einkaufslisten",
    recipes: "Rezepte",
    auditEvents: "Änderungen"
  };

  return entries.map(([label, value]) => `${labels[label] ?? label}: ${value}`).join(" · ");
}

function formatLatestIntakeRequest(requests: Array<Record<string, unknown>>): string {
  if (requests.length === 0) {
    return "letzte Erfassung: keine";
  }

  const latestRequest = requests.reduce((latest, request) => {
    const latestTimestamp = Date.parse(
      String((latest.source as Record<string, unknown> | undefined)?.receivedAt ?? "")
    );
    const requestTimestamp = Date.parse(
      String((request.source as Record<string, unknown> | undefined)?.receivedAt ?? "")
    );
    if (Number.isNaN(latestTimestamp)) {
      return request;
    }
    if (Number.isNaN(requestTimestamp)) {
      return latest;
    }
    return requestTimestamp >= latestTimestamp ? request : latest;
  });

  const requestId = String(latestRequest.requestId ?? latestRequest.id ?? "unbekannt");
  const channel = String((latestRequest.source as Record<string, unknown> | undefined)?.channel ?? "-");
  const rawInputs = Array.isArray(latestRequest.rawInputs) ? latestRequest.rawInputs : [];
  const firstInputWithSource = rawInputs.find((input) => {
    const sourceMetadata = asRecord((input as Record<string, unknown>).sourceMetadata);
    return Boolean(readStringOrNumber(sourceMetadata, ["filename"]));
  }) as Record<string, unknown> | undefined;
  const firstInputWithWarning = rawInputs.find((input) =>
    Boolean(formatDocumentIngestionSummary(input as Record<string, unknown>))
  ) as Record<string, unknown> | undefined;
  const sourceFilename = readStringOrNumber(asRecord(firstInputWithSource?.sourceMetadata), ["filename"]);
  const ingestionSummary = firstInputWithWarning ? formatDocumentIngestionSummary(firstInputWithWarning) : undefined;

  return [
    `letzte Erfassung: ${requestId} via ${channel}`,
    sourceFilename ? `Quelle: ${sourceFilename}` : undefined,
    ingestionSummary ? `Ingestion-Warnung: ${ingestionSummary}` : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function formatAuditEventHandoffLabel(event: Record<string, unknown>): string {
  const actor = asRecord(event.actor);
  const parts = [
    readStringOrNumber(event, ["summary", "action", "auditId"]),
    readStringOrNumber(actor, ["name"]),
    readStringOrNumber(event, ["action"]),
    readStringOrNumber(event, ["at"])
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Audit-Eintrag vorhanden";
}

function formatLatestAuditOverviewLabel(event: Record<string, unknown>): string {
  const actor = asRecord(event.actor);
  const summary = readStringOrNumber(event, ["summary", "action", "auditId"]) ?? "Audit-Eintrag vorhanden";
  const parts = [
    summary,
    readStringOrNumber(actor, ["name"]) ? `Actor: ${readStringOrNumber(actor, ["name"])}` : undefined,
    readStringOrNumber(event, ["action"]) ? `Action: ${readStringOrNumber(event, ["action"])}` : undefined,
    readStringOrNumber(event, ["at"])
  ].filter(Boolean);

  return parts.join(" · ");
}

function getRouteTitle(route: AppRoute): string {
  if (route === "offer") {
    return "Angebotsagent";
  }
  if (route === "production") {
    return "Produktionsagent";
  }
  return "Catering-Agenten";
}

function getRouteSubtitle(route: AppRoute): string {
  if (route === "offer") {
    return "Kundenanfrage verstehen, Leistungen strukturieren und daraus belastbare Angebotsentwürfe erzeugen.";
  }
  if (route === "production") {
    return "Ruhige Arbeitsfläche für Rezepte, Produktionspläne und Einkaufslisten.";
  }
  return "Zwei spezialisierte Arbeitsflächen mit gemeinsamem Regelkern und klar getrennten Zuständigkeiten.";
}

function trailingNumericRank(value: unknown): number {
  const match = String(value ?? "").match(/(\d{6,})$/);
  return match ? Number(match[1]) : 0;
}

function compareNewestRecordsBy(key: string) {
  return (left: Record<string, unknown>, right: Record<string, unknown>) =>
    trailingNumericRank(right[key]) - trailingNumericRank(left[key]);
}

export function App() {
  const route = useMemo(() => detectRoute(getPathname()), []);
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyHealth);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [operatorName, setOperatorName] = useState(() => readOperatorName());
  const [offerText, setOfferText] = useState(
    "Besprechung am 2026-06-25 für 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
  );
  const [recipeName, setRecipeName] = useState("");
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [focusedProductionSpecId, setFocusedProductionSpecId] = useState<string>();
  const [productionWorkspaceCleared, setProductionWorkspaceCleared] = useState(false);
  const {
    intakeText,
    setIntakeText,
    intakeFile,
    setIntakeFile,
    intakeChannel,
    setIntakeChannel,
    dragActive,
    setDragActive,
    resetIntakeDraft,
    startIncomingProductionFile,
    completeIncomingProductionFile,
    failIncomingProductionFile
  } = useProductionIntakeDraft();
  const {
    activeDocumentName,
    documentPhase,
    documentProgress,
    documentEtaSeconds,
    resetDocumentProgress,
    startDocumentProgress,
    completeDocumentProgress,
    failDocumentProgress
  } = useProductionDocumentProgress();
  const {
    planPhase,
    planningSpecLabel,
    planProgress,
    planEtaSeconds,
    resetPlanProgress,
    startPlanProgress,
    completePlanProgress,
    failPlanProgress
  } = useProductionPlanProgress();
  const {
    manualEventType,
    manualEventDate,
    manualAttendeeCount,
    manualServiceForm,
    manualMenuItems,
    manualCustomerName,
    manualVenueName,
    manualNotes,
    setManualEventType,
    setManualEventDate,
    setManualAttendeeCount,
    setManualServiceForm,
    setManualMenuItems,
    setManualCustomerName,
    setManualVenueName,
    setManualNotes,
    buildCurrentManualSpecInput,
    resetManualSpecDraft
  } = useProductionManualSpecForm();
  const deferredSearch = useDeferredValue(search);
  const productionUploadInputRef = useRef<HTMLInputElement | null>(null);

  const refreshDashboard = useEffectEvent(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const [state, health] = await Promise.all([loadDashboardState(), loadServiceHealth()]);
      startTransition(() => {
        setDashboard(state);
        setServiceHealth(health);
        setLoading(false);
      });
    } catch (refreshError) {
      setLoading(false);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Arbeitsoberfläche konnte nicht geladen werden."
      );
    }
  });

  useEffect(() => {
    void refreshDashboard();
  }, []);

  const filteredSpecs = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.acceptedSpecs;
    }
    return dashboard.acceptedSpecs.filter((spec) =>
      JSON.stringify(spec).toLowerCase().includes(query)
    );
  }, [dashboard.acceptedSpecs, deferredSearch]);

  const filteredPlans = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.productionPlans;
    }
    return dashboard.productionPlans.filter((plan) =>
      JSON.stringify(plan).toLowerCase().includes(query)
    );
  }, [dashboard.productionPlans, deferredSearch]);

  const filteredAuditEvents = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.auditEvents;
    }
    return dashboard.auditEvents.filter((entry) =>
      JSON.stringify(entry).toLowerCase().includes(query)
    );
  }, [dashboard.auditEvents, deferredSearch]);

  const filteredOfferDrafts = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.offerDrafts;
    }
    return dashboard.offerDrafts.filter((draft) =>
      JSON.stringify(draft).toLowerCase().includes(query)
    );
  }, [dashboard.offerDrafts, deferredSearch]);

  const filteredRecipes = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.recipes;
    }
    return dashboard.recipes.filter((recipe) =>
      JSON.stringify(recipe).toLowerCase().includes(query)
    );
  }, [dashboard.recipes, deferredSearch]);

  const recipeReviewCounts = useMemo(() => {
    return dashboard.recipes.reduce(
      (counts: { approved: number; reviewRequired: number; rejected: number }, recipe) => {
        const approvalState = String((recipe.source as Record<string, unknown> | undefined)?.approvalState ?? "");
        if (approvalState === "approved_internal") {
          counts.approved += 1;
        } else if (approvalState === "review_required") {
          counts.reviewRequired += 1;
        } else if (approvalState === "rejected") {
          counts.rejected += 1;
        }
        return counts;
      },
      { approved: 0, reviewRequired: 0, rejected: 0 }
    );
  }, [dashboard.recipes]);

  const recipeReviewStatusLabel =
    recipeReviewCounts.reviewRequired > 0
      ? `${recipeReviewCounts.reviewRequired} zu prüfen`
      : "keine offene Prüfung";

  const recipeUsageStatusLabel =
    recipeReviewCounts.approved > 0
      ? "Freigegebene Rezepte bleiben verwendbar"
      : "Noch keine freigegebenen Rezepte im Bestand";

  const offerHandoffCounts = useMemo(() => {
    return dashboard.acceptedSpecs.reduce(
      (counts: { complete: number; partial: number }, spec) => {
        const readiness = String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "");
        if (readiness === "complete") {
          counts.complete += 1;
        } else if (readiness === "partial") {
          counts.partial += 1;
        }
        return counts;
      },
      { complete: 0, partial: 0 }
    );
  }, [dashboard.acceptedSpecs]);

  const latestIntakeRequestSummary = useMemo(
    () => formatLatestIntakeRequest(dashboard.intakeRequests),
    [dashboard.intakeRequests]
  );
  const isInitialHomeLoading =
    route === "home" &&
    loading &&
    dashboard.intakeRequests.length === 0 &&
    dashboard.acceptedSpecs.length === 0 &&
    dashboard.offerDrafts.length === 0 &&
    dashboard.productionPlans.length === 0 &&
    dashboard.purchaseLists.length === 0 &&
    dashboard.recipes.length === 0 &&
    dashboard.auditEvents.length === 0;

  const filteredPurchaseLists = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return dashboard.purchaseLists;
    }
    return dashboard.purchaseLists.filter((purchaseList) =>
      JSON.stringify(purchaseList).toLowerCase().includes(query)
    );
  }, [dashboard.purchaseLists, deferredSearch]);

  const orderedPlans = useMemo(
    () => [...filteredPlans].sort(compareNewestRecordsBy("planId")),
    [filteredPlans]
  );

  const orderedPurchaseLists = useMemo(
    () => [...filteredPurchaseLists].sort(compareNewestRecordsBy("purchaseListId")),
    [filteredPurchaseLists]
  );

  const specById = useMemo(
    () =>
      new Map(
        dashboard.acceptedSpecs.map((spec) => [String(spec.specId ?? ""), spec] as const)
      ),
    [dashboard.acceptedSpecs]
  );

  const selectedDraft = useMemo(
    () => dashboard.offerDrafts.find((draft) => String(draft.draftId) === selectedDraftId),
    [dashboard.offerDrafts, selectedDraftId]
  );

  const activeOfferDraft = selectedDraft ?? filteredOfferDrafts[0];
  const activeOfferSpec =
    filteredSpecs[filteredSpecs.length - 1] ?? dashboard.acceptedSpecs[dashboard.acceptedSpecs.length - 1];

  const productionArtifactSpecIds = useMemo(
    () => selectProductionArtifactSpecIds([...orderedPlans, ...orderedPurchaseLists]),
    [orderedPlans, orderedPurchaseLists]
  );

  const focusedProductionSpec = useMemo(
    () =>
      selectFocusedProductionSpec({
        acceptedSpecs: dashboard.acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId,
        productionArtifactSpecIds,
        productionWorkspaceCleared,
        route,
        searchText: deferredSearch
      }),
    [
      dashboard.acceptedSpecs,
      deferredSearch,
      filteredSpecs,
      focusedProductionSpecId,
      productionArtifactSpecIds,
      productionWorkspaceCleared,
      route
    ]
  );

  const currentIntakeRequestId = useMemo(() => {
    if (route !== "production" || !focusedProductionSpec) {
      return undefined;
    }

    return selectProductionIntakeRequestId(focusedProductionSpec as Record<string, unknown>);
  }, [focusedProductionSpec, route]);

  const {
    intakeRequestDetail,
    intakeRequestDetailError,
    resetIntakeRequestDetail
  } = useProductionIntakeRequestDetail({ currentIntakeRequestId });

  const focusedProductionSpecRecord = focusedProductionSpec as Record<string, unknown> | undefined;
  const {
    editingSpecId,
    dismissedProductionAnswerSpecId,
    editingEventType,
    editingEventDate,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    setEditingEventType,
    setEditingEventDate,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    loadSpecIntoEditor: loadSpecIntoEditorState,
    resetSpecEdit,
    updateEditingComponentState,
    buildCurrentSpecUpdateInput
  } = useProductionSpecEditor({ focusedProductionSpec: focusedProductionSpecRecord });

  const currentProductionSpecId = String(focusedProductionSpec?.specId ?? "");

  const currentSpecPlans = useMemo(() => {
    return selectCurrentProductionItems({
      currentProductionSpecId,
      items: orderedPlans,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPlans, productionWorkspaceCleared]);

  const archivedPlans = useMemo(() => {
    return selectArchivedProductionItems({
      currentProductionSpecId,
      items: orderedPlans,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPlans, productionWorkspaceCleared]);

  const currentSpecPurchaseLists = useMemo(() => {
    return selectCurrentProductionItems({
      currentProductionSpecId,
      items: orderedPurchaseLists,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPurchaseLists, productionWorkspaceCleared]);

  const archivedPurchaseLists = useMemo(() => {
    return selectArchivedProductionItems({
      currentProductionSpecId,
      items: orderedPurchaseLists,
      productionWorkspaceCleared
    });
  }, [currentProductionSpecId, orderedPurchaseLists, productionWorkspaceCleared]);

  const selectedPlan = useMemo(
    () =>
      selectProductionWorkbenchPlan({
        currentProductionSpecId,
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared,
        selectedPlanId
      }),
    [currentProductionSpecId, currentSpecPlans, orderedPlans, productionWorkspaceCleared, selectedPlanId]
  );

  const selectedPlanSpec = useMemo(
    () => selectProductionPlanSpec({ selectedPlan, specsById: specById }),
    [selectedPlan, specById]
  );

  const selectedPlanComponentsById = useMemo(
    () => buildProductionPlanComponentMap(selectedPlanSpec),
    [selectedPlanSpec]
  );

  const productionQuestions = useMemo(
    () => (focusedProductionSpec ? buildProductionQuestions(focusedProductionSpec) : []),
    [focusedProductionSpec]
  );

  const productionAssumptions = useMemo(
    () => buildProductionAssumptions(focusedProductionSpec),
    [focusedProductionSpec]
  );

  const focusedClarificationAnswers = useMemo(
    () =>
      Array.isArray(focusedProductionSpecRecord?.clarificationAnswers)
        ? focusedProductionSpecRecord.clarificationAnswers
        : [],
    [focusedProductionSpecRecord]
  );

  const productionConversationProjection = useMemo(
    () =>
      buildProductionConversationProjection({
        spec: focusedProductionSpec,
        questions: productionQuestions,
        assumptions: productionAssumptions,
        answerSummary: formatStructuredProductionAnswerSummary(focusedProductionSpec),
        clarificationAnswers: focusedClarificationAnswers as Parameters<typeof buildProductionConversationProjection>[0]["clarificationAnswers"],
        sourceInputs: intakeRequestDetail?.rawInputs,
        productionPlans: currentSpecPlans,
        purchaseLists: currentSpecPurchaseLists
      }),
    [
      currentSpecPlans,
      currentSpecPurchaseLists,
      focusedClarificationAnswers,
      focusedProductionSpec,
      intakeRequestDetail?.rawInputs,
      productionAssumptions,
      productionQuestions
    ]
  );

  const clarificationStatusCounts = useMemo(
    () => countClarificationAnswerStatuses(productionConversationProjection.messages),
    [productionConversationProjection.messages]
  );

  const workbenchSpecFacts = useMemo(
    () => buildWorkbenchSpecFacts(focusedProductionSpecRecord),
    [focusedProductionSpecRecord]
  );

  const focusedSpecReadinessLabel = formatProductionReadinessLabel(focusedProductionSpecRecord);
  const selectedPlanReadinessLabel = selectedPlan ? formatProductionReadinessLabel(selectedPlan) : undefined;
  const productionPlanStatusLabel = formatProductionPlanStatusLabel(selectedPlan);
  const productionObjectStatusLabel = formatProductionObjectStatusLabel({
    currentSpecPlanCount: currentSpecPlans.length,
    selectedPlan
  });

  const currentPurchaseListItemCount = useMemo(
    () => countPurchaseListItems(currentSpecPurchaseLists),
    [currentSpecPurchaseLists]
  );

  const purchaseZoneStatusLabel = formatPurchaseZoneStatusLabel({
    purchaseListCount: currentSpecPurchaseLists.length,
    itemCount: currentPurchaseListItemCount
  });

  const productionIntakeOriginLabel = formatProductionIntakeOriginLabel({
    intakeRequestDetail,
    currentIntakeRequestId
  });

  const productionHandoffExportLabel = formatProductionHandoffExportLabel({
    hasSelectedPlan: Boolean(selectedPlan),
    purchaseListCount: currentSpecPurchaseLists.length
  });

  const productionHandoffContextLabel = formatProductionHandoffContextLabel({
    selectedPlan,
    selectedPlanSpec,
    purchaseLists: currentSpecPurchaseLists
  });

  const latestProductionAuditEvent = filteredAuditEvents[0];
  const productionAuditTrailLabel = latestProductionAuditEvent
    ? formatAuditEventHandoffLabel(latestProductionAuditEvent)
    : "keine Audit-Ereignisse geladen";

  const productionNextStep = useMemo(
    () =>
      selectProductionNextStep({
        hasFocusedProductionSpec: Boolean(focusedProductionSpec),
        questionCount: productionQuestions.length,
        hasSelectedPlan: Boolean(selectedPlan),
        purchaseListCount: currentSpecPurchaseLists.length
      }),
    [currentSpecPurchaseLists.length, focusedProductionSpec, productionQuestions.length, selectedPlan]
  );
  const activeProductionContextLabel = formatActiveProductionContextLabel({
    focusedProductionSpecLabel: focusedProductionSpec ? getSpecLabel(focusedProductionSpec) : undefined,
    selectedPlan,
    productionWorkspaceCleared
  });
  const canClearProductionWorkspace = canClearProductionWorkspaceFromState({
    hasFocusedProductionSpec: Boolean(focusedProductionSpec),
    hasSelectedPlan: Boolean(selectedPlan),
    hasIntakeFile: Boolean(intakeFile),
    hasActiveDocumentName: Boolean(activeDocumentName),
    documentPhase,
    planPhase,
    hasFocusedProductionSpecId: Boolean(focusedProductionSpecId),
    hasSelectedPlanId: Boolean(selectedPlanId)
  });
  const canArchiveCurrentIntake = Boolean(currentIntakeRequestId) && !productionWorkspaceCleared;

  function clearMessages() {
    setError(undefined);
    setNotice(undefined);
  }

  function resetProductionWorkspaceState() {
    setProductionWorkspaceCleared(true);
    resetIntakeDraft();
    resetDocumentProgress();
    setFocusedProductionSpecId(undefined);
    setSelectedPlanId(undefined);
    resetPlanProgress();
    resetIntakeRequestDetail();
    resetSpecEdit(false);
    if (productionUploadInputRef.current) {
      productionUploadInputRef.current.value = "";
    }
  }

  function clearProductionWorkspace() {
    resetProductionWorkspaceState();
    clearMessages();
    setNotice("Aktueller Upload wurde verworfen. Rückfragen und Ergebnisse wurden geleert.");
  }

  async function handleArchiveCurrentIntake() {
    if (!currentIntakeRequestId) {
      setError("Kein verknüpfter Intake-Kontext zum Archivieren vorhanden.");
      return;
    }

    const archivedRequestId = currentIntakeRequestId;
    setSubmitting(true);
    clearMessages();
    try {
      await archiveIntakeRequest(archivedRequestId, "wrong_upload");
      resetProductionWorkspaceState();
      await refreshDashboard();
      setNotice(
        `Fehlupload ${archivedRequestId} wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen.`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Fehlupload konnte nicht archiviert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIntakeSubmit() {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromText(intakeText);
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      await refreshDashboard();
      setNotice("Freitext wurde in eine operative Spezifikation überführt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erfassungstext konnte nicht normalisiert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOfferSubmit() {
    setSubmitting(true);
    clearMessages();
    try {
      const response = await createOfferFromText(offerText);
      const createdDraftId = typeof response.draftId === "string" ? response.draftId : undefined;
      if (createdDraftId) {
        setSelectedDraftId(createdDraftId);
      }
      await refreshDashboard();
      setNotice("Angebotsentwurf wurde erstellt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Angebotsentwurf konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIntakeDocumentSubmit() {
    if (!intakeFile) {
      setError("Bitte wähle zuerst ein Dokument aus.");
      return;
    }

    await processIncomingProductionFile(intakeFile, intakeChannel);
  }

  async function processIncomingProductionFile(file: File, channel: IntakeDocumentChannel) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    startIncomingProductionFile(file, channel);
    startDocumentProgress(file);
    setNotice(`Dokument ${file.name} wird analysiert...`);

    try {
      const response = await createAcceptedSpecFromDocument(file, channel);
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      completeIncomingProductionFile();
      completeDocumentProgress();
      await refreshDashboard();
      setNotice(`Dokument ${file.name} wurde übernommen und analysiert.`);
    } catch (submitError) {
      failIncomingProductionFile(file);
      failDocumentProgress();
      setError(
        submitError instanceof Error ? submitError.message : "Dokument konnte nicht normalisiert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSpecSubmit() {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromManualForm(buildCurrentManualSpecInput());
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      resetManualSpecDraft();
      await refreshDashboard();
      setNotice("Manuelle Spezifikation wurde angelegt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Manuelle Spezifikation konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePlan(spec: Record<string, unknown>) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      let specForPlanning = spec;
      const focusedSpecId = String(spec.specId ?? "");

      if (editingSpecId && editingSpecId === focusedSpecId) {
        setNotice("Antworten werden übernommen...");
        const updatedSpec = await persistCurrentSpecEdit({ quiet: true });
        if (updatedSpec) {
          specForPlanning = updatedSpec;
        }
      }

      const specLabel = getSpecLabel(specForPlanning);
      startPlanProgress(specForPlanning, specLabel);
      setSelectedPlanId(undefined);
      setNotice("Rezeptsuche, Produktionsplanung und Einkaufsberechnung laufen...");
      const response = await createProductionPlan(specForPlanning);
      const planId = extractProductionPlanId(response);
      if (planId) {
        setSelectedPlanId(planId);
      }
      await refreshDashboard();
      completePlanProgress();
      setNotice("Produktionsplan wurde erzeugt.");
    } catch (submitError) {
      failPlanProgress();
      setError(
        submitError instanceof Error ? submitError.message : "Produktionsplan konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function loadSpecIntoEditor(spec: Record<string, unknown>) {
    const specId = loadSpecIntoEditorState(spec);
    setProductionWorkspaceCleared(false);
    setFocusedProductionSpecId(specId);
  }

  function beginSpecEdit(spec: Record<string, unknown>) {
    loadSpecIntoEditor(spec);
  }

  async function persistCurrentSpecEdit(options?: { quiet?: boolean }) {
    if (!editingSpecId) {
      return undefined;
    }

    const response = await updateAcceptedSpec(editingSpecId, buildCurrentSpecUpdateInput());
    const updatedSpec = response.acceptedEventSpec;
    const updatedSpecId = String(updatedSpec.specId ?? editingSpecId);
    setProductionWorkspaceCleared(false);
    setFocusedProductionSpecId(updatedSpecId);
    resetSpecEdit(false);
    await refreshDashboard();
    if (!options?.quiet) {
      setNotice("Spezifikation wurde gespeichert.");
    }
    return updatedSpec;
  }

  async function handleSaveSpecEdit() {
    if (!editingSpecId) {
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await persistCurrentSpecEdit();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Spezifikation konnte nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (route !== "production" || !focusedProductionSpec) {
      return;
    }

    const specId = String(focusedProductionSpec.specId ?? "");
    if (!specId) {
      return;
    }

    const readiness = String(
      (focusedProductionSpec.readiness as Record<string, unknown> | undefined)?.status ?? ""
    );
    const shouldAutoOpen = productionQuestions.length > 0 || readiness !== "complete";

    if (
      shouldAutoOpen &&
      editingSpecId !== specId &&
      dismissedProductionAnswerSpecId !== specId
    ) {
      loadSpecIntoEditor(focusedProductionSpec);
    }
  }, [
    dismissedProductionAnswerSpecId,
    editingSpecId,
    focusedProductionSpec,
    productionQuestions.length,
    route
  ]);

  useEffect(() => {
    if (route !== "production") {
      return;
    }

    const handleWindowDragOver = (event: globalThis.DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }
      event.preventDefault();
      setDragActive(true);
    };

    const handleWindowDrop = (event: globalThis.DragEvent) => {
      if (!event.dataTransfer?.files?.length) {
        return;
      }
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files[0];
      setIntakeFile(file);
      void processIncomingProductionFile(file, channelForFile(file));
    };

    const handleWindowDragLeave = (event: globalThis.DragEvent) => {
      if (event.relatedTarget === null) {
        setDragActive(false);
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
    };
  }, [route]);

  async function handlePromoteDraft(draftId: string, variantId?: string) {
    setSubmitting(true);
    clearMessages();
    try {
      await promoteOfferDraft(draftId, variantId);
      await refreshDashboard();
      setNotice("Angebotsvariante wurde als operative Spezifikation übernommen.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Angebotsvariante konnte nicht übernommen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecipeUpload(target: "offer" | "production") {
    if (!recipeFile) {
      setError("Bitte wähle zuerst eine Rezeptdatei aus.");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await uploadRecipeFile(target, recipeFile, recipeName);
      setRecipeFile(null);
      setRecipeName("");
      await refreshDashboard();
      setNotice("Rezeptdatei wurde in die gemeinsame Bibliothek übernommen.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Rezept konnte nicht hochgeladen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSeedDemoData() {
    setSubmitting(true);
    clearMessages();
    try {
      await seedDemoData();
      await refreshDashboard();
      setNotice("Demo-Daten wurden geladen.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Demo-Daten konnten nicht geladen werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecipeReview(
    target: "offer" | "production",
    recipeId: string,
    decision: RecipeReviewDecision
  ) {
    setSubmitting(true);
    clearMessages();
    try {
      await reviewRecipe(target, recipeId, decision);
      await refreshDashboard();
      setNotice("Rezeptprüfung wurde gespeichert.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Rezeptprüfung konnte nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOperatorNameChange(value: string) {
    const persisted = persistOperatorName(value);
    setOperatorName(persisted);
  }

  function handleProductionDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    setIntakeFile(file);
    void processIncomingProductionFile(file, channelForFile(file));
  }

  function handleProductionFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      return;
    }
    setDragActive(false);
    setIntakeFile(nextFile);
    void processIncomingProductionFile(nextFile, channelForFile(nextFile));
    event.target.value = "";
  }

  function openProductionFilePicker() {
    productionUploadInputRef.current?.click();
  }

  const routeCards = [
    {
      href: "/angebot",
      eyebrow: "Angebotsagent",
      title: "Kundenanfrage zu einem belastbaren Angebot verdichten",
      body: "Erfasst Rahmenbedingungen, schlägt Leistungsbausteine vor, formuliert Varianten und erzeugt operative Spezifikationen für die Übergabe.",
      linkLabel: `${baseUrl}/angebot`
    },
    {
      href: "/produktion",
      eyebrow: "Produktionsagent",
      title: "Küchenvorbereitung mit Rezepten und Einkaufslisten steuern",
      body: "Übernimmt operative Daten auch ohne Angebotsagent, recherchiert fehlende Rezepte, skaliert Mengen und liefert Küchen- sowie Beschaffungsunterlagen.",
      linkLabel: `${baseUrl}/produktion`
    }
  ];

  const agentShortcutButtons = [
    {
      href: "/angebot",
      title: "Angebotsagent öffnen",
      description: "Anfragen strukturieren und Angebote erstellen",
      active: route === "offer"
    },
    {
      href: "/produktion",
      title: "Produktionsagent öffnen",
      description: "Rezepte, Küchenplanung und Einkaufslisten",
      active: route === "production"
    }
  ];

  return (
    <DashboardShell
      title={getRouteTitle(route)}
      subtitle={getRouteSubtitle(route)}
      hideKicker={route !== "home"}
      className={
        route === "production"
          ? "app-shell--production-route"
          : route === "offer"
            ? "app-shell--offer-route"
            : undefined
      }
    >
      <section className="masthead-card">
        <div className="masthead-row">
          <nav className="primary-nav" aria-label="Hauptnavigation">
            <a className={route === "home" ? "nav-link active-nav-link" : "nav-link"} href="/">
              Start
            </a>
            <a className={route === "offer" ? "nav-link active-nav-link" : "nav-link"} href="/angebot">
              Angebotsagent
            </a>
            <a
              className={route === "production" ? "nav-link active-nav-link" : "nav-link"}
              href="/produktion"
            >
              Produktionsagent
            </a>
          </nav>
          {route === "home" ? (
            <div className="masthead-actions">
              <input
                className="operator-input"
                placeholder="Bearbeitername"
                value={operatorName}
                onChange={(event) => handleOperatorNameChange(event.target.value)}
              />
              <button disabled={loading || submitting} onClick={() => void handleSeedDemoData()}>
                Demo-Daten laden
              </button>
              <button className="secondary-button" disabled={loading || submitting} onClick={() => void refreshDashboard()}>
                Aktualisieren
              </button>
            </div>
          ) : null}
        </div>
        {route === "home" ? (
          <>
            <div className="agent-shortcuts" aria-label="Direkteinstieg Agenten">
              {agentShortcutButtons.map((button) => (
                <a
                  key={button.href}
                  className={button.active ? "agent-shortcut agent-shortcut--active" : "agent-shortcut"}
                  href={button.href}
                >
                  <strong>{button.title}</strong>
                  <span>{button.description}</span>
                </a>
              ))}
            </div>
            <p className="helper-text">
              <strong>Internes Beta-Kontrollzentrum:</strong> Demo, Erfassung, Angebot, Produktion, Export und Audit
              aus bestehenden Daten prüfen.
            </p>
            <p className="helper-text">
              <strong>Beta-Weg:</strong> Start → Angebot → Produktion → Rückfragen → Exporte/Audit.
            </p>
            <p className="helper-text">
              <strong>Grenze:</strong> nur synthetischer interner Beta-Durchlauf; keine echten Daten, keine Produktionsfreigabe.
            </p>
            <p className="helper-text">
              <strong>Reviewer-Hinweis:</strong> P7-Szenariokarte nutzen; Evidenz als Route, Erwartung, Beobachtung und Beleg notieren.
            </p>
            <p className="helper-text">
              <strong>Rehearsal-Go:</strong> erst nach grünem Status, lokalem Check, manueller UI-Evidenz und Reibungslog.
            </p>
            <p className="helper-text">
              <strong>Pilot-Preflight:</strong> lokal mit Demo-/synthetischen oder nachweisbar anonymisierten Daten prüfen; kein Pilot-Go, kein Deployment und keine echten Daten.
            </p>
            <p className="helper-text">
              <strong>Nächster Einstieg:</strong> zuerst Angebot prüfen, danach Produktion und offene Rückfragen klären.
            </p>
          </>
        ) : null}

        {route === "home" ? (
          <div className="route-grid">
            {routeCards.map((card) => (
              <article key={card.href} className="route-card">
                <p className="eyebrow">{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <p className="route-card__body">{card.body}</p>
                <p className="route-card__link">{card.linkLabel}</p>
                <a className="button-link" href={card.href}>
                  Arbeitsfläche öffnen
                </a>
              </article>
            ))}
          </div>
        ) : route === "production" ? (
          <div className="hero-detail-card">
            <div>
              <p className="eyebrow">Küche und Produktion</p>
              <h2 className="hero-title">
                Produktionsvorbereitung: Rezepte, Küchenplanung und Einkauf.
              </h2>
              <p className="lede">Arbeitsroute für Spezifikationen, Pläne, Rezeptfreigaben und Exporte.</p>
            </div>
            <div className="hero-pills">
              <span className="hero-pill">{`${baseUrl}/produktion`}</span>
              <span className="hero-pill">Gemeinsamer Regelkern</span>
              <span className="hero-pill">Persistente Betriebsdaten</span>
            </div>
          </div>
        ) : null}
      </section>

      {route === "home" ? (
        <section className="metrics-grid">
          <StatusCard
            title="Operative Spezifikationen"
            body={
              isInitialHomeLoading
                ? "Plattformdaten werden geladen; noch kein Datenbestand bewertet."
                : `${dashboard.acceptedSpecs.length} operative Datensätze stehen dienstübergreifend bereit.`
            }
          />
          <StatusCard
            title="Übergabe an Produktion"
            body={
              isInitialHomeLoading
                ? "Übergabe wird geladen; noch keine Übergabe-Bewertung."
                : `${offerHandoffCounts.complete} vollständig · ${offerHandoffCounts.partial} teilweise vollständig`
            }
          />
          <StatusCard
            title="Angebotsentwürfe"
            body={
              isInitialHomeLoading
                ? "Angebotsdaten werden geladen; noch keine Entwurfsbewertung."
                : `${dashboard.offerDrafts.length} kaufmännische Entwürfe können direkt übernommen werden.`
            }
          />
          <StatusCard
            title="Produktionspläne"
            body={
              isInitialHomeLoading
                ? "Produktionsdaten werden geladen; noch keine Plan-/Einkaufslistenbewertung."
                : `${dashboard.productionPlans.length} Küchenpläne · ${dashboard.purchaseLists.length} Einkaufslisten mit Rezept- und Einkaufsbezug sind verfügbar.`
            }
          />
          <StatusCard
            title="Rezeptbibliothek"
            body={
              isInitialHomeLoading
                ? "Rezeptbestand wird geladen; noch keine Review-Bewertung."
                : `${dashboard.recipes.length} Rezepte · ${recipeReviewCounts.approved} intern freigegeben · ${recipeReviewCounts.reviewRequired} Prüfung nötig`
            }
          />
        </section>
      ) : null}

      {route === "production" ? (
        <ProductionRouteFilterPanel
          productionPlanCount={dashboard.productionPlans.length}
          purchaseListCount={dashboard.purchaseLists.length}
          recipeCount={dashboard.recipes.length}
          approvedRecipeCount={recipeReviewCounts.approved}
          reviewRequiredRecipeCount={recipeReviewCounts.reviewRequired}
          productionServiceStatusLabel={translateHealthStatus(serviceHealth.production.status)}
          productionServiceCountsLabel={formatCounts(serviceHealth.production.counts)}
          search={search}
          setSearch={setSearch}
        />
      ) : null}

      {error || notice ? (
        <div className="toast-stack" aria-live="polite">
          {error ? <p className="error-banner">{error}</p> : null}
          {notice ? <p className="notice-banner">{notice}</p> : null}
        </div>
      ) : null}

      {route === "home" ? (
        <section className="wide-grid">
          <article className="panel">
            <header>
              <p className="eyebrow">Systemstatus</p>
              <h3>Gesamtüberblick über die laufenden Dienste</h3>
            </header>
            <div className="metrics-grid compact-metrics">
              <StatusCard
                title="Erfassung"
                body={
                  isInitialHomeLoading
                    ? "Healthcheck läuft · Zähler werden geladen · letzte Erfassung wird geladen"
                    : `${translateHealthStatus(serviceHealth.intake.status)} · ${formatCounts(serviceHealth.intake.counts)} · ${latestIntakeRequestSummary}`
                }
              />
              <StatusCard
                title="Angebot"
                body={
                  isInitialHomeLoading
                    ? "Healthcheck läuft · Zähler werden geladen"
                    : `${translateHealthStatus(serviceHealth.offers.status)} · ${formatCounts(serviceHealth.offers.counts)}`
                }
              />
              <StatusCard
                title="Produktion"
                body={
                  isInitialHomeLoading
                    ? "Healthcheck läuft · Zähler werden geladen"
                    : `${translateHealthStatus(serviceHealth.production.status)} · ${formatCounts(serviceHealth.production.counts)}`
                }
              />
              <StatusCard
                title="Export"
                body={
                  isInitialHomeLoading
                    ? "Healthcheck läuft · Zähler werden geladen"
                    : `${translateHealthStatus(serviceHealth.exports.status)} · ${formatCounts(serviceHealth.exports.counts)}`
                }
              />
            </div>
          </article>

          <article className="panel">
            <header>
              <p className="eyebrow">Änderungsprotokoll</p>
              <h3>Letzte Bearbeitungsschritte über alle Dienste</h3>
              <p className="helper-text">
                {isInitialHomeLoading
                  ? "Änderungen werden geladen; noch kein Audit-/Handoff-Befund."
                  : filteredAuditEvents.length > 0
                  ? `${filteredAuditEvents.length} Änderungen geladen · neueste: ${formatLatestAuditOverviewLabel(
                      filteredAuditEvents[0] as Record<string, unknown>
                    )}`
                  : "Noch keine Änderungen geladen."}
              </p>
              <p className="helper-text">
                Audit-/Handoff-Hinweis: interne Arbeitsbelege für Demo-/Beta-Prüfung; keine externe Freigabe,
                keine Produktionsfreigabe, keine echte-Daten-Freigabe und kein rechtssicherer Compliance-Nachweis.
              </p>
            </header>
            <ul className="item-list compact">
              {filteredAuditEvents.map((entry) => (
                <li key={String(entry.auditId)}>
                  <strong>{String(entry.summary ?? entry.action ?? entry.auditId)}</strong>
                  <p className="helper-text">
                    {String(entry.at ?? "-")} · {String((entry.actor as Record<string, unknown>)?.name ?? "-")} ·{" "}
                    {String(entry.action ?? "-")}
                  </p>
                </li>
              ))}
              {isInitialHomeLoading ? <li>Änderungen werden geladen.</li> : null}
              {!isInitialHomeLoading && filteredAuditEvents.length === 0 ? <li>Noch keine Änderungen vorhanden.</li> : null}
            </ul>
          </article>
        </section>
      ) : null}

      {route === "offer" ? (
        <OfferConversationalWorkbench
          submitting={submitting}
          latestSourceLabel={latestIntakeRequestSummary}
          offerText={offerText}
          setOfferText={setOfferText}
          submitOfferText={handleOfferSubmit}
          intakeText={intakeText}
          setIntakeText={setIntakeText}
          submitIntakeText={handleIntakeSubmit}
          intakeChannel={intakeChannel}
          setIntakeChannel={setIntakeChannel}
          intakeFile={intakeFile}
          setIntakeFile={setIntakeFile}
          submitIntakeDocument={handleIntakeDocumentSubmit}
          manualInput={{
            eventType: manualEventType,
            eventDate: manualEventDate,
            attendeeCount: manualAttendeeCount,
            serviceForm: manualServiceForm,
            menuItems: manualMenuItems,
            customerName: manualCustomerName,
            venueName: manualVenueName,
            notes: manualNotes
          }}
          manualActions={{
            setEventType: setManualEventType,
            setEventDate: setManualEventDate,
            setAttendeeCount: setManualAttendeeCount,
            setServiceForm: setManualServiceForm,
            setMenuItems: setManualMenuItems,
            setCustomerName: setManualCustomerName,
            setVenueName: setManualVenueName,
            setNotes: setManualNotes,
            submitManualSpec: handleManualSpecSubmit
          }}
          filteredOfferDrafts={filteredOfferDrafts}
          activeDraft={activeOfferDraft}
          selectedDraft={selectedDraft}
          setSelectedDraftId={setSelectedDraftId}
          promoteDraft={handlePromoteDraft}
          filteredSpecs={filteredSpecs}
          activeSpec={activeOfferSpec}
          completeSpecCount={offerHandoffCounts.complete}
          partialSpecCount={offerHandoffCounts.partial}
          specEdit={{
            editingSpecId,
            eventType: editingEventType,
            eventDate: editingEventDate,
            attendeeCount: editingAttendeeCount,
            serviceForm: editingServiceForm,
            menuItems: editingMenuItems
          }}
          specEditActions={{
            beginSpecEdit,
            setEventType: setEditingEventType,
            setEventDate: setEditingEventDate,
            setAttendeeCount: setEditingAttendeeCount,
            setServiceForm: setEditingServiceForm,
            setMenuItems: setEditingMenuItems,
            saveSpecEdit: handleSaveSpecEdit,
            resetSpecEdit
          }}
        />
      ) : null}
      {route === "production" ? (
        <ProductionRouteMainLayout
          activeSpecLabel={activeProductionContextLabel}
          readinessLabel={focusedSpecReadinessLabel}
          planStatusLabel={productionPlanStatusLabel}
          purchaseStatusLabel={purchaseZoneStatusLabel}
          nextStepTitle={productionNextStep.title}
          nextStepDescription={productionNextStep.description}
          questionCount={productionQuestions.length}
          answeredQuestionCount={clarificationStatusCounts.answered}
          unansweredQuestionCount={clarificationStatusCounts.unanswered}
          productionObjectCount={currentSpecPlans.length}
          productionObjectStatusLabel={productionObjectStatusLabel}
          purchaseListCount={currentSpecPurchaseLists.length}
          submitting={submitting}
          dragActive={dragActive}
          intakeFile={intakeFile}
          intakeChannel={intakeChannel}
          documentPhase={documentPhase}
          activeDocumentName={activeDocumentName}
          documentProgress={documentProgress}
          documentEtaSeconds={documentEtaSeconds}
          intakeText={intakeText}
          canClearProductionWorkspace={canClearProductionWorkspace}
          canArchiveCurrentIntake={canArchiveCurrentIntake}
          productionUploadInputRef={productionUploadInputRef}
          setDragActive={setDragActive}
          setIntakeChannel={setIntakeChannel}
          setIntakeText={setIntakeText}
          openProductionFilePicker={openProductionFilePicker}
          clearProductionWorkspace={clearProductionWorkspace}
          archiveCurrentIntake={handleArchiveCurrentIntake}
          handleProductionDrop={handleProductionDrop}
          handleProductionFileSelection={handleProductionFileSelection}
          handleIntakeDocumentSubmit={handleIntakeDocumentSubmit}
          handleIntakeSubmit={handleIntakeSubmit}
          manualEventType={manualEventType}
          manualEventDate={manualEventDate}
          manualAttendeeCount={manualAttendeeCount}
          manualServiceForm={manualServiceForm}
          manualMenuItems={manualMenuItems}
          manualCustomerName={manualCustomerName}
          manualVenueName={manualVenueName}
          manualNotes={manualNotes}
          setManualEventType={setManualEventType}
          setManualEventDate={setManualEventDate}
          setManualAttendeeCount={setManualAttendeeCount}
          setManualServiceForm={setManualServiceForm}
          setManualMenuItems={setManualMenuItems}
          setManualCustomerName={setManualCustomerName}
          setManualVenueName={setManualVenueName}
          setManualNotes={setManualNotes}
          handleManualSpecSubmit={handleManualSpecSubmit}
          focusedProductionSpec={focusedProductionSpec}
          focusedSpecReadinessLabel={focusedSpecReadinessLabel}
          selectedPlan={selectedPlan}
          selectedPlanReadinessLabel={selectedPlanReadinessLabel}
          currentSpecPurchaseLists={currentSpecPurchaseLists}
          productionQuestions={productionQuestions}
          productionAssumptions={productionAssumptions}
          productionConversationProjection={productionConversationProjection}
          workbenchSpecFacts={workbenchSpecFacts}
          intakeRequestDetailError={intakeRequestDetailError}
          intakeRequestDetail={intakeRequestDetail}
          editingSpecId={editingSpecId}
          editingEventType={editingEventType}
          editingEventDate={editingEventDate}
          editingAttendeeCount={editingAttendeeCount}
          editingServiceForm={editingServiceForm}
          editingMenuItems={editingMenuItems}
          editingComponentStates={editingComponentStates}
          hasFocusedSpecEditChanges={hasFocusedSpecEditChanges}
          recipes={dashboard.recipes}
          filteredSpecs={filteredSpecs}
          productionWorkspaceCleared={productionWorkspaceCleared}
          setEditingEventType={setEditingEventType}
          setEditingEventDate={setEditingEventDate}
          setEditingAttendeeCount={setEditingAttendeeCount}
          setEditingServiceForm={setEditingServiceForm}
          setEditingMenuItems={setEditingMenuItems}
          updateEditingComponentState={updateEditingComponentState}
          beginSpecEdit={beginSpecEdit}
          handleSaveSpecEdit={handleSaveSpecEdit}
          handleCreatePlan={handleCreatePlan}
          resetSpecEdit={resetSpecEdit}
          openSpecForQuestions={(specId) => {
            setProductionWorkspaceCleared(false);
            setFocusedProductionSpecId(specId);
          }}
          planPhase={planPhase}
          planningSpecLabel={planningSpecLabel}
          planProgress={planProgress}
          planEtaSeconds={planEtaSeconds}
          currentSpecPlans={currentSpecPlans}
          selectedPlanSpec={selectedPlanSpec}
          selectedPlanComponentsById={selectedPlanComponentsById}
          archivedPlans={archivedPlans}
          specById={specById}
          setSelectedPlanId={setSelectedPlanId}
          archivedPurchaseLists={archivedPurchaseLists}
          purchaseZoneStatusLabel={purchaseZoneStatusLabel}
          productionIntakeOriginLabel={productionIntakeOriginLabel}
          productionAuditTrailLabel={productionAuditTrailLabel}
          productionHandoffExportLabel={productionHandoffExportLabel}
          productionHandoffContextLabel={productionHandoffContextLabel}
          recipeReviewStatusLabel={recipeReviewStatusLabel}
          recipeUsageStatusLabel={recipeUsageStatusLabel}
          recipeReviewCounts={recipeReviewCounts}
          recipeCount={dashboard.recipes.length}
          recipeName={recipeName}
          recipeFile={recipeFile}
          filteredRecipes={filteredRecipes}
          setRecipeName={setRecipeName}
          setRecipeFile={setRecipeFile}
          handleRecipeUpload={handleRecipeUpload}
          handleRecipeReview={handleRecipeReview}
        />
      ) : null}

      <footer className="footer-note">
        {loading
          ? "Aktuelle Plattformdaten werden geladen..."
          : "Aktuelle Daten aus Erfassung, Angebot und Produktion wurden geladen."}
      </footer>
    </DashboardShell>
  );
}
