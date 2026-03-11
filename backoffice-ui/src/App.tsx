import {
  startTransition,
  type DragEvent,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState
} from "react";
import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";
import {
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

function translateEventType(value?: string): string {
  const labels: Record<string, string> = {
    conference: "Konferenz",
    meeting: "Besprechung",
    reception: "Empfang",
    dinner: "Abendessen",
    fair: "Messe",
    workshop: "Arbeitsseminar"
  };
  return value ? labels[value] ?? value : "Veranstaltung";
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

function getSpecLabel(spec: Record<string, unknown>): string {
  const event = spec.event as Record<string, unknown> | undefined;
  const attendees = spec.attendees as Record<string, unknown> | undefined;
  return `${translateEventType(String(event?.type ?? ""))} · ${attendees?.expected ?? "?"} Teilnehmende · ${event?.date ?? "offen"}`;
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

function stringListFromUnknown(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((item) => String(item)).filter(Boolean);
}

function messageListFromUnknown(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => {
      if (item && typeof item === "object" && "message" in item) {
        return String((item as { message?: unknown }).message ?? "");
      }
      return String(item ?? "");
    })
    .filter(Boolean);
}

function buildProductionQuestions(spec?: Record<string, unknown>): string[] {
  if (!spec) {
    return ["Bitte ziehe zuerst ein Angebot hinein oder lade eine Datei hoch."];
  }

  const event = spec.event as Record<string, unknown> | undefined;
  const attendees = spec.attendees as Record<string, unknown> | undefined;
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];
  const missingFields = stringListFromUnknown(spec.missingFields);
  const readiness = String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "");
  const questions: string[] = [];

  if (!event?.date) {
    questions.push("Welches Veranstaltungsdatum gilt verbindlich für die Produktion?");
  }
  if (!attendees?.expected) {
    questions.push("Mit welcher verbindlichen Teilnehmerzahl soll kalkuliert und produziert werden?");
  }
  if (!event?.serviceForm) {
    questions.push("Welche Serviceform gilt: Buffet, Menü, Flying oder Ausgabe?");
  }
  if (menuPlan.length === 0) {
    questions.push("Welche Gerichte oder Komponenten sollen konkret produziert werden?");
  }

  for (const field of missingFields) {
    questions.push(`Bitte klären: ${field}`);
  }

  if (questions.length === 0 && readiness === "partial") {
    questions.push("Bitte prüfe die Annahmen des Agenten, bevor die Produktion final freigegeben wird.");
  }

  if (questions.length === 0 && readiness === "insufficient") {
    questions.push("Es fehlen noch Angaben, bevor belastbare Mengen und Einkaufslisten berechnet werden können.");
  }

  return [...new Set(questions)];
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
    "Konferenz am 2026-06-18 für 90 Teilnehmende mit Lunchbuffet, Tomatensuppe und Kaffeestation."
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
    "Besprechung am 2026-06-25 für 35 Teilnehmende mit Kaffeepause, Croissants und Wasserservice."
  );
  const [recipeName, setRecipeName] = useState("");
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [editingSpecId, setEditingSpecId] = useState<string>();
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [focusedProductionSpecId, setFocusedProductionSpecId] = useState<string>();
  const [dragActive, setDragActive] = useState(false);
  const [editingEventType, setEditingEventType] = useState("");
  const [editingEventDate, setEditingEventDate] = useState("");
  const [editingAttendeeCount, setEditingAttendeeCount] = useState("");
  const [editingServiceForm, setEditingServiceForm] = useState("");
  const [editingMenuItems, setEditingMenuItems] = useState("");
  const deferredSearch = useDeferredValue(search);

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
  }, [refreshDashboard]);

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

  const selectedDraft = useMemo(
    () => dashboard.offerDrafts.find((draft) => String(draft.draftId) === selectedDraftId),
    [dashboard.offerDrafts, selectedDraftId]
  );

  const selectedPlan = useMemo(
    () => dashboard.productionPlans.find((plan) => String(plan.planId) === selectedPlanId),
    [dashboard.productionPlans, selectedPlanId]
  );

  const focusedProductionSpec = useMemo(() => {
    const preferred = focusedProductionSpecId
      ? dashboard.acceptedSpecs.find((spec) => String(spec.specId) === focusedProductionSpecId)
      : undefined;
    return preferred ?? filteredSpecs[0] ?? dashboard.acceptedSpecs[0];
  }, [dashboard.acceptedSpecs, filteredSpecs, focusedProductionSpecId]);

  const productionQuestions = useMemo(
    () => buildProductionQuestions(focusedProductionSpec),
    [focusedProductionSpec]
  );

  const productionAssumptions = useMemo(
    () => messageListFromUnknown(focusedProductionSpec?.assumptions),
    [focusedProductionSpec]
  );

  function clearMessages() {
    setError(undefined);
    setNotice(undefined);
  }

  async function handleIntakeSubmit() {
    setSubmitting(true);
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

    setSubmitting(true);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromDocument(intakeFile, intakeChannel);
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      setIntakeFile(null);
      setDragActive(false);
      await refreshDashboard();
      setNotice("Dokument wurde in eine operative Spezifikation überführt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Dokument konnte nicht normalisiert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSpecSubmit() {
    setSubmitting(true);
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
    clearMessages();
    try {
      const response = await createProductionPlan(spec);
      const planId = extractProductionPlanId(response);
      if (planId) {
        setSelectedPlanId(planId);
      }
      await refreshDashboard();
      setNotice("Produktionsplan wurde erzeugt.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Produktionsplan konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function beginSpecEdit(spec: Record<string, unknown>) {
    const event = spec.event as Record<string, unknown> | undefined;
    const attendees = spec.attendees as Record<string, unknown> | undefined;
    const menuPlan = Array.isArray(spec.menuPlan) ? (spec.menuPlan as Array<Record<string, unknown>>) : [];

    setEditingSpecId(String(spec.specId));
    setFocusedProductionSpecId(String(spec.specId));
    setEditingEventType(String(event?.type ?? ""));
    setEditingEventDate(String(event?.date ?? ""));
    setEditingAttendeeCount(String(attendees?.expected ?? ""));
    setEditingServiceForm(String(event?.serviceForm ?? ""));
    setEditingMenuItems(menuPlan.map((item) => String(item.label ?? "")).filter(Boolean).join(", "));
  }

  function resetSpecEdit() {
    setEditingSpecId(undefined);
    setEditingEventType("");
    setEditingEventDate("");
    setEditingAttendeeCount("");
    setEditingServiceForm("");
    setEditingMenuItems("");
  }

  async function handleSaveSpecEdit() {
    if (!editingSpecId) {
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await updateAcceptedSpec(editingSpecId, {
        eventType: editingEventType.trim() || undefined,
        eventDate: editingEventDate.trim() || undefined,
        serviceForm: editingServiceForm.trim() || undefined,
        attendeeCount: editingAttendeeCount.trim() ? Number(editingAttendeeCount) : undefined,
        menuItems: editingMenuItems
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      resetSpecEdit();
      await refreshDashboard();
      setNotice("Spezifikation wurde gespeichert.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Spezifikation konnte nicht gespeichert werden."
      );
    } finally {
      setSubmitting(false);
    }
  }

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
    setIntakeChannel(channelForFile(file));
    setNotice(`Datei ${file.name} ist bereit zur Verarbeitung.`);
    setError(undefined);
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

      {error ? <p className="error-banner">{error}</p> : null}
      {notice ? <p className="notice-banner">{notice}</p> : null}

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
          <article className="panel form-panel">
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
        <section className="wide-grid">
          <article className="panel form-panel">
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
                className="visually-hidden"
                type="file"
                accept=".pdf,.txt,.md,.eml,text/plain,message/rfc822,application/pdf"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setIntakeFile(nextFile);
                  setIntakeChannel(nextFile ? channelForFile(nextFile) : intakeChannel);
                  setDragActive(false);
                }}
              />
              <span className="eyebrow">Drag & Drop</span>
              <strong>Angebot, E-Mail oder Textdatei hier ablegen</strong>
              <p className="helper-text">
                PDF, E-Mail und Textdateien werden direkt in operative Veranstaltungsdaten überführt.
              </p>
              <span className="drag-drop-zone__cta">Datei auswählen</span>
            </label>
            {intakeFile ? <p className="helper-text">Ausgewählt: {intakeFile.name}</p> : null}
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
                Dokument übernehmen
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

          <article className="panel form-panel question-panel">
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
                </div>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => beginSpecEdit(focusedProductionSpec)}
                  >
                    Rückfragen beantworten
                  </button>
                  <button disabled={submitting} onClick={() => void handleCreatePlan(focusedProductionSpec)}>
                    Berechnung starten
                  </button>
                </div>
              </>
            ) : (
              <p className="helper-text">
                Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheinen hier die Rückfragen des Agenten.
              </p>
            )}
            {filteredSpecs.length > 1 ? (
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
                          onClick={() => setFocusedProductionSpecId(String(spec.specId))}
                        >
                          Für Rückfragen öffnen
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {editingSpecId ? (
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

          <article className="panel">
            <header>
              <p className="eyebrow">Schritt 3</p>
              <h3>Berechnete Ergebnisse</h3>
            </header>
            <ul className="item-list compact">
              {filteredPlans.map((plan) => (
                <li key={String(plan.planId)}>
                  <strong>{String(plan.planId)}</strong>
                  <p>Status: {translateReadiness(String((plan.readiness as Record<string, unknown>)?.status ?? "-"))}</p>
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
              ))}
              {filteredPlans.length === 0 ? <li>Noch keine Produktionspläne vorhanden.</li> : null}
            </ul>
            {selectedPlan ? (
              <>
                <div className="divider" />
                <header>
                  <p className="eyebrow">Plandetails</p>
                  <h3>{String(selectedPlan.planId)}</h3>
                </header>
                <p>
                  Offene Punkte:{" "}
                  {Array.isArray(selectedPlan.unresolvedItems) && selectedPlan.unresolvedItems.length > 0
                    ? selectedPlan.unresolvedItems.join(" · ")
                    : "keine"}
                </p>
                <ul className="item-list compact">
                  {Array.isArray(selectedPlan.recipeSelections)
                    ? selectedPlan.recipeSelections.map((selection) => {
                        const selectionRecord = selection as Record<string, unknown>;
                        return (
                          <li key={String(selectionRecord.componentId)}>
                            <strong>{String(selectionRecord.componentId)}</strong>
                            <p>{String(selectionRecord.selectionReason ?? "-")}</p>
                          </li>
                        );
                      })
                    : null}
                </ul>
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
              {filteredPurchaseLists.map((purchaseList) => (
                <li key={String(purchaseList.purchaseListId)}>
                  <strong>{String(purchaseList.purchaseListId)}</strong>
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
              ))}
              {filteredPurchaseLists.length === 0 ? <li>Noch keine Einkaufslisten vorhanden.</li> : null}
            </ul>
          </article>
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
