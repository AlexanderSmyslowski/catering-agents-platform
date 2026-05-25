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
  canClearProductionWorkspace as canClearProductionWorkspaceFromState,
  countPurchaseListItems,
  formatActiveProductionContextLabel,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatPurchaseZoneStatusLabel,
  selectArchivedProductionItems,
  selectCurrentProductionItems,
  selectFocusedProductionSpec,
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
  loadIntakeRequestDetail,
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
  type IntakeRequestDetail,
  type RecipeReviewDecision,
  type ServiceHealthState
} from "./api.js";
import {
  buildProductionAssumptions,
  buildProductionQuestions,
  getSpecLabel,
  translateServiceForm
} from "./production-language.js";

type AppRoute = "home" | "offer" | "production";

type ComponentEditState = {
  menuCategory: string;
  productionMode: string;
  purchasedElements: string;
  recipeOverrideId: string;
  notes: string;
};

type SpecEditSnapshot = {
  eventType: string;
  eventDate: string;
  attendeeCount: string;
  serviceForm: string;
  menuItems: string;
  components: Array<[string, ComponentEditState]>;
};

function componentEditStateFromMenuItem(item: Record<string, unknown>): ComponentEditState {
  const productionDecision =
    item.productionDecision && typeof item.productionDecision === "object"
      ? (item.productionDecision as Record<string, unknown>)
      : undefined;

  return {
    menuCategory: String(item.menuCategory ?? ""),
    productionMode: String(productionDecision?.mode ?? ""),
    purchasedElements: Array.isArray(productionDecision?.purchasedElements)
      ? productionDecision.purchasedElements.map((entry) => String(entry)).join(", ")
      : "",
    recipeOverrideId: String(item.recipeOverrideId ?? ""),
    notes: String(productionDecision?.notes ?? "")
  };
}

function specEditSnapshotFromSpec(spec: Record<string, unknown>): SpecEditSnapshot {
  const event = spec.event as Record<string, unknown> | undefined;
  const attendees = spec.attendees as Record<string, unknown> | undefined;
  const menuPlan = Array.isArray(spec.menuPlan) ? (spec.menuPlan as Array<Record<string, unknown>>) : [];

  return {
    eventType: String(event?.type ?? ""),
    eventDate: String(event?.date ?? ""),
    attendeeCount: String(attendees?.expected ?? ""),
    serviceForm: String(event?.serviceForm ?? ""),
    menuItems: menuPlan.map((item) => String(item.label ?? "")).filter(Boolean).join(", "),
    components: menuPlan.map((item) => [String(item.componentId), componentEditStateFromMenuItem(item)])
  };
}

function normalizedSpecEditSnapshot(snapshot: SpecEditSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    eventType: snapshot.eventType.trim(),
    eventDate: snapshot.eventDate.trim(),
    attendeeCount: snapshot.attendeeCount.trim(),
    serviceForm: snapshot.serviceForm.trim(),
    menuItems: snapshot.menuItems.trim(),
    components: snapshot.components
      .map(([componentId, state]) => [
        componentId,
        {
          menuCategory: state.menuCategory.trim(),
          productionMode: state.productionMode.trim(),
          purchasedElements: state.purchasedElements.trim(),
          recipeOverrideId: state.recipeOverrideId.trim(),
          notes: state.notes.trim()
        }
      ])
      .sort(([leftId], [rightId]) => String(leftId).localeCompare(String(rightId)))
  });
}

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

function translateReadiness(value?: string): string {
  const labels: Record<string, string> = {
    complete: "vollständig",
    partial: "teilweise vollständig",
    insufficient: "unzureichend"
  };
  return value ? labels[value] ?? value : "-";
}

function formatProductionTimingWindow(spec?: Record<string, unknown>): string {
  const event = asRecord(spec?.event);
  const date = readStringOrNumber(event, ["date"]);
  const schedule = Array.isArray(event?.schedule)
    ? event.schedule
        .map((item) => {
          const slot = asRecord(item);
          const label = readStringOrNumber(slot, ["label"]);
          const start = readStringOrNumber(slot, ["start"]);
          const end = readStringOrNumber(slot, ["end"]);
          if (!start && !end) {
            return "";
          }
          const timing = start && end ? `${start}–${end}` : start ?? end;
          return [label, timing].filter(Boolean).join(" ").trim();
        })
        .filter(Boolean)
    : [];

  if (date && schedule.length > 0) {
    return `Datum: ${date} · Terminfenster: ${schedule.join(", ")}`;
  }
  if (date) {
    return `Datum: ${date}`;
  }
  if (schedule.length > 0) {
    return `Terminfenster: ${schedule.join(", ")}`;
  }
  return "Terminfenster: noch zu bestätigen";
}

