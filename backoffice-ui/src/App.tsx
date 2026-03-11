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
  offerExportUrl,
  productionExportUrl,
  purchaseListExportUrl,
  type DashboardState
} from "./api.js";

const emptyState: DashboardState = {
  intakeRequests: [],
  acceptedSpecs: [],
  offerDrafts: [],
  productionPlans: [],
  purchaseLists: [],
  recipes: []
};

function getSpecLabel(spec: Record<string, unknown>): string {
  const event = spec.event as Record<string, unknown> | undefined;
  const attendees = spec.attendees as Record<string, unknown> | undefined;
  return `${event?.type ?? "Event"} | ${attendees?.expected ?? "?"} pax | ${event?.date ?? "offen"}`;
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [intakeText, setIntakeText] = useState(
    "Konferenz am 2026-06-18 fuer 90 Teilnehmer mit Lunchbuffet, Tomatensuppe und Kaffeestation."
  );
  const [offerText, setOfferText] = useState(
    "Meeting am 2026-06-25 fuer 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const refreshDashboard = useEffectEvent(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const state = await loadDashboardState();
      startTransition(() => {
        setDashboard(state);
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
      </section>

      <section className="toolbar">
        <input
          className="search"
          placeholder="Filter specs, plans or drafts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
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
                <p>{String((recipe.source as Record<string, unknown>)?.tier ?? "-")}</p>
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
