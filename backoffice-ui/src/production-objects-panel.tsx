import type { CSSProperties } from "react";
import type { ProductionMiniPilotActionState } from "./production-mini-pilot-action-state.js";
import {
  buildProductionObjectsPanelState,
  formatProductionObjectsEta
} from "./production-objects-panel-state.js";
import { ProductionPlanDownloadCard } from "./production-plan-download-card.js";
import { ProductionPlanList } from "./production-plan-list.js";
import { ProductionPlanSecondaryDetails } from "./production-plan-secondary-details.js";

export type ProductionPlanProgressState = {
  planPhase: "idle" | "planning" | "done";
  planningSpecLabel?: string;
  planProgress: number;
  planEtaSeconds?: number;
};

export type ProductionObjectsState = {
  focusedProductionSpec?: Record<string, unknown>;
  productionWorkspaceCleared: boolean;
  currentSpecPlans: Array<Record<string, unknown>>;
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
};

export type ProductionObjectsActions = {
  setSelectedPlanId: (planId: string) => void;
};

type ProductionObjectsPanelProps = {
  progressState: ProductionPlanProgressState;
  objectsState: ProductionObjectsState;
  objectsActions: ProductionObjectsActions;
  submitting: boolean;
  miniPilotActionState: ProductionMiniPilotActionState;
  clearMiniPilotResult?: () => void;
};

export function ProductionObjectsPanel({
  progressState,
  objectsState,
  objectsActions,
  submitting,
  miniPilotActionState,
  clearMiniPilotResult
}: ProductionObjectsPanelProps) {
  const panelState = buildProductionObjectsPanelState({
    progressState,
    objectsState
  });
  const {
    focusedProductionSpec,
    currentSpecPlans,
    selectedPlan,
    selectedPlanSpec,
    selectedPlanComponentsById,
    archivedPlans,
    specById
  } = objectsState;
  const { setSelectedPlanId } = objectsActions;

  return (
    <article className="panel production-step-card">
      <header>
        <p className="eyebrow">Produktionsobjekte</p>
        <h3>Plan und Ergebnis leise prüfen</h3>
      </header>
      <div className="activity-slot">
        {panelState.showPlanningProgress ? (
          <div className="progress-panel">
            <div
              className="progress-ring"
              style={
                {
                  "--progress-angle": `${panelState.clampedPlanProgress * 3.6}deg`
                } as CSSProperties
              }
            >
              <span>{panelState.clampedPlanProgress}%</span>
            </div>
            <div className="progress-panel__content">
              <p className="processing-note">
                Rezeptsuche, Produktionsplanung und Einkaufsberechnung laufen für {panelState.planningSpecLabel} ...
              </p>
              <div className="progress-bar">
                <div
                  className="progress-bar__fill"
                  style={{ width: `${panelState.clampedPlanProgress}%` }}
                />
              </div>
              <p className="helper-text">
                Geschätzte Restzeit: {formatProductionObjectsEta(panelState.planEtaSeconds ?? 1)}
              </p>
            </div>
          </div>
        ) : null}
        {panelState.showDoneProgress ? (
          <div className="progress-panel">
            <div
              className="progress-ring progress-ring--done"
              style={{ "--progress-angle": "360deg" } as CSSProperties}
            >
              <span>100%</span>
            </div>
            <div className="progress-panel__content">
              <p className="processing-note processing-note--success">
                Produktionsplan wurde für {panelState.planningSpecLabel} erzeugt.
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
        <h4 className="subsection-title">{panelState.currentRunTitle}</h4>
      </header>
      <p className="helper-text">{panelState.currentRunHelperText}</p>
      {panelState.showCurrentPlans ? (
        <ProductionPlanList
          plans={currentSpecPlans}
          specById={specById}
          submitting={submitting}
          setSelectedPlanId={setSelectedPlanId}
        />
      ) : null}
      {panelState.showSelectedPlanDetails ? (
        <>
          <ProductionPlanDownloadCard
            selectedPlan={selectedPlan}
            selectedPlanSpec={selectedPlanSpec}
            miniPilotActionState={miniPilotActionState}
            onClearMiniPilotResult={clearMiniPilotResult}
          />

          <ProductionPlanSecondaryDetails
            selectedPlan={selectedPlan}
            selectedPlanComponentsById={selectedPlanComponentsById}
            archivedPlans={archivedPlans}
            specById={specById}
            submitting={submitting}
            setSelectedPlanId={setSelectedPlanId}
            showArchivedPlans={panelState.showArchivedPlans}
          />
        </>
      ) : null}
    </article>
  );
}