function formatStructuredProductionAnswerSummary(spec?: Record<string, unknown>): string | undefined {
  if (!spec) {
    return undefined;
  }

  const event = asRecord(spec.event);
  const attendees = asRecord(spec.attendees);
  const servicePlan = asRecord(spec.servicePlan);
  const parts = [
    readStringOrNumber(event, ["type"])
      ? `Veranstaltung: ${String(readStringOrNumber(event, ["type"]))}`
      : undefined,
    readStringOrNumber(event, ["date"]) ? `Datum: ${String(readStringOrNumber(event, ["date"]))}` : undefined,
    readStringOrNumber(attendees, ["expected"])
      ? `Teilnehmerzahl: ${String(readStringOrNumber(attendees, ["expected"]))} Personen`
      : undefined,
    readStringOrNumber(servicePlan, ["serviceForm"])
      ? `Serviceform: ${translateServiceForm(String(readStringOrNumber(servicePlan, ["serviceForm"])))}`
      : undefined
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : undefined;
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

function extractAcceptedSpecId(payload: Record<string, unknown>): string | undefined {
  const spec = payload.acceptedEventSpec as Record<string, unknown> | undefined;
  const specId = spec?.specId;
  return typeof specId === "string" ? specId : undefined;
}

function getIntakeRequestIdForSpec(spec: Record<string, unknown> | undefined): string | undefined {
  const requestId = spec?.requestId;
  if (typeof requestId === "string" && requestId.trim()) {
    return requestId.trim();
  }

  const sourceLineage = Array.isArray(spec?.sourceLineage) ? spec?.sourceLineage : [];
  const intakeSource = sourceLineage.find((lineage) => {
    const sourceType = String((lineage as Record<string, unknown>)?.sourceType ?? "");
    return sourceType === "manual_input" || sourceType === "pdf" || sourceType === "email";
  }) as Record<string, unknown> | undefined;
  const reference = intakeSource?.reference;
  return typeof reference === "string" && reference.trim() ? reference.trim() : undefined;
}

function extractProductionPlanId(payload: Record<string, unknown>): string | undefined {
  const plan = payload.productionPlan as Record<string, unknown> | undefined;
  const planId = plan?.planId;
  return typeof planId === "string" ? planId : undefined;
}

function channelForFile(file: File): IntakeDocumentChannel {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".eml")) {
    return "email";
  }
  if (lowerName.endsWith(".pdf")) {
    return "pdf_upload";
  }
  return "text";
}

function estimateProcessingDurationMs(file: File): number {
  const fileSizeMb = file.size / (1024 * 1024);
  const estimated = 3500 + fileSizeMb * 1800;
  return Math.max(4000, Math.min(18000, Math.round(estimated)));
}

function trailingNumericRank(value: unknown): number {
  const match = String(value ?? "").match(/(\d{6,})$/);
  return match ? Number(match[1]) : 0;
}

function compareNewestRecordsBy(key: string) {
  return (left: Record<string, unknown>, right: Record<string, unknown>) =>
    trailingNumericRank(right[key]) - trailingNumericRank(left[key]);
}

