import { StatusCard } from "../components/status-card.js";
import type { DashboardState, ServiceHealthState } from "./api.js";
import {
  formatCounts,
  formatLatestAuditOverviewLabel,
  translateHealthStatus
} from "./app-shell-state.js";
import { buildHomeMiniPilotCardState } from "./home-mini-pilot-card-state.js";

type ReviewCounts = {
  approved: number;
  reviewRequired: number;
};

type HandoffCounts = {
  complete: number;
  partial: number;
};

type HomeRouteProps = {
  isInitialHomeLoading: boolean;
  dashboard: DashboardState;
  serviceHealth: ServiceHealthState;
  offerHandoffCounts: HandoffCounts;
  recipeReviewCounts: ReviewCounts;
  latestIntakeRequestSummary: string;
  filteredAuditEvents: Array<Record<string, unknown>>;
};

export function HomeRoute({
  isInitialHomeLoading,
  dashboard,
  serviceHealth,
  offerHandoffCounts,
  recipeReviewCounts,
  latestIntakeRequestSummary,
  filteredAuditEvents
}: HomeRouteProps) {
  const miniPilotCard = buildHomeMiniPilotCardState();

  return (
    <>
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

        <article className="panel">
          <header>
            <p className="eyebrow">{miniPilotCard.eyebrow}</p>
            <h3>{miniPilotCard.title}</h3>
            <p className="helper-text">{miniPilotCard.helperText}</p>
          </header>
          <ul className="item-list compact">
            {miniPilotCard.steps.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <p className="helper-text">{step.body}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  );
}
