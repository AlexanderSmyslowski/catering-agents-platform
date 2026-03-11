import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState
} from "react";
import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";
import {
  createAcceptedSpecFromText,
  createOfferFromText,
  createProductionPlan,
  loadDashboardState,
  loadServiceHealth,
  offerExportUrl,
  persistOperatorName,
  productionExportUrl,
  purchaseListExportUrl,
  readOperatorName,
  reviewRecipe,
  seedDemoData,
  uploadRecipeFile,
  type DashboardState,
  type RecipeReviewDecision,
  type ServiceHealthState
} from "./api.js";

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

function getSpecLabel(spec: Record<string, unknown>): string {
  const event = spec.event as Record<string, unknown> | undefined;
  const attendees = spec.attendees as Record<string, unknown> | undefined;
  return `${event?.type ?? "Event"} | ${attendees?.expected ?? "?"} pax | ${event?.date ?? "offen"}`;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "No counters";
  }

  return entries
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ");
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthState>(emptyHealth);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [operatorName, setOperatorName] = useState(() => readOperatorName());
  const [intakeText, setIntakeText] = useState(
    "Konferenz am 2026-06-18 fuer 90 Teilnehmer mit Lunchbuffet, Tomatensuppe und Kaffeestation."
  );
  const [offerText, setOfferText] = useState(
    "Meeting am 2026-06-25 fuer 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
  );
  const [recipeName, setRecipeName] = useState("");
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const refreshDashboard = useEffectEvent(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const [state, health] = await Promise.all([
        loadDashboardState(),
        loadServiceHealth()
      ]);
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
          : "Failed to load dashboard."
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

  async function handleIntakeSubmit() {
    setSubmitting(true);
    setError(undefined);
    try {
      await createAcceptedSpecFromText(intakeText);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to normalize intake."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOfferSubmit() {
    setSubmitting(true);
    setError(undefined);
    try {
      await createOfferFromText(offerText);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create offer draft."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePlan(spec: Record<string, unknown>) {
    setSubmitting(true);
    setError(undefined);
    try {
      await createProductionPlan(spec);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create production plan."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecipeUpload(target: "offer" | "production") {
    if (!recipeFile) {
      setError("Please choose a recipe file before uploading.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await uploadRecipeFile(target, recipeFile, recipeName);
      setRecipeFile(null);
      setRecipeName("");
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to upload recipe."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSeedDemoData() {
    setSubmitting(true);
    setError(undefined);
    try {
      await seedDemoData();
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to seed demo data."
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
    setError(undefined);
    try {
      await reviewRecipe(target, recipeId, decision);
      await refreshDashboard();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to review recipe."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOperatorNameChange(value: string) {
    const persisted = persistOperatorName(value);
    setOperatorName(persisted);
  }

  return (
    <DashboardShell title="Catering Operations Backoffice">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Shared Core Live View</p>
          <h2>Offer, intake and production now run against the same persisted contracts.</h2>
          <p className="lede">
            The dashboard reads the real service APIs and lets operations create intake specs,
            generate offer drafts and trigger production plans from the browser.
          </p>
        </div>
        <div className="metrics-grid">
          <StatusCard
            title="Accepted Specs"
            body={`${dashboard.acceptedSpecs.length} persisted event specs ready for operations.`}
          />
          <StatusCard
            title="Offer Drafts"
            body={`${dashboard.offerDrafts.length} customer-facing drafts available.`}
          />
          <StatusCard
            title="Production Plans"
            body={`${dashboard.productionPlans.length} kitchen plans with linked purchase lists.`}
          />
          <StatusCard
            title="Recipe Inventory"
            body={`${dashboard.recipes.length} recipes cached, including internet fallbacks.`}
          />
          <StatusCard
            title="Audit Trail"
            body={`${dashboard.auditEvents.length} recent actions with operator attribution.`}
          />
        </div>
        <div className="metrics-grid">
          <StatusCard
            title="Intake Health"
            body={`${serviceHealth.intake.status} | ${formatCounts(serviceHealth.intake.counts)}`}
          />
          <StatusCard
            title="Offer Health"
            body={`${serviceHealth.offers.status} | ${formatCounts(serviceHealth.offers.counts)}`}
          />
          <StatusCard
            title="Production Health"
            body={`${serviceHealth.production.status} | ${formatCounts(serviceHealth.production.counts)}`}
          />
          <StatusCard
            title="Export Health"
            body={`${serviceHealth.exports.status} | ${formatCounts(serviceHealth.exports.counts)}`}
          />
        </div>
      </section>

      <section className="wide-grid">
        <article className="panel form-panel">
          <header>
            <p className="eyebrow">Manual Intake</p>
            <h3>Normalize free text into AcceptedEventSpec</h3>
          </header>
          <textarea value={intakeText} onChange={(event) => setIntakeText(event.target.value)} />
          <button disabled={submitting} onClick={() => void handleIntakeSubmit()}>
            Intake normalisieren
          </button>
        </article>

        <article className="panel form-panel">
          <header>
            <p className="eyebrow">Offer Workspace</p>
            <h3>Create an offer draft from free text</h3>
          </header>
          <textarea value={offerText} onChange={(event) => setOfferText(event.target.value)} />
          <button disabled={submitting} onClick={() => void handleOfferSubmit()}>
            Angebot entwerfen
          </button>
        </article>

        <article className="panel form-panel">
          <header>
            <p className="eyebrow">Recipe Library</p>
            <h3>Upload PDF or text recipes into the shared library</h3>
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
          <p className="helper-text">
            Uploads ueber Angebots- oder Produktionsagent erweitern dieselbe Rezeptbibliothek.
          </p>
          <div className="action-row">
            <button disabled={submitting} onClick={() => void handleRecipeUpload("offer")}>
              Zum Angebotsagenten hochladen
            </button>
            <button disabled={submitting} onClick={() => void handleRecipeUpload("production")}>
              Zur Produktion hochladen
            </button>
          </div>
          {recipeFile ? <p className="helper-text">Ausgewaehlt: {recipeFile.name}</p> : null}
        </article>
      </section>

      <section className="toolbar">
        <input
          className="operator-input"
          placeholder="Operator name"
          value={operatorName}
          onChange={(event) => handleOperatorNameChange(event.target.value)}
        />
        <input
          className="search"
          placeholder="Filter specs, plans or drafts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button disabled={loading || submitting} onClick={() => void handleSeedDemoData()}>
          Demo-Daten laden
        </button>
        <button disabled={loading || submitting} onClick={() => void refreshDashboard()}>
          Refresh
        </button>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="wide-grid">
        <article className="panel">
          <header>
            <p className="eyebrow">AcceptedEventSpec</p>
            <h3>Operational event inputs</h3>
          </header>
          <ul className="item-list">
            {filteredSpecs.map((spec) => (
              <li key={String(spec.specId)} className="list-row">
                <div>
                  <strong>{getSpecLabel(spec)}</strong>
                  <p>Readiness: {String((spec.readiness as Record<string, unknown>)?.status ?? "-")}</p>
                </div>
                <button
                  disabled={submitting}
                  onClick={() => void handleCreatePlan(spec)}
                >
                  Produktion planen
                </button>
              </li>
            ))}
            {filteredSpecs.length === 0 ? <li>No specs yet.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Audit Trail</p>
            <h3>Recent operator actions across all services</h3>
          </header>
          <ul className="item-list compact">
            {filteredAuditEvents.map((entry) => (
              <li key={String(entry.auditId)}>
                <strong>{String(entry.summary ?? entry.action ?? entry.auditId)}</strong>
                <p className="helper-text">
                  {String(entry.at ?? "-")} | {String((entry.actor as Record<string, unknown>)?.name ?? "-")} |{" "}
                  {String(entry.action ?? "-")}
                </p>
              </li>
            ))}
            {filteredAuditEvents.length === 0 ? <li>No audit events yet.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Production</p>
            <h3>Kitchen output and recipe cache</h3>
          </header>
          <ul className="item-list compact">
            {filteredPlans.map((plan) => (
              <li key={String(plan.planId)}>
                <strong>{String(plan.planId)}</strong>
                <p>Readiness: {String((plan.readiness as Record<string, unknown>)?.status ?? "-")}</p>
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
            {filteredPlans.length === 0 ? <li>No production plans yet.</li> : null}
          </ul>
          <div className="divider" />
          <ul className="item-list compact">
            {dashboard.recipes.slice(0, 8).map((recipe) => (
              <li key={String(recipe.recipeId)}>
                <strong>{String(recipe.name)}</strong>
                <p>
                  {String((recipe.source as Record<string, unknown>)?.tier ?? "-")} |{" "}
                  {String((recipe.source as Record<string, unknown>)?.approvalState ?? "-")}
                </p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() =>
                      void handleRecipeReview("production", String(recipe.recipeId), "approve")
                    }
                  >
                    Freigeben
                  </button>
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() =>
                      void handleRecipeReview("production", String(recipe.recipeId), "verify")
                    }
                  >
                    Verifizieren
                  </button>
                  <button
                    className="secondary-button destructive-button"
                    disabled={submitting}
                    onClick={() =>
                      void handleRecipeReview("production", String(recipe.recipeId), "reject")
                    }
                  >
                    Ablehnen
                  </button>
                </div>
              </li>
            ))}
            {dashboard.recipes.length === 0 ? <li>No recipes yet.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Offer Drafts</p>
            <h3>Latest commercial outputs</h3>
          </header>
          <ul className="item-list compact">
            {dashboard.offerDrafts.map((draft) => (
              <li key={String(draft.draftId)}>
                <strong>{String(draft.draftId)}</strong>
                <p>{String(draft.eventSummary ?? "-")}</p>
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
            {dashboard.offerDrafts.length === 0 ? <li>No offer drafts yet.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <header>
            <p className="eyebrow">Purchase Lists</p>
            <h3>CSV-ready procurement outputs</h3>
          </header>
          <ul className="item-list compact">
            {dashboard.purchaseLists.map((purchaseList) => (
              <li key={String(purchaseList.purchaseListId)}>
                <strong>{String(purchaseList.purchaseListId)}</strong>
                <p>Items: {String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}</p>
                <a
                  className="ghost-link"
                  href={purchaseListExportUrl(String(purchaseList.purchaseListId))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Einkaufsliste CSV
                </a>
              </li>
            ))}
            {dashboard.purchaseLists.length === 0 ? <li>No purchase lists yet.</li> : null}
          </ul>
        </article>
      </section>

      <footer className="footer-note">
        {loading ? "Loading live platform state..." : "Live data loaded from intake, offer and production services."}
      </footer>
    </DashboardShell>
  );
}