function estimatePlanningDurationMs(spec: Record<string, unknown>): number {
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];
  const baseDuration = 4500;
  const perComponent = menuPlan.length * 2200;
  return Math.max(6000, Math.min(30000, baseDuration + perComponent));
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
  const [intakeRequestDetail, setIntakeRequestDetail] = useState<IntakeRequestDetail | null>(null);
  const [intakeRequestDetailError, setIntakeRequestDetailError] = useState<string>();
  const [operatorName, setOperatorName] = useState(() => readOperatorName());
  const [intakeText, setIntakeText] = useState(
    "Konferenz am 2026-06-18 für 90 Teilnehmer mit Lunchbuffet, Tomatensuppe und Kaffeestation."
  );
  const [manualEventType, setManualEventType] = useState("conference");
  const [manualEventDate, setManualEventDate] = useState("");
  const [manualAttendeeCount, setManualAttendeeCount] = useState("");
  const [manualServiceForm, setManualServiceForm] = useState("buffet");
  const [manualMenuItems, setManualMenuItems] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualVenueName, setManualVenueName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [intakeChannel, setIntakeChannel] = useState<IntakeDocumentChannel>("pdf_upload");
  const [offerText, setOfferText] = useState(
    "Besprechung am 2026-06-25 für 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
  );
  const [recipeName, setRecipeName] = useState("");
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [editingSpecId, setEditingSpecId] = useState<string>();
  const [dismissedProductionAnswerSpecId, setDismissedProductionAnswerSpecId] = useState<string>();
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [focusedProductionSpecId, setFocusedProductionSpecId] = useState<string>();
  const [productionWorkspaceCleared, setProductionWorkspaceCleared] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [activeDocumentName, setActiveDocumentName] = useState<string>();
  const [documentPhase, setDocumentPhase] = useState<"idle" | "analysing" | "done">("idle");
  const [documentProgress, setDocumentProgress] = useState(0);
  const [documentEtaSeconds, setDocumentEtaSeconds] = useState<number | undefined>();
  const [documentEstimatedDurationMs, setDocumentEstimatedDurationMs] = useState(0);
  const [documentStartedAt, setDocumentStartedAt] = useState<number | undefined>();
  const [planPhase, setPlanPhase] = useState<"idle" | "planning" | "done">("idle");
  const [planProgress, setPlanProgress] = useState(0);
  const [planEtaSeconds, setPlanEtaSeconds] = useState<number | undefined>();
  const [planEstimatedDurationMs, setPlanEstimatedDurationMs] = useState(0);
  const [planStartedAt, setPlanStartedAt] = useState<number | undefined>();
  const [planningSpecLabel, setPlanningSpecLabel] = useState<string>();
  const [editingEventType, setEditingEventType] = useState("");
  const [editingEventDate, setEditingEventDate] = useState("");
  const [editingAttendeeCount, setEditingAttendeeCount] = useState("");
  const [editingServiceForm, setEditingServiceForm] = useState("");
  const [editingMenuItems, setEditingMenuItems] = useState("");
  const [editingComponentStates, setEditingComponentStates] = useState<Record<string, ComponentEditState>>({});
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

  const focusedProductionSpec = useMemo(
    () =>
      selectFocusedProductionSpec({
        acceptedSpecs: dashboard.acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId,
        productionWorkspaceCleared,
        route,
        searchText: deferredSearch
      }),
    [dashboard.acceptedSpecs, deferredSearch, filteredSpecs, focusedProductionSpecId, productionWorkspaceCleared, route]
  );

  const currentIntakeRequestId = useMemo(() => {
    if (route !== "production" || !focusedProductionSpec) {
      return undefined;
    }

    return getIntakeRequestIdForSpec(focusedProductionSpec as Record<string, unknown>);
  }, [focusedProductionSpec, route]);

  useEffect(() => {
    if (!currentIntakeRequestId) {
      setIntakeRequestDetail(null);
      setIntakeRequestDetailError(undefined);
      return;
    }

    let cancelled = false;
    setIntakeRequestDetail(null);
    setIntakeRequestDetailError(undefined);

    void loadIntakeRequestDetail(currentIntakeRequestId)
      .then((detail) => {
        if (!cancelled) {
          setIntakeRequestDetail(detail);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setIntakeRequestDetailError(
            `Die ursprüngliche Intake-Anfrage konnte nicht geladen werden: ${String(
              (fetchError as Error).message ?? fetchError
            )}`
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentIntakeRequestId]);

  const focusedProductionSpecRecord = focusedProductionSpec as Record<string, unknown> | undefined;
  const focusedProductionSpecServicePlan =
    focusedProductionSpecRecord?.servicePlan && typeof focusedProductionSpecRecord.servicePlan === "object"
      ? (focusedProductionSpecRecord.servicePlan as Record<string, unknown>)
      : undefined;
  const focusedProductionSpecAttendees =
    focusedProductionSpecRecord?.attendees && typeof focusedProductionSpecRecord.attendees === "object"
      ? (focusedProductionSpecRecord.attendees as Record<string, unknown>)
      : undefined;
  const focusedProductionSpecMenuPlan = Array.isArray(focusedProductionSpecRecord?.menuPlan)
    ? focusedProductionSpecRecord.menuPlan
    : undefined;

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
      productionWorkspaceCleared
        ? undefined
        : currentSpecPlans.find((plan) => String(plan.planId) === selectedPlanId) ??
          orderedPlans.find((plan) => String(plan.planId) === selectedPlanId) ??
          currentSpecPlans[0] ??
          (currentProductionSpecId ? undefined : orderedPlans[0]),
    [currentProductionSpecId, currentSpecPlans, orderedPlans, productionWorkspaceCleared, selectedPlanId]
  );

  const selectedPlanSpec = useMemo(() => {
    if (!selectedPlan) {
      return undefined;
    }
    return specById.get(String(selectedPlan.eventSpecId ?? ""));
  }, [selectedPlan, specById]);

  const selectedPlanComponentsById = useMemo(() => {
    const menuPlan = Array.isArray(selectedPlanSpec?.menuPlan) ? selectedPlanSpec.menuPlan : [];
    return new Map(
      menuPlan.map((entry) => {
        const component = entry as Record<string, unknown>;
        return [String(component.componentId ?? ""), component] as const;
      })
    );
  }, [selectedPlanSpec]);

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
    () =>
      productionConversationProjection.messages.reduce(
        (counts, message) => {
          if (message.clarificationAnswerStatus === "answered") {
            counts.answered += 1;
          } else if (message.clarificationAnswerStatus === "unanswered") {
            counts.unanswered += 1;
          }
          return counts;
        },
        { answered: 0, unanswered: 0 }
      ),
    [productionConversationProjection.messages]
  );

  const workbenchSpecFacts = useMemo(() => {
    if (!focusedProductionSpecRecord) {
      return [];
    }

    return [
      {
        label: "Status",
        value: translateReadiness(
          String((focusedProductionSpecRecord.readiness as Record<string, unknown> | undefined)?.status ?? "-")
        )
      },
      {
        label: "Zeit",
        value: formatProductionTimingWindow(focusedProductionSpecRecord)
      },
      {
        label: "Gäste",
        value: `${String(focusedProductionSpecAttendees?.expected ?? "-")} Personen`
      },
      {
        label: "Service",
        value: translateServiceForm(String(focusedProductionSpecServicePlan?.serviceForm ?? ""))
      },
      {
        label: "Menü",
        value: `${focusedProductionSpecMenuPlan?.length ?? 0} Komponenten`
      }
    ];
  }, [focusedProductionSpecAttendees, focusedProductionSpecMenuPlan, focusedProductionSpecRecord, focusedProductionSpecServicePlan]);

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
  const hasFocusedSpecEditChanges = useMemo(() => {
    if (!focusedProductionSpec || editingSpecId !== String(focusedProductionSpec.specId ?? "")) {
      return false;
    }

    const baseline = specEditSnapshotFromSpec(focusedProductionSpec as Record<string, unknown>);
    const current: SpecEditSnapshot = {
      eventType: editingEventType,
      eventDate: editingEventDate,
      attendeeCount: editingAttendeeCount,
      serviceForm: editingServiceForm,
      menuItems: editingMenuItems,
      components: Object.entries(editingComponentStates)
    };

    return normalizedSpecEditSnapshot(baseline) !== normalizedSpecEditSnapshot(current);
  }, [
    editingAttendeeCount,
    editingComponentStates,
    editingEventDate,
    editingEventType,
    editingMenuItems,
    editingServiceForm,
    editingSpecId,
    focusedProductionSpec
  ]);

  useEffect(() => {
    if (documentPhase !== "analysing" || !documentStartedAt || documentEstimatedDurationMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - documentStartedAt;
      const ratio = Math.min(elapsed / documentEstimatedDurationMs, 0.92);
      const remainingMs = Math.max(documentEstimatedDurationMs - elapsed, 500);
      setDocumentProgress(Math.max(8, Math.round(ratio * 100)));
      setDocumentEtaSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
    }, 180);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [documentEstimatedDurationMs, documentPhase, documentStartedAt]);

  useEffect(() => {
    if (planPhase !== "planning" || !planStartedAt || planEstimatedDurationMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - planStartedAt;
      const ratio = Math.min(elapsed / planEstimatedDurationMs, 0.92);
      const remainingMs = Math.max(planEstimatedDurationMs - elapsed, 700);
      setPlanProgress(Math.max(12, Math.round(ratio * 100)));
      setPlanEtaSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
    }, 180);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [planEstimatedDurationMs, planPhase, planStartedAt]);

  function clearMessages() {
    setError(undefined);
    setNotice(undefined);
  }

  function resetProductionWorkspaceState() {
    setProductionWorkspaceCleared(true);
    setIntakeFile(null);
    setDragActive(false);
    setActiveDocumentName(undefined);
    setDocumentPhase("idle");
    setDocumentProgress(0);
    setDocumentEtaSeconds(undefined);
    setDocumentEstimatedDurationMs(0);
    setDocumentStartedAt(undefined);
    setFocusedProductionSpecId(undefined);
    setSelectedPlanId(undefined);
    setPlanPhase("idle");
    setPlanProgress(0);
    setPlanEtaSeconds(undefined);
    setPlanEstimatedDurationMs(0);
    setPlanStartedAt(undefined);
    setPlanningSpecLabel(undefined);
    setIntakeRequestDetail(null);
    setIntakeRequestDetailError(undefined);
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
    const estimatedDurationMs = estimateProcessingDurationMs(file);
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    setIntakeFile(file);
    setIntakeChannel(channel);
    setActiveDocumentName(file.name);
    setDocumentPhase("analysing");
    setDocumentProgress(8);
    setDocumentEtaSeconds(Math.max(1, Math.ceil(estimatedDurationMs / 1000)));
    setDocumentEstimatedDurationMs(estimatedDurationMs);
    setDocumentStartedAt(Date.now());
    setNotice(`Dokument ${file.name} wird analysiert...`);

    try {
      const response = await createAcceptedSpecFromDocument(file, channel);
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      setIntakeFile(null);
      setDragActive(false);
      setDocumentPhase("done");
      setDocumentProgress(100);
      setDocumentEtaSeconds(0);
      await refreshDashboard();
      setNotice(`Dokument ${file.name} wurde übernommen und analysiert.`);
    } catch (submitError) {
      setIntakeFile(file);
      setDocumentPhase("idle");
      setDocumentProgress(0);
      setDocumentEtaSeconds(undefined);
      setDocumentEstimatedDurationMs(0);
      setDocumentStartedAt(undefined);
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
      const response = await createAcceptedSpecFromManualForm({
        eventType: manualEventType.trim() || undefined,
        eventDate: manualEventDate.trim() || undefined,
        attendeeCount: manualAttendeeCount.trim() ? Number(manualAttendeeCount) : undefined,
        serviceForm: manualServiceForm.trim() || undefined,
        menuItems: manualMenuItems
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        customerName: manualCustomerName.trim() || undefined,
        venueName: manualVenueName.trim() || undefined,
        notes: manualNotes.trim() || undefined
      });
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      setManualEventDate("");
      setManualAttendeeCount("");
      setManualMenuItems("");
      setManualCustomerName("");
      setManualVenueName("");
      setManualNotes("");
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
      const estimatedDurationMs = estimatePlanningDurationMs(specForPlanning);
      setPlanningSpecLabel(specLabel);
      setPlanPhase("planning");
      setPlanProgress(12);
      setPlanEtaSeconds(Math.max(1, Math.ceil(estimatedDurationMs / 1000)));
      setPlanEstimatedDurationMs(estimatedDurationMs);
      setPlanStartedAt(Date.now());
      setSelectedPlanId(undefined);
      setNotice("Rezeptsuche, Produktionsplanung und Einkaufsberechnung laufen...");
      const response = await createProductionPlan(specForPlanning);
      const planId = extractProductionPlanId(response);
      if (planId) {
        setSelectedPlanId(planId);
      }
      await refreshDashboard();
      setPlanPhase("done");
      setPlanProgress(100);
      setPlanEtaSeconds(0);
      setNotice("Produktionsplan wurde erzeugt.");
    } catch (submitError) {
      setPlanPhase("idle");
      setPlanProgress(0);
      setPlanEtaSeconds(undefined);
      setPlanEstimatedDurationMs(0);
      setPlanStartedAt(undefined);
      setError(
        submitError instanceof Error ? submitError.message : "Produktionsplan konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function loadSpecIntoEditor(spec: Record<string, unknown>) {
    const snapshot = specEditSnapshotFromSpec(spec);
    const nextComponentStates = Object.fromEntries(snapshot.components);

    setEditingSpecId(String(spec.specId));
    setProductionWorkspaceCleared(false);
    setDismissedProductionAnswerSpecId(undefined);
    setFocusedProductionSpecId(String(spec.specId));
    setEditingEventType(snapshot.eventType);
    setEditingEventDate(snapshot.eventDate);
    setEditingAttendeeCount(snapshot.attendeeCount);
    setEditingServiceForm(snapshot.serviceForm);
    setEditingMenuItems(snapshot.menuItems);
    setEditingComponentStates(nextComponentStates);
  }

  function beginSpecEdit(spec: Record<string, unknown>) {
    loadSpecIntoEditor(spec);
  }

  function resetSpecEdit(markDismissed = true) {
    if (markDismissed) {
      setDismissedProductionAnswerSpecId(editingSpecId);
    } else {
      setDismissedProductionAnswerSpecId(undefined);
    }
    setEditingSpecId(undefined);
    setEditingEventType("");
    setEditingEventDate("");
    setEditingAttendeeCount("");
    setEditingServiceForm("");
    setEditingMenuItems("");
    setEditingComponentStates({});
  }

  function updateEditingComponentState(componentId: string, patch: Partial<ComponentEditState>) {
    setEditingComponentStates((current) => ({
      ...current,
      [componentId]: {
        menuCategory: current[componentId]?.menuCategory ?? "",
        productionMode: current[componentId]?.productionMode ?? "",
        purchasedElements: current[componentId]?.purchasedElements ?? "",
        recipeOverrideId: current[componentId]?.recipeOverrideId ?? "",
        notes: current[componentId]?.notes ?? "",
        ...patch
      }
    }));
  }

  function buildCurrentSpecUpdateInput() {
    const componentUpdates: Parameters<typeof updateAcceptedSpec>[1]["componentUpdates"] =
      Object.entries(editingComponentStates).map(([componentId, state]) => ({
        componentId,
        menuCategory:
          state.menuCategory === "classic" ||
          state.menuCategory === "vegetarian" ||
          state.menuCategory === "vegan"
            ? state.menuCategory
            : undefined,
        productionMode:
          state.productionMode === "scratch" ||
          state.productionMode === "hybrid" ||
          state.productionMode === "convenience_purchase" ||
          state.productionMode === "external_finished"
            ? state.productionMode
            : undefined,
        purchasedElements: state.purchasedElements
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        recipeOverrideId: state.recipeOverrideId.trim() || "",
        notes: state.notes.trim() || undefined
      }));

    return {
      eventType: editingEventType.trim() || undefined,
      eventDate: editingEventDate.trim() || undefined,
      serviceForm: editingServiceForm.trim() || undefined,
      attendeeCount: editingAttendeeCount.trim() ? Number(editingAttendeeCount) : undefined,
      menuItems: editingMenuItems
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      componentUpdates
    };
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
          readinessLabel={translateReadiness(
            String((focusedProductionSpec?.readiness as Record<string, unknown> | undefined)?.status ?? "-")
          )}
          planStatusLabel={
            selectedPlan
              ? translateReadiness(String((selectedPlan.readiness as Record<string, unknown> | undefined)?.status ?? "-"))
              : "offen"
          }
          purchaseStatusLabel={purchaseZoneStatusLabel}
          nextStepTitle={productionNextStep.title}
          nextStepDescription={productionNextStep.description}
          questionCount={productionQuestions.length}
          answeredQuestionCount={clarificationStatusCounts.answered}
          unansweredQuestionCount={clarificationStatusCounts.unanswered}
          productionObjectCount={currentSpecPlans.length}
          productionObjectStatusLabel={
            selectedPlan
              ? `${currentSpecPlans.length} Plan(e) · ${translateReadiness(
                  String((selectedPlan.readiness as Record<string, unknown> | undefined)?.status ?? "-")
                )}`
              : currentSpecPlans.length > 0
                ? `${currentSpecPlans.length} Plan(e)`
                : "noch kein Plan"
          }
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
          focusedSpecReadinessLabel={translateReadiness(
            String((focusedProductionSpec?.readiness as Record<string, unknown> | undefined)?.status ?? "-")
          )}
          selectedPlan={selectedPlan}
          selectedPlanReadinessLabel={
            selectedPlan
              ? translateReadiness(String((selectedPlan.readiness as Record<string, unknown> | undefined)?.status ?? "-"))
              : undefined
          }
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
