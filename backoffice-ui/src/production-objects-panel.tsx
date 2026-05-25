import type { CSSProperties } from "react";
import { getSpecLabel } from "./production-language.js";
import { ProductionPlanDownloadCard } from "./production-plan-download-card.js";
import { ProductionPlanList } from "./production-plan-list.js";
import { ProductionPlanSecondaryDetails } from "./production-plan-secondary-details.js";

type ProductionObjectsPanelProps = {
  planPhase: "idle" | "planning" | "done";
  planningSpecLabel?: string;
  planProgress: number;
  planEtaSeconds?: number;
  focusedProductionSpec?: Record<string, unknown>;
  productionWorkspaceCleared: boolean;
  currentSpecPlans: Array<Record<string, unknown>>;
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  submitting: boolean;
  setSelectedPlanId: (planId: string) => void;
};

function formatEta(seconds: number): string {
  if (seconds <= 1) {
    return "weniger als 1 Sekunde";
  }
  return `${seconds} Sekunden`;
}

export function ProductionObjectsPanel({
  planPhase,
  planningSpecLabel,
  planProgress,
  planEtaSeconds,
  focusedProductionSpec,
  productionWorkspaceCleared,
  currentSpecPlans,
  selectedPlan,
  selectedPlanSpec,
  selectedPlanComponentsById,
  archivedPlans,
  specById,
  submitting,
  setSelectedPlanId
}: ProductionObjectsPanelProps) {
  return (
    <article className="panel production-step-card">
      <header>
        <p className="eyebrow">Produktionsobjekte</p>
        <h3>Plan und Ergebnis leise prüfen</h3>
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
          : "Hier erscheinen die Ergebnisse für den aktuell ausgewählten Vorgang. Ältere Läufe bleiben in den Details abrufbar."}
      </p>
      {!productionWorkspaceCleared ? (
        <ProductionPlanList
          plans={currentSpecPlans}
          specById={specById}
          submitting={submitting}
          setSelectedPlanId={setSelectedPlanId}
        />
      ) : null}
      {selectedPlan ? (
        <>
          <ProductionPlanDownloadCard selectedPlan={selectedPlan} selectedPlanSpec={selectedPlanSpec} />

          <ProductionPlanSecondaryDetails
            selectedPlan={selectedPlan}
            selectedPlanComponentsById={selectedPlanComponentsById}
            archivedPlans={archivedPlans}
            specById={specById}
            submitting={submitting}
            setSelectedPlanId={setSelectedPlanId}
            showArchivedPlans={!productionWorkspaceCleared}
          />
        </>
      ) : null}
    </article>
  );
}
