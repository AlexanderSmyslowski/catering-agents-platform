import {
  startTransition,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from "react";
import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";
import {
  archiveAcceptedSpec,
  createAcceptedSpecFromDocument,
  createAcceptedSpecFromManualForm,
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionPlan,
  loadDashboardState,
  loadServiceHealth,
  offerExportUrl,
  persistOperatorName,
  promoteOfferDraft,
  productionExportUrl,
  purchaseListExportUrl,
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
  getSpecLabel,
  translateMenuCategory,
  translateProductionMode,
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

function translateHealthStatus(value?: string): string {
  const labels: Record<string, string> = {
    ok: "bereit",
    unknown: "unbekannt"
  };
  return value ? labels[value] ?? value : "-";
}

function translateRecipeTier(value?: string): string {
  const labels: Record<string, string> = {
    internal_verified: "intern verifiziert",
    digitized_cookbook: "digitalisiertes Kochbuch",
    internal_approved: "intern freigegeben",
    internet_fallback: "Internet-Ausweichquelle"
  };
  return value ? labels[value] ?? value : "-";
}

function translateApprovalState(value?: string): string {
  const labels: Record<string, string> = {
    approved_internal: "intern freigegeben",
    auto_usable: "automatisch nutzbar",
    review_required: "Prüfung nötig",
    rejected: "abgelehnt"
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
    return "Operative Daten, Rezepte, Produktionspläne und Einkaufslisten in einem klaren Küchenarbeitsplatz bündeln.";
  }
  return "Zwei spezialisierte Arbeitsflächen mit gemeinsamem Regelkern und klar getrennten Zuständigkeiten.";
}

function extractAcceptedSpecId(payload: Record<string, unknown>): string | undefined {
  const spec = payload.acceptedEventSpec as Record<string, unknown> | undefined;
  const specId = spec?.specId;
  return typeof specId === "string" ? specId : undefined;
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

function normalizeRecipeSuggestionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function recipeSuggestionsForComponent(
  label: string,
  recipes: Array<Record<string, unknown>>
): Array<{ recipeId: string; name: string }> {
  const tokens = normalizeRecipeSuggestionText(label)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4)
    .filter((token) => !["vegan", "classic", "klassisch", "vegetarian", "vegetarisch", "topping"].includes(token));

  return recipes
    .map((recipe) => {
      const recipeId = String(recipe.recipeId ?? "");
      const name = String(recipe.name ?? recipeId);
      const haystack = normalizeRecipeSuggestionText(
        `${name} ${String((recipe.source as Record<string, unknown> | undefined)?.reference ?? "")}`
      );
      const score = tokens.filter((token) => haystack.includes(token)).length;
      return {
        recipeId,
        name,
        score
      };
    })
    .filter((item) => item.recipeId && item.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "de"))
    .slice(0, 6)
    .map(({ recipeId, name }) => ({ recipeId, name }));
}

function resolveRecipeNameById(
  recipeId: string,
  recipes: Array<Record<string, unknown>>
): string | undefined {
  const match = recipes.find((recipe) => String(recipe.recipeId ?? "") === recipeId);
  if (!match) {
    return undefined;
  }

  const recipeName = String(match.name ?? "").trim();
  return recipeName || recipeId;
}

function paxStatusText(spec?: Record<string, unknown>): string | undefined {
  if (!spec) {
    return undefined;
  }

  const attendees =
    spec.attendees && typeof spec.attendees === "object"
      ? (spec.attendees as Record<string, unknown>)
      : undefined;
  const offerPax =
    typeof attendees?.expected === "number" && Number.isFinite(attendees.expected)
      ? attendees.expected
      : undefined;
  const productionPax =
    typeof attendees?.productionPax === "number" && Number.isFinite(attendees.productionPax)
      ? attendees.productionPax
      : undefined;

  if (productionPax !== undefined) {
    if (offerPax !== undefined) {
      return `Angebots-Pax: ${offerPax}. Produktions-Pax: ${productionPax}. Manuelle Überschreibung aktiv.`;
    }
    return `Produktions-Pax: ${productionPax}. Manuelle Überschreibung aktiv.`;
  }

  if (offerPax !== undefined) {
    return `Angebots-Pax: ${offerPax}. Aktuell wird dieser Wert für Produktion und Einkauf verwendet.`;
  }

  return "Noch kein Angebots-Pax erkannt. Bitte den aktuellen Arbeitswert für Produktion und Einkauf setzen.";
}


function estimateProcessingDurationMs(file: File): number {
  const fileSizeMb = file.size / (1024 * 1024);
  const estimated = 3500 + fileSizeMb * 1800;
  return Math.max(4000, Math.min(18000, Math.round(estimated)));
}

function formatEta(seconds: number): string {
  if (seconds <= 1) {
    return "weniger als 1 Sekunde";
  }
  return `${seconds} Sekunden`;
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

function formatPercent(value?: unknown): string | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return `${Math.round(numeric * 100)} %`;
}

function renderPlanList(
  plans: Array<Record<string, unknown>>,
  specById: Map<string, Record<string, unknown>>,
  submitting: boolean,
  setSelectedPlanId: (planId: string) => void
) {
  return (
    <ul className="item-list compact">
      {plans.map((plan) => {
        const relatedSpec = specById.get(String(plan.eventSpecId ?? ""));
        const unresolvedCount = Array.isArray(plan.unresolvedItems) ? plan.unresolvedItems.length : 0;
        const batchCount = Array.isArray(plan.productionBatches) ? plan.productionBatches.length : 0;
        const sheetCount = Array.isArray(plan.kitchenSheets) ? plan.kitchenSheets.length : 0;
        return (
          <li key={String(plan.planId)}>
            <strong>{relatedSpec ? getSpecLabel(relatedSpec) : "Produktionsplan"}</strong>
            <p>
              Status: {translateReadiness(String((plan.readiness as Record<string, unknown>)?.status ?? "-"))}
              {" · "}Arbeitsblätter: {sheetCount}
              {" · "}Rezeptblätter: {batchCount}
              {" · "}Offene Punkte: {unresolvedCount}
            </p>
            <div className="action-row">
              <button
                className="secondary-button"
                disabled={submitting}
                onClick={() => setSelectedPlanId(String(plan.planId))}
              >
                Einzelheiten
              </button>
            </div>
            <a
              className="ghost-link"
              href={productionExportUrl(String(plan.planId))}
              target="_blank"
              rel="noreferrer"
            >
              Produktionsblatt exportieren
            </a>
          </li>
        );
      })}
      {plans.length === 0 ? <li>Noch keine Produktionspläne vorhanden.</li> : null}
    </ul>
  );
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

  const focusedProductionSpec = useMemo(() => {
    if (productionWorkspaceCleared) {
      return undefined;
    }

    const preferred = focusedProductionSpecId
      ? dashboard.acceptedSpecs.find((spec) => String(spec.specId) === focusedProductionSpecId)
      : undefined;
    return (
      preferred ??
      filteredSpecs[filteredSpecs.length - 1] ??
      dashboard.acceptedSpecs[dashboard.acceptedSpecs.length - 1]
    );
  }, [dashboard.acceptedSpecs, filteredSpecs, focusedProductionSpecId, productionWorkspaceCleared]);

  const currentProductionSpecId = String(focusedProductionSpec?.specId ?? "");

  const currentSpecPlans = useMemo(() => {
    if (productionWorkspaceCleared) {
      return [];
    }

    if (!currentProductionSpecId) {
      return orderedPlans;
    }
    const matchingPlans = orderedPlans.filter(
      (plan) => String(plan.eventSpecId ?? "") === currentProductionSpecId
    );
    return matchingPlans.length > 0 ? matchingPlans : orderedPlans;
  }, [currentProductionSpecId, orderedPlans, productionWorkspaceCleared]);

  const archivedPlans = useMemo(() => {
    if (!currentProductionSpecId || productionWorkspaceCleared) {
      return [];
    }
    return orderedPlans.filter((plan) => String(plan.eventSpecId ?? "") !== currentProductionSpecId);
  }, [currentProductionSpecId, orderedPlans, productionWorkspaceCleared]);

  const currentSpecPurchaseLists = useMemo(() => {
    if (productionWorkspaceCleared) {
      return [];
    }

    if (!currentProductionSpecId) {
      return orderedPurchaseLists;
    }
    const matchingLists = orderedPurchaseLists.filter(
      (purchaseList) => String(purchaseList.eventSpecId ?? "") === currentProductionSpecId
    );
    return matchingLists.length > 0 ? matchingLists : orderedPurchaseLists;
  }, [currentProductionSpecId, orderedPurchaseLists, productionWorkspaceCleared]);

  const archivedPurchaseLists = useMemo(() => {
    if (!currentProductionSpecId || productionWorkspaceCleared) {
      return [];
    }
    return orderedPurchaseLists.filter(
      (purchaseList) => String(purchaseList.eventSpecId ?? "") !== currentProductionSpecId
    );
  }, [currentProductionSpecId, orderedPurchaseLists, productionWorkspaceCleared]);

  const selectedPlan = useMemo(
    () =>
      productionWorkspaceCleared
        ? undefined
        : currentSpecPlans.find((plan) => String(plan.planId) === selectedPlanId) ??
          orderedPlans.find((plan) => String(plan.planId) === selectedPlanId) ??
          currentSpecPlans[0] ??
          orderedPlans[0],
    [currentSpecPlans, orderedPlans, productionWorkspaceCleared, selectedPlanId]
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
    () => buildProductionQuestions(focusedProductionSpec),
    [focusedProductionSpec]
  );

  const productionAssumptions = useMemo(
    () => buildProductionAssumptions(focusedProductionSpec),
    [focusedProductionSpec]
  );

  const currentEditingSpec = useMemo(() => {
    if (!editingSpecId) {
      return undefined;
    }

    return (
      specById.get(editingSpecId) ??
      (editingSpecId === String(focusedProductionSpec?.specId ?? "") ? focusedProductionSpec : undefined)
    );
  }, [editingSpecId, focusedProductionSpec, specById]);

  const editingPaxStatusText = useMemo(
    () => paxStatusText(currentEditingSpec),
    [currentEditingSpec]
  );

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

  function clearProductionWorkspaceView() {
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
    resetSpecEdit(false);
    if (productionUploadInputRef.current) {
      productionUploadInputRef.current.value = "";
    }
    clearMessages();
  }

  async function clearProductionWorkspace() {
    const specIdToArchive =
      editingSpecId ||
      String(focusedProductionSpec?.specId ?? "").trim() ||
      focusedProductionSpecId;

    setSubmitting(true);
    clearMessages();
    try {
      if (specIdToArchive) {
        await archiveAcceptedSpec(specIdToArchive, "Vom Bediener als Fehlupload verworfen.");
        await refreshDashboard();
      }
      clearProductionWorkspaceView();
      setNotice("Aktueller Upload wurde verworfen. Rückfragen und Ergebnisse wurden geleert.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Vorgang konnte nicht verworfen werden."
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
      await createOfferFromText(offerText);
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
    const event = spec.event as Record<string, unknown> | undefined;
    const attendees = spec.attendees as Record<string, unknown> | undefined;
    const menuPlan = Array.isArray(spec.menuPlan) ? (spec.menuPlan as Array<Record<string, unknown>>) : [];
    const nextComponentStates = Object.fromEntries(
      menuPlan.map((item) => {
        const productionDecision =
          item.productionDecision && typeof item.productionDecision === "object"
            ? (item.productionDecision as Record<string, unknown>)
            : undefined;

        return [
          String(item.componentId),
          {
            menuCategory: String(item.menuCategory ?? ""),
            productionMode: String(productionDecision?.mode ?? ""),
            purchasedElements: Array.isArray(productionDecision?.purchasedElements)
              ? productionDecision?.purchasedElements.map((entry) => String(entry)).join(", ")
              : "",
            recipeOverrideId: String(item.recipeOverrideId ?? ""),
            notes: String(productionDecision?.notes ?? "")
          } satisfies ComponentEditState
        ];
      })
    );

    setEditingSpecId(String(spec.specId));
    setProductionWorkspaceCleared(false);
    setDismissedProductionAnswerSpecId(undefined);
    setFocusedProductionSpecId(String(spec.specId));
    setEditingEventType(String(event?.type ?? ""));
    setEditingEventDate(String(event?.date ?? ""));
    setEditingAttendeeCount(String(attendees?.productionPax ?? attendees?.expected ?? ""));
    setEditingServiceForm(String(event?.serviceForm ?? ""));
    setEditingMenuItems(menuPlan.map((item) => String(item.label ?? "")).filter(Boolean).join(", "));
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
    <DashboardShell title={getRouteTitle(route)} subtitle={getRouteSubtitle(route)}>
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
        </div>
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
        ) : (
          <div className="hero-detail-card">
            <div>
              <p className="eyebrow">{route === "offer" ? "Vertrieb und Kalkulation" : "Küche und Produktion"}</p>
              <h2 className="hero-title">
                {route === "offer"
                  ? "Eigene URL für Angebotserstellung mit direkter Übergabe in operative Veranstaltungsdaten."
                  : "Eigene URL für Produktionsvorbereitung mit Rezeptbibliothek, Küchenplanung und Einkaufsliste."}
              </h2>
              <p className="lede">
                {route === "offer"
                  ? "Diese Ansicht bündelt Kundenanfrage, modulare Angebotsentwürfe und die Übernahme ausgewählter Varianten in die operative Spezifikation."
                  : "Diese Ansicht bündelt unabhängige Erfassung, Produktionspläne, Internet-Ausweichrezepte, Rezeptfreigaben und CSV-fähige Einkaufslisten."}
              </p>
            </div>
            <div className="hero-pills">
              <span className="hero-pill">{route === "offer" ? `${baseUrl}/angebot` : `${baseUrl}/produktion`}</span>
              <span className="hero-pill">Gemeinsamer Regelkern</span>
              <span className="hero-pill">Persistente Betriebsdaten</span>
            </div>
          </div>
        )}
      </section>

      <section className="metrics-grid">
        {route === "home" ? (
          <>
            <StatusCard
              title="Operative Spezifikationen"
              body={`${dashboard.acceptedSpecs.length} operative Datensätze stehen dienstübergreifend bereit.`}
            />
            <StatusCard
              title="Angebotsentwürfe"
              body={`${dashboard.offerDrafts.length} kaufmännische Entwürfe können direkt übernommen werden.`}
            />
            <StatusCard
              title="Produktionspläne"
              body={`${dashboard.productionPlans.length} Küchenpläne mit Rezept- und Einkaufsbezug sind verfügbar.`}
            />
            <StatusCard
              title="Rezeptbibliothek"
              body={`${dashboard.recipes.length} Rezepte stehen bereit, einschließlich externer Internet-Ausweichquellen.`}
            />
          </>
        ) : route === "offer" ? (
          <>
            <StatusCard
              title="Angebotsentwürfe"
              body={`${dashboard.offerDrafts.length} Entwürfe mit Varianten und Export stehen bereit.`}
            />
            <StatusCard
              title="Operative Spezifikationen"
              body={`${dashboard.acceptedSpecs.length} Datensätze können direkt an die Produktion übergeben werden.`}
            />
            <StatusCard
              title="Angebotsdienst"
              body={`${translateHealthStatus(serviceHealth.offers.status)} · ${formatCounts(serviceHealth.offers.counts)}`}
            />
            <StatusCard
              title="Exportdienst"
              body={`${translateHealthStatus(serviceHealth.exports.status)} · ${formatCounts(serviceHealth.exports.counts)}`}
            />
          </>
        ) : (
          <>
            <StatusCard
              title="Produktionspläne"
              body={`${dashboard.productionPlans.length} Küchenpläne mit Zeit- und Rezeptbezug sind vorhanden.`}
            />
            <StatusCard
              title="Einkaufslisten"
              body={`${dashboard.purchaseLists.length} Listen sind für Großmarkt und Beschaffung verfügbar.`}
            />
            <StatusCard
              title="Rezeptbibliothek"
              body={`${dashboard.recipes.length} Rezepte sind in der gemeinsamen Bibliothek hinterlegt.`}
            />
            <StatusCard
              title="Produktionsdienst"
              body={`${translateHealthStatus(serviceHealth.production.status)} · ${formatCounts(serviceHealth.production.counts)}`}
            />
          </>
        )}
      </section>

      {route !== "home" ? (
        <section className="toolbar">
          <input
            className="search"
            placeholder={
              route === "offer"
                ? "Angebotsentwürfe und operative Spezifikationen filtern"
                : "Spezifikationen, Produktionspläne oder Rezepte filtern"
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="helper-text toolbar-note">
            {route === "offer"
              ? "Angebots-URL: Kundenanfrage, Varianten und operative Übergabe."
              : "Produktions-URL: unabhängige Küchenvorbereitung, Rezepte und Einkaufslisten."}
          </p>
        </section>
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
                body={`${translateHealthStatus(serviceHealth.intake.status)} · ${formatCounts(serviceHealth.intake.counts)}`}
              />
              <StatusCard
                title="Angebot"
                body={`${translateHealthStatus(serviceHealth.offers.status)} · ${formatCounts(serviceHealth.offers.counts)}`}
              />
              <StatusCard
                title="Produktion"
                body={`${translateHealthStatus(serviceHealth.production.status)} · ${formatCounts(serviceHealth.production.counts)}`}
              />
              <StatusCard
                title="Export"
                body={`${translateHealthStatus(serviceHealth.exports.status)} · ${formatCounts(serviceHealth.exports.counts)}`}
              />
            </div>
          </article>

          <article className="panel">
            <header>
              <p className="eyebrow">Änderungsprotokoll</p>
              <h3>Letzte Bearbeitungsschritte über alle Dienste</h3>
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
              {filteredAuditEvents.length === 0 ? <li>Noch keine Änderungen vorhanden.</li> : null}
            </ul>
          </article>
        </section>
      ) : null}

      {route === "offer" ? (
        <section className="wide-grid">
          <article className="panel form-panel production-step-card">
            <header>
              <p className="eyebrow">Kundenanfrage</p>
              <h3>Freitext in eine operative Spezifikation überführen</h3>
            </header>
            <textarea value={intakeText} onChange={(event) => setIntakeText(event.target.value)} />
            <div className="action-row">
              <button disabled={submitting} onClick={() => void handleIntakeSubmit()}>
                Erfassungstext normalisieren
              </button>
            </div>
            <div className="divider" />
            <header>
              <p className="eyebrow">Dokumentenerfassung</p>
              <h3>PDF-, E-Mail- oder Textdateien übernehmen</h3>
            </header>
            <select
              className="operator-input"
              value={intakeChannel}
              onChange={(event) => setIntakeChannel(event.target.value as IntakeDocumentChannel)}
            >
              <option value="pdf_upload">PDF / Angebot</option>
              <option value="email">E-Mail</option>
              <option value="text">Textdatei</option>
            </select>
            <input
              className="file-input"
              type="file"
              accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
              onChange={(event) => setIntakeFile(event.target.files?.[0] ?? null)}
            />
            <div className="action-row">
              <button disabled={submitting} onClick={() => void handleIntakeDocumentSubmit()}>
                Dokument normalisieren
              </button>
            </div>
            {intakeFile ? <p className="helper-text">Ausgewählt: {intakeFile.name}</p> : null}
          </article>

          <article className="panel form-panel">
            <header>
              <p className="eyebrow">Angebotswerkbank</p>
              <h3>Angebotsentwurf aus Freitext erstellen</h3>
            </header>
            <textarea value={offerText} onChange={(event) => setOfferText(event.target.value)} />
            <button disabled={submitting} onClick={() => void handleOfferSubmit()}>
              Angebotsentwurf erzeugen
            </button>
            <div className="divider" />
            <header>
              <p className="eyebrow">Direkterfassung</p>
              <h3>Veranstaltungsdaten strukturiert erfassen</h3>
            </header>
            <input
              value={manualEventType}
              onChange={(event) => setManualEventType(event.target.value)}
              placeholder="Veranstaltungstyp, z. B. Konferenz"
            />
            <input
              value={manualEventDate}
              onChange={(event) => setManualEventDate(event.target.value)}
              placeholder="Datum, z. B. 2026-10-10"
            />
            <input
              value={manualAttendeeCount}
              onChange={(event) => setManualAttendeeCount(event.target.value)}
              placeholder="Teilnehmerzahl"
            />
            <input
              value={manualServiceForm}
              onChange={(event) => setManualServiceForm(event.target.value)}
              placeholder="Serviceform, z. B. Buffet"
            />
            <input
              value={manualMenuItems}
              onChange={(event) => setManualMenuItems(event.target.value)}
              placeholder="Menüpunkte, durch Komma getrennt"
            />
            <input
              value={manualCustomerName}
              onChange={(event) => setManualCustomerName(event.target.value)}
              placeholder="Kundenname"
            />
            <input
              value={manualVenueName}
              onChange={(event) => setManualVenueName(event.target.value)}
              placeholder="Ort oder Veranstaltungsort"
            />
            <textarea
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              placeholder="Interne Notizen oder Einschränkungen"
            />
            <button disabled={submitting} onClick={() => void handleManualSpecSubmit()}>
              Spezifikation anlegen
            </button>
          </article>

          <article className="panel">
            <header>
              <p className="eyebrow">Angebotsentwürfe</p>
              <h3>Aktuelle kaufmännische Ergebnisse</h3>
            </header>
            <ul className="item-list compact">
              {filteredOfferDrafts.map((draft) => (
                <li key={String(draft.draftId)}>
                  <strong>{String(draft.draftId)}</strong>
                  <p>{String(draft.eventSummary ?? "-")}</p>
                  <div className="action-row">
                    <button
                      className="secondary-button"
                      disabled={submitting}
                      onClick={() => setSelectedDraftId(String(draft.draftId))}
                    >
                      Einzelheiten
                    </button>
                    {Array.isArray(draft.variantSet)
                      ? draft.variantSet.map((variant) => {
                          const variantRecord = variant as Record<string, unknown>;
                          return (
                            <button
                              key={String(variantRecord.variantId)}
                              className="secondary-button"
                              disabled={submitting}
                              onClick={() =>
                                void handlePromoteDraft(
                                  String(draft.draftId),
                                  String(variantRecord.variantId)
                                )
                              }
                            >
                              {`Übernehmen: ${String(variantRecord.label ?? variantRecord.variantId)}`}
                            </button>
                          );
                        })
                      : null}
                  </div>
                  <a
                    className="ghost-link"
                    href={offerExportUrl(String(draft.draftId))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Angebot exportieren
                  </a>
                </li>
              ))}
              {filteredOfferDrafts.length === 0 ? <li>Noch keine Angebotsentwürfe vorhanden.</li> : null}
            </ul>
            {selectedDraft ? (
              <>
                <div className="divider" />
                <header>
                  <p className="eyebrow">Entwurfsdetails</p>
                  <h3>{String(selectedDraft.draftId)}</h3>
                </header>
                <p>{String(selectedDraft.eventSummary ?? "-")}</p>
                <pre className="detail-pre">{String(selectedDraft.customerFacingText ?? "")}</pre>
                <pre className="detail-pre">{String(selectedDraft.internalWorkingText ?? "")}</pre>
              </>
            ) : null}
          </article>

          <article className="panel">
            <header>
              <p className="eyebrow">Operative Übergabe</p>
              <h3>Spezifikationen für die Weitergabe an die Produktion</h3>
            </header>
            <ul className="item-list">
              {filteredSpecs.map((spec) => (
                <li key={String(spec.specId)} className="list-row">
                  <div>
                    <strong>{getSpecLabel(spec)}</strong>
                    <p>Status: {translateReadiness(String((spec.readiness as Record<string, unknown>)?.status ?? "-"))}</p>
                  </div>
                  <div className="action-row">
                    <button className="secondary-button" disabled={submitting} onClick={() => beginSpecEdit(spec)}>
                      Bearbeiten
                    </button>
                    <a className="button-link button-link--subtle" href="/produktion">
                      Zur Produktionsansicht
                    </a>
                  </div>
                </li>
              ))}
              {filteredSpecs.length === 0 ? <li>Noch keine Spezifikationen vorhanden.</li> : null}
            </ul>
            {editingSpecId ? (
              <>
                <div className="divider" />
                <div className="form-panel">
                  <header>
                    <p className="eyebrow">Spezifikation bearbeiten</p>
                    <h3>{editingSpecId}</h3>
                  </header>
                  <input
                    value={editingEventType}
                    onChange={(event) => setEditingEventType(event.target.value)}
                    placeholder="Veranstaltungstyp, z. B. Konferenz"
                  />
                  <input
                    value={editingEventDate}
                    onChange={(event) => setEditingEventDate(event.target.value)}
                    placeholder="Datum, z. B. 2026-06-18"
                  />
                  <input
                    value={editingAttendeeCount}
                    onChange={(event) => setEditingAttendeeCount(event.target.value)}
                    placeholder="Teilnehmerzahl"
                  />
                  <input
                    value={editingServiceForm}
                    onChange={(event) => setEditingServiceForm(event.target.value)}
                    placeholder="Serviceform, z. B. Buffet"
                  />
                  <textarea
                    value={editingMenuItems}
                    onChange={(event) => setEditingMenuItems(event.target.value)}
                    placeholder="Menüpunkte, durch Komma getrennt"
                  />
                  <div className="action-row">
                    <button disabled={submitting} onClick={() => void handleSaveSpecEdit()}>
                      Spezifikation speichern
                    </button>
                    <button className="secondary-button" disabled={submitting} onClick={() => resetSpecEdit()}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </article>
        </section>
      ) : null}

      {route === "production" ? (
        <section className="production-layout">
          <div className="production-column">
          <article className="panel form-panel">
            <div className="upload-shortcut-bar">
              <div>
                <p className="eyebrow">Schnellimport</p>
                <strong>Datei hochladen oder einfach irgendwo auf dieser Seite ablegen</strong>
                <p className="helper-text">
                  Der Upload bleibt dauerhaft sichtbar. Drag & Drop reagiert jetzt auf die gesamte Produktionsansicht.
                </p>
              </div>
              <div className="action-row">
                <button type="button" disabled={submitting} onClick={openProductionFilePicker}>
                  Datei hochladen
                </button>
                <button
                  type="button"
                  className="secondary-button destructive-button"
                  disabled={submitting}
                  onClick={clearProductionWorkspace}
                >
                  Löschen
                </button>
              </div>
            </div>
            <header>
              <p className="eyebrow">Schritt 1</p>
              <h3>Angebot hineinziehen oder hochladen</h3>
            </header>
            <label
              className={dragActive ? "drag-drop-zone drag-drop-zone--active" : "drag-drop-zone"}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleProductionDrop}
            >
              <input
                ref={productionUploadInputRef}
                className="visually-hidden"
                type="file"
                accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
                onChange={handleProductionFileSelection}
              />
              <span className="eyebrow">Drag & Drop</span>
              <strong>Angebot, E-Mail oder Textdatei hier ablegen</strong>
              <p className="helper-text">
                PDF, E-Mail und Textdateien werden sofort analysiert und in operative Veranstaltungsdaten überführt.
              </p>
              <span className="drag-drop-zone__cta">Datei auswählen</span>
            </label>
            <div className="activity-slot">
              {intakeFile ? <p className="helper-text">Ausgewählt: {intakeFile.name}</p> : null}
              {documentPhase === "analysing" && activeDocumentName ? (
                <div className="progress-panel">
                  <div
                    className="progress-ring"
                    style={
                      {
                        "--progress-angle": `${Math.max(0, Math.min(documentProgress, 100)) * 3.6}deg`
                      } as CSSProperties
                    }
                  >
                    <span>{documentProgress}%</span>
                  </div>
                  <div className="progress-panel__content">
                    <p className="processing-note">Analyse läuft für {activeDocumentName} ...</p>
                    <div className="progress-bar">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${Math.max(0, Math.min(documentProgress, 100))}%` }}
                      />
                    </div>
                    <p className="helper-text">
                      Geschätzte Restzeit: {formatEta(documentEtaSeconds ?? 1)}
                    </p>
                  </div>
                </div>
              ) : null}
              {documentPhase === "done" && activeDocumentName ? (
                <div className="progress-panel">
                  <div
                    className="progress-ring progress-ring--done"
                    style={{ "--progress-angle": "360deg" } as CSSProperties}
                  >
                    <span>100%</span>
                  </div>
                  <div className="progress-panel__content">
                    <p className="processing-note processing-note--success">
                      Analyse abgeschlossen für {activeDocumentName}.
                    </p>
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: "100%" }} />
                    </div>
                    <p className="helper-text">Die Rückfragen und Ergebnisse wurden aktualisiert.</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="action-row">
              <select
                className="operator-input"
                value={intakeChannel}
                onChange={(event) => setIntakeChannel(event.target.value as IntakeDocumentChannel)}
              >
                <option value="pdf_upload">PDF / Angebot</option>
                <option value="email">E-Mail</option>
                <option value="text">Textdatei</option>
              </select>
              <button disabled={submitting} onClick={() => void handleIntakeDocumentSubmit()}>
                Erneut mit ausgewähltem Typ verarbeiten
              </button>
            </div>
            <div className="divider" />
            <header>
              <p className="eyebrow">Alternative</p>
              <h3>Freitext direkt einfügen</h3>
            </header>
            <textarea value={intakeText} onChange={(event) => setIntakeText(event.target.value)} />
            <div className="action-row">
              <button disabled={submitting} onClick={() => void handleIntakeSubmit()}>
                Erfassungstext normalisieren
              </button>
            </div>
            <div className="divider" />
            <header>
              <p className="eyebrow">Fallback</p>
              <h3>Veranstaltungsdaten direkt eingeben</h3>
            </header>
            <input
              value={manualEventType}
              onChange={(event) => setManualEventType(event.target.value)}
              placeholder="Veranstaltungstyp, z. B. Konferenz"
            />
            <input
              value={manualEventDate}
              onChange={(event) => setManualEventDate(event.target.value)}
              placeholder="Datum, z. B. 2026-10-10"
            />
            <input
              value={manualAttendeeCount}
              onChange={(event) => setManualAttendeeCount(event.target.value)}
              placeholder="Teilnehmerzahl"
            />
            <input
              value={manualServiceForm}
              onChange={(event) => setManualServiceForm(event.target.value)}
              placeholder="Serviceform, z. B. Buffet"
            />
            <input
              value={manualMenuItems}
              onChange={(event) => setManualMenuItems(event.target.value)}
              placeholder="Menüpunkte, durch Komma getrennt"
            />
            <input
              value={manualCustomerName}
              onChange={(event) => setManualCustomerName(event.target.value)}
              placeholder="Kundenname"
            />
            <input
              value={manualVenueName}
              onChange={(event) => setManualVenueName(event.target.value)}
              placeholder="Ort oder Veranstaltungsort"
            />
            <textarea
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              placeholder="Interne Notizen oder Einschränkungen"
            />
            <button disabled={submitting} onClick={() => void handleManualSpecSubmit()}>
              Spezifikation anlegen
            </button>
          </article>
          </div>
          <div className="production-column">
          <article className="panel form-panel question-panel production-step-card">
            <header>
              <p className="eyebrow">Schritt 2</p>
              <h3>Rückfragen des Agenten</h3>
            </header>
            {focusedProductionSpec ? (
              <>
                <div className="question-window">
                  <p className="question-window__spec">{getSpecLabel(focusedProductionSpec)}</p>
                  <p className="helper-text">
                    Status:{" "}
                    {translateReadiness(
                      String((focusedProductionSpec.readiness as Record<string, unknown> | undefined)?.status ?? "-")
                    )}
                  </p>
                  <ul className="question-list">
                    {productionQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                  {productionAssumptions.length > 0 ? (
                    <>
                      <p className="eyebrow">Annahmen des Agenten</p>
                      <ul className="item-list compact">
                        {productionAssumptions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {editingSpecId === String(focusedProductionSpec.specId) ? (
                    <>
                      <div className="divider" />
                      <header>
                        <p className="eyebrow">Direkte Antworten</p>
                        <h4 className="subsection-title">Rückfragen unmittelbar ergänzen</h4>
                      </header>
                      <div className="answer-grid">
                        <label className="field-block">
                          <span>Veranstaltungstyp</span>
                          <select
                            value={editingEventType}
                            onChange={(event) => setEditingEventType(event.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="meeting">Besprechung</option>
                            <option value="conference">Konferenz</option>
                            <option value="lunch">Lunch</option>
                            <option value="reception">Empfang</option>
                            <option value="dinner">Abendessen</option>
                            <option value="trade_fair">Messe</option>
                          </select>
                        </label>
                        <label className="field-block">
                          <span>Datum</span>
                          <input
                            value={editingEventDate}
                            onChange={(event) => setEditingEventDate(event.target.value)}
                            placeholder="2026-06-18"
                          />
                        </label>
                        <label className="field-block">
                          <span>Teilnehmerzahl</span>
                          <input
                            value={editingAttendeeCount}
                            onChange={(event) => setEditingAttendeeCount(event.target.value)}
                            inputMode="numeric"
                            placeholder="120"
                          />
                          {editingPaxStatusText ? <p className="helper-text">{editingPaxStatusText}</p> : null}
                        </label>
                        <label className="field-block">
                          <span>Serviceform</span>
                          <select
                            value={editingServiceForm}
                            onChange={(event) => setEditingServiceForm(event.target.value)}
                          >
                            <option value="">Bitte wählen</option>
                            <option value="buffet">Buffet</option>
                            <option value="plated">Menü am Platz</option>
                            <option value="standing_reception">Empfang / Flying</option>
                            <option value="grab_and_go">Ausgabe / Grab-and-go</option>
                            <option value="coffee_break">Kaffeepause</option>
                          </select>
                        </label>
                      </div>
                      <label className="field-block">
                        <span>Gerichte und Komponenten</span>
                        <textarea
                          value={editingMenuItems}
                          onChange={(event) => setEditingMenuItems(event.target.value)}
                          placeholder="Kalbsbuletten, Kartoffelsalat, Nudelsalat, Mandel-Curry, Schokoladenkuchen"
                        />
                      </label>
                      <p className="helper-text">
                        Mehrere Gerichte bitte durch Komma trennen. Diese Angaben aktualisieren direkt die operative Spezifikation.
                      </p>
                      {Array.isArray(focusedProductionSpec.menuPlan) && focusedProductionSpec.menuPlan.length > 0 ? (
                        <>
                          <div className="divider" />
                          <header>
                            <p className="eyebrow">Gericht für Gericht</p>
                            <h4 className="subsection-title">Klassifikation und Herstellungsart festlegen</h4>
                          </header>
                          <div className="component-answer-list">
                            {focusedProductionSpec.menuPlan.map((entry) => {
                              const component = entry as Record<string, unknown>;
                              const componentId = String(component.componentId ?? "");
                              const state = editingComponentStates[componentId] ?? {
                                menuCategory: "",
                                productionMode: "",
                                purchasedElements: "",
                                recipeOverrideId: "",
                                notes: ""
                              };
                              const componentLabel = String(component.label ?? componentId);
                              const recipeSuggestions = recipeSuggestionsForComponent(
                                componentLabel,
                                dashboard.recipes
                              );
                              const selectedRecipeName = state.recipeOverrideId
                                ? resolveRecipeNameById(state.recipeOverrideId, dashboard.recipes)
                                : undefined;
                              const recipeOptions = [...recipeSuggestions];
                              if (
                                state.recipeOverrideId &&
                                !recipeOptions.some((item) => item.recipeId === state.recipeOverrideId)
                              ) {
                                recipeOptions.unshift({
                                  recipeId: state.recipeOverrideId,
                                  name: selectedRecipeName ?? `Rezept ${state.recipeOverrideId}`
                                });
                              }

                              return (
                                <article key={componentId} className="component-answer-card">
                                  <strong>{componentLabel}</strong>
                                  <div className="answer-grid">
                                    <label className="field-block">
                                      <span>Kategorie im Angebot</span>
                                      <select
                                        value={state.menuCategory}
                                        onChange={(event) =>
                                          updateEditingComponentState(componentId, {
                                            menuCategory: event.target.value
                                          })
                                        }
                                      >
                                        <option value="">Bitte wählen</option>
                                        <option value="classic">klassisch</option>
                                        <option value="vegetarian">vegetarisch</option>
                                        <option value="vegan">vegan</option>
                                      </select>
                                    </label>
                                    <label className="field-block">
                                      <span>Herstellungsart</span>
                                      <select
                                        value={state.productionMode}
                                        onChange={(event) =>
                                          updateEditingComponentState(componentId, {
                                            productionMode: event.target.value
                                          })
                                        }
                                      >
                                        <option value="">Bitte wählen</option>
                                        <option value="scratch">Eigenproduktion</option>
                                        <option value="hybrid">Hybrid</option>
                                        <option value="convenience_purchase">Convenience-Zukauf</option>
                                        <option value="external_finished">Fertigprodukt / extern</option>
                                      </select>
                                    </label>
                                  </div>
                                  <label className="field-block">
                                    <span>Rezept gezielt aus Bibliothek zuweisen</span>
                                    <select
                                      value={state.recipeOverrideId}
                                      onChange={(event) =>
                                        updateEditingComponentState(componentId, {
                                          recipeOverrideId: event.target.value
                                        })
                                      }
                                    >
                                      <option value="">Automatisch suchen</option>
                                      {recipeOptions.map((option) => (
                                        <option key={option.recipeId} value={option.recipeId}>
                                          {option.name} ({option.recipeId})
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {recipeOptions.length > 0 ? (
                                    <p className="helper-text">
                                      Vorgeschlagene Bibliotheksrezepte:{" "}
                                      {recipeOptions.map((option) => option.name).join(", ")}
                                    </p>
                                  ) : (
                                    <p className="helper-text">
                                      Für diese Bezeichnung wurden noch keine naheliegenden Bibliotheksrezepte gefunden.
                                    </p>
                                  )}
                                  <label className="field-block">
                                    <span>Zugekaufte Bestandteile</span>
                                    <input
                                      value={state.purchasedElements}
                                      onChange={(event) =>
                                        updateEditingComponentState(componentId, {
                                          purchasedElements: event.target.value
                                        })
                                      }
                                      placeholder="z. B. Teig, Blätterteig, fertiger Boden, Saucenbasis"
                                    />
                                  </label>
                                  <label className="field-block">
                                    <span>Interne Notiz</span>
                                    <input
                                      value={state.notes}
                                      onChange={(event) =>
                                        updateEditingComponentState(componentId, {
                                          notes: event.target.value
                                        })
                                      }
                                      placeholder="optional"
                                    />
                                  </label>
                                </article>
                              );
                            })}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => beginSpecEdit(focusedProductionSpec)}
                  >
                    Antworten bearbeiten
                  </button>
                  {editingSpecId === String(focusedProductionSpec.specId) ? (
                    <button className="secondary-button" disabled={submitting} onClick={() => void handleSaveSpecEdit()}>
                      Antworten speichern
                    </button>
                  ) : null}
                  <button disabled={submitting} onClick={() => void handleCreatePlan(focusedProductionSpec)}>
                    {editingSpecId === String(focusedProductionSpec.specId)
                      ? "Speichern und Berechnung starten"
                      : "Berechnung starten"}
                  </button>
                </div>
              </>
            ) : (
              <p className="helper-text">
                {documentPhase === "analysing"
                  ? "Der Agent wertet das hochgeladene Dokument gerade aus und erzeugt daraus operative Veranstaltungsdaten."
                  : productionWorkspaceCleared
                    ? "Der aktuelle Vorgang wurde geleert. Nach einem neuen Upload erscheinen hier wieder die Rückfragen des Agenten."
                  : "Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheinen hier die Rückfragen des Agenten."}
              </p>
            )}
            {!productionWorkspaceCleared && filteredSpecs.length > 1 ? (
              <>
                <div className="divider" />
                <header>
                  <p className="eyebrow">Erkannte Eingänge</p>
                  <h3>Zwischen mehreren Vorgängen wechseln</h3>
                </header>
                <ul className="item-list compact">
                  {filteredSpecs.slice(0, 6).map((spec) => (
                    <li key={String(spec.specId)}>
                      <strong>{getSpecLabel(spec)}</strong>
                      <div className="action-row">
                        <button
                          className="secondary-button"
                          disabled={submitting}
                          onClick={() => {
                            setProductionWorkspaceCleared(false);
                            setFocusedProductionSpecId(String(spec.specId));
                          }}
                        >
                          Für Rückfragen öffnen
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {editingSpecId && editingSpecId !== String(focusedProductionSpec?.specId ?? "") ? (
              <>
                <div className="divider" />
                <div className="form-panel">
                  <header>
                    <p className="eyebrow">Antwortfenster</p>
                    <h3>{editingSpecId}</h3>
                  </header>
                  <input
                    value={editingEventType}
                    onChange={(event) => setEditingEventType(event.target.value)}
                    placeholder="Veranstaltungstyp, z. B. Konferenz"
                  />
                  <input
                    value={editingEventDate}
                    onChange={(event) => setEditingEventDate(event.target.value)}
                    placeholder="Datum, z. B. 2026-06-18"
                  />
                  <input
                    value={editingAttendeeCount}
                    onChange={(event) => setEditingAttendeeCount(event.target.value)}
                    placeholder="Teilnehmerzahl"
                  />
                  {editingPaxStatusText ? <p className="helper-text">{editingPaxStatusText}</p> : null}
                  <input
                    value={editingServiceForm}
                    onChange={(event) => setEditingServiceForm(event.target.value)}
                    placeholder="Serviceform, z. B. Buffet"
                  />
                  <textarea
                    value={editingMenuItems}
                    onChange={(event) => setEditingMenuItems(event.target.value)}
                    placeholder="Menüpunkte, durch Komma getrennt"
                  />
                  <div className="action-row">
                    <button disabled={submitting} onClick={() => void handleSaveSpecEdit()}>
                      Antworten speichern
                    </button>
                    <button className="secondary-button" disabled={submitting} onClick={() => resetSpecEdit()}>
                      Fenster schließen
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </article>
          </div>
          <div className="production-column">
          <article className="panel production-step-card">
            <header>
              <p className="eyebrow">Schritt 3</p>
              <h3>Berechnete Ergebnisse</h3>
            </header>
            <div className="activity-slot">
              {planPhase === "planning" && planningSpecLabel ? (
                <div className="progress-panel">
                  <div
                    className="progress-ring"
                    style={
                      {
                        "--progress-angle": `${Math.max(0, Math.min(planProgress, 100)) * 3.6}deg`
                      } as CSSProperties
                    }
                  >
                    <span>{planProgress}%</span>
                  </div>
                  <div className="progress-panel__content">
                    <p className="processing-note">
                      Rezeptsuche, Produktionsplanung und Einkaufsberechnung laufen für {planningSpecLabel} ...
                    </p>
                    <div className="progress-bar">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${Math.max(0, Math.min(planProgress, 100))}%` }}
                      />
                    </div>
                    <p className="helper-text">
                      Geschätzte Restzeit: {formatEta(planEtaSeconds ?? 1)}
                    </p>
                  </div>
                </div>
              ) : null}
              {planPhase === "done" && planningSpecLabel ? (
                <div className="progress-panel">
                  <div
                    className="progress-ring progress-ring--done"
                    style={{ "--progress-angle": "360deg" } as CSSProperties}
                  >
                    <span>100%</span>
                  </div>
                  <div className="progress-panel__content">
                    <p className="processing-note processing-note--success">
                      Produktionsplan wurde für {planningSpecLabel} erzeugt.
                    </p>
                    <div className="progress-bar">
                      <div className="progress-bar__fill" style={{ width: "100%" }} />
                    </div>
                    <p className="helper-text">
                      Die Rezepte, Produktionsschritte und Einkaufspositionen wurden aktualisiert.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            <header>
              <p className="eyebrow">Aktueller Vorgang</p>
              <h4 className="subsection-title">
                {focusedProductionSpec
                  ? getSpecLabel(focusedProductionSpec)
                  : productionWorkspaceCleared
                    ? "Kein aktiver Vorgang"
                    : "Neuester Produktionslauf"}
              </h4>
            </header>
            <p className="helper-text">
              {productionWorkspaceCleared
                ? "Die Ergebnisfelder wurden geleert. Ein neuer Upload oder eine neue Erfassung füllt diesen Bereich wieder."
                : "Hier erscheinen nur die Ergebnisse für den aktuell ausgewählten Vorgang. Ältere Läufe stehen weiter unten."}
            </p>
            {!productionWorkspaceCleared ? renderPlanList(currentSpecPlans, specById, submitting, setSelectedPlanId) : null}
            {!productionWorkspaceCleared && archivedPlans.length > 0 ? (
              <>
                <div className="divider" />
                <header>
                  <p className="eyebrow">Ältere Produktionsläufe</p>
                  <h4 className="subsection-title">Frühere Ergebnisse aus anderen Vorgängen</h4>
                </header>
                {renderPlanList(archivedPlans, specById, submitting, setSelectedPlanId)}
              </>
            ) : null}
            {selectedPlan ? (
              <>
                <div className="divider" />
                <header>
                  <p className="eyebrow">Plandetails</p>
                  <h3>{selectedPlanSpec ? getSpecLabel(selectedPlanSpec) : "Produktionsplan"}</h3>
                </header>
                <p className="helper-text">
                  Status:{" "}
                  {translateReadiness(
                    String((selectedPlan.readiness as Record<string, unknown> | undefined)?.status ?? "-")
                  )}
                  {selectedPlanSpec
                    ? ` · Serviceform: ${translateServiceForm(
                        String(
                          (
                            selectedPlanSpec.servicePlan as Record<string, unknown> | undefined
                          )?.serviceForm ?? "offen"
                        )
                      )}`
                    : ""}
                  {" · "}Arbeitsblätter: {Array.isArray(selectedPlan.kitchenSheets) ? selectedPlan.kitchenSheets.length : 0}
                  {" · "}Rezeptblätter: {Array.isArray(selectedPlan.productionBatches) ? selectedPlan.productionBatches.length : 0}
                </p>
                {Array.isArray(selectedPlan.unresolvedItems) && selectedPlan.unresolvedItems.length > 0 ? (
                  <>
                    <p>Offene Punkte:</p>
                    <ul className="item-list compact">
                      {selectedPlan.unresolvedItems.map((entry) => (
                        <li key={String(entry)}>{String(entry)}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Offene Punkte: keine</p>
                )}
                {Array.isArray(selectedPlan.productionBatches) &&
                selectedPlan.productionBatches.length === 0 &&
                Array.isArray(selectedPlan.kitchenSheets) &&
                selectedPlan.kitchenSheets.length > 0 ? (
                  <p className="helper-text">
                    Es liegen bereits operative Arbeitsblätter vor. Rezeptblätter entstehen zusätzlich, sobald für die
                    offenen Komponenten ein belastbares Rezept oder eine eindeutige Beschaffungsentscheidung vorliegt.
                  </p>
                ) : null}
                <ul className="item-list compact">
                  {Array.isArray(selectedPlan.recipeSelections)
                    ? selectedPlan.recipeSelections.map((selection) => {
                        const selectionRecord = selection as Record<string, unknown>;
                        const componentId = String(selectionRecord.componentId ?? "");
                        const component = selectedPlanComponentsById.get(componentId);
                        const componentLabel = String(component?.label ?? componentId);
                        const qualityScore = formatPercent(selectionRecord.qualityScore);
                        const fitScore = formatPercent(selectionRecord.fitScore);
                        const searchTrace = Array.isArray(selectionRecord.searchTrace)
                          ? selectionRecord.searchTrace.map((entry) => String(entry))
                          : [];
                        return (
                          <li key={componentId}>
                            <strong>{componentLabel}</strong>
                            <p>{String(selectionRecord.selectionReason ?? "-")}</p>
                            {component ? (
                              <p className="helper-text">
                                Kategorie: {translateMenuCategory(String(component.menuCategory ?? ""))}
                                {" · "}Herstellungsart:{" "}
                                {translateProductionMode(
                                  String(
                                    (
                                      component.productionDecision as Record<string, unknown> | undefined
                                    )?.mode ?? ""
                                  )
                                )}
                              </p>
                            ) : null}
                            {qualityScore || fitScore ? (
                              <p className="helper-text">
                                {qualityScore ? `Qualität ${qualityScore}` : "Qualität offen"}
                                {fitScore ? ` · Passung ${fitScore}` : ""}
                              </p>
                            ) : null}
                            {searchTrace.length > 0 ? (
                              <div className="search-trace">
                                <p className="helper-text">Suchspur:</p>
                                <ul className="item-list compact trace-list">
                                  {searchTrace.map((entry) => (
                                    <li key={`${componentId}-${entry}`}>{entry}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </li>
                        );
                      })
                    : null}
                </ul>
                {Array.isArray(selectedPlan.kitchenSheets) && selectedPlan.kitchenSheets.length > 0 ? (
                  <>
                    <div className="divider" />
                    <header>
                      <p className="eyebrow">Arbeitsblätter</p>
                      <h4 className="subsection-title">Küche, Beschaffung und Klärungen</h4>
                    </header>
                    <ul className="item-list compact">
                      {selectedPlan.kitchenSheets.map((sheet, sheetIndex) => {
                        const sheetRecord = sheet as Record<string, unknown>;
                        const instructions = Array.isArray(sheetRecord.instructions)
                          ? sheetRecord.instructions.map((entry) => String(entry))
                          : [];
                        return (
                          <li key={`${String(sheetRecord.title ?? "Arbeitsblatt")}-${sheetIndex}`}>
                            <strong>{String(sheetRecord.title ?? "Arbeitsblatt")}</strong>
                            <ul className="item-list compact trace-list">
                              {instructions.map((instruction) => (
                                <li key={`${String(sheetRecord.title ?? "Arbeitsblatt")}-${instruction}`}>
                                  {instruction}
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}
              </>
            ) : null}
          </article>

          <article className="panel form-panel">
            <header>
              <p className="eyebrow">Rezeptbibliothek</p>
              <h3>Zusätzliche Rezepte in die Küchenbibliothek übernehmen</h3>
            </header>
            <input
              value={recipeName}
              onChange={(event) => setRecipeName(event.target.value)}
              placeholder="Optionaler Rezeptname"
            />
            <input
              className="file-input"
              type="file"
              accept=".pdf,.txt,.md,text/plain,application/pdf"
              onChange={(event) => setRecipeFile(event.target.files?.[0] ?? null)}
            />
            <div className="action-row">
              <button disabled={submitting} onClick={() => void handleRecipeUpload("offer")}>
                Über Angebotsagent speichern
              </button>
              <button disabled={submitting} onClick={() => void handleRecipeUpload("production")}>
                Über Produktionsagent speichern
              </button>
            </div>
            {recipeFile ? <p className="helper-text">Ausgewählt: {recipeFile.name}</p> : null}
          </article>

          <article className="panel">
            <header>
              <p className="eyebrow">Rezeptbestand</p>
              <h3>Freigaben, Herkunft und Internet-Ausweichquellen</h3>
            </header>
            <ul className="item-list compact">
              {filteredRecipes.slice(0, 12).map((recipe) => (
                <li key={String(recipe.recipeId)}>
                  <strong>{String(recipe.name)}</strong>
                  <p>
                    {translateRecipeTier(String((recipe.source as Record<string, unknown>)?.tier ?? "-"))} ·{" "}
                    {translateApprovalState(String((recipe.source as Record<string, unknown>)?.approvalState ?? "-"))}
                  </p>
                  <div className="action-row">
                    <button
                      className="secondary-button"
                      disabled={submitting}
                      onClick={() => void handleRecipeReview("production", String(recipe.recipeId), "approve")}
                    >
                      Freigeben
                    </button>
                    <button
                      className="secondary-button"
                      disabled={submitting}
                      onClick={() => void handleRecipeReview("production", String(recipe.recipeId), "verify")}
                    >
                      Verifizieren
                    </button>
                    <button
                      className="secondary-button destructive-button"
                      disabled={submitting}
                      onClick={() => void handleRecipeReview("production", String(recipe.recipeId), "reject")}
                    >
                      Ablehnen
                    </button>
                  </div>
                </li>
              ))}
              {filteredRecipes.length === 0 ? <li>Noch keine Rezepte vorhanden.</li> : null}
            </ul>
          </article>

          <article className="panel">
            <header>
              <p className="eyebrow">Einkaufslisten</p>
              <h3>CSV-fähige Beschaffungslisten</h3>
            </header>
            <ul className="item-list compact">
              {currentSpecPurchaseLists.map((purchaseList) => {
                const relatedSpec = specById.get(String(purchaseList.eventSpecId ?? ""));
                return (
                <li key={String(purchaseList.purchaseListId)}>
                  <strong>{relatedSpec ? getSpecLabel(relatedSpec) : "Einkaufsliste"}</strong>
                  <p>Positionen: {String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}</p>
                  <a
                    className="ghost-link"
                    href={purchaseListExportUrl(String(purchaseList.purchaseListId))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Einkaufsliste herunterladen
                  </a>
                </li>
              );
              })}
              {currentSpecPurchaseLists.length === 0 ? <li>Noch keine Einkaufslisten für den aktuellen Vorgang vorhanden.</li> : null}
            </ul>
            {archivedPurchaseLists.length > 0 ? (
              <>
                <div className="divider" />
                <p className="eyebrow">Ältere Einkaufslisten</p>
                <ul className="item-list compact">
                  {archivedPurchaseLists.map((purchaseList) => {
                    const relatedSpec = specById.get(String(purchaseList.eventSpecId ?? ""));
                    return (
                      <li key={String(purchaseList.purchaseListId)}>
                        <strong>{relatedSpec ? getSpecLabel(relatedSpec) : "Einkaufsliste"}</strong>
                        <p>Positionen: {String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}</p>
                        <a
                          className="ghost-link"
                          href={purchaseListExportUrl(String(purchaseList.purchaseListId))}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Einkaufsliste herunterladen
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </article>
          </div>
        </section>
      ) : null}

      <footer className="footer-note">
        {loading
          ? "Aktuelle Plattformdaten werden geladen..."
          : "Aktuelle Daten aus Erfassung, Angebot und Produktion wurden geladen."}
      </footer>
    </DashboardShell>
  );
}
