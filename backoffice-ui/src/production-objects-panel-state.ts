import { getSpecLabel } from "./production-language.js";
import type { ProductionObjectsState, ProductionPlanProgressState } from "./production-objects-panel.js";

export type ProductionObjectsPanelStateInput = {
  progressState: ProductionPlanProgressState;
  objectsState: ProductionObjectsState;
};

export type ProductionObjectsPanelState = {
  planPhase: ProductionPlanProgressState["planPhase"];
  planningSpecLabel?: string;
  clampedPlanProgress: number;
  planEtaSeconds?: number;
  showPlanningProgress: boolean;
  showDoneProgress: boolean;
  currentRunTitle: string;
  currentRunHelperText: string;
  showCurrentPlans: boolean;
  showSelectedPlanDetails: boolean;
  showArchivedPlans: boolean;
};

export function formatProductionObjectsEta(seconds: number): string {
  if (seconds <= 1) {
    return "weniger als 1 Sekunde";
  }
  return `${seconds} Sekunden`;
}

export function buildProductionObjectsPanelState({
  progressState,
  objectsState
}: ProductionObjectsPanelStateInput): ProductionObjectsPanelState {
  const { planPhase, planningSpecLabel, planProgress, planEtaSeconds } = progressState;
  const { focusedProductionSpec, productionWorkspaceCleared, selectedPlan } = objectsState;

  return {
    planPhase,
    planningSpecLabel,
    clampedPlanProgress: Math.max(0, Math.min(planProgress, 100)),
    planEtaSeconds,
    showPlanningProgress: planPhase === "planning" && Boolean(planningSpecLabel),
    showDoneProgress: planPhase === "done" && Boolean(planningSpecLabel),
    currentRunTitle: focusedProductionSpec
      ? getSpecLabel(focusedProductionSpec)
      : productionWorkspaceCleared
        ? "Kein aktiver Vorgang"
        : "Neuester Produktionslauf",
    currentRunHelperText: productionWorkspaceCleared
      ? "Die Ergebnisfelder wurden geleert. Ein neuer Upload oder eine neue Erfassung füllt diesen Bereich wieder."
      : "Hier erscheinen die Ergebnisse für den aktuell ausgewählten Vorgang. Ältere geladene Läufe bleiben eingeklappt getrennt und sind kein aktueller Vorgang.",
    showCurrentPlans: !productionWorkspaceCleared,
    showSelectedPlanDetails: Boolean(selectedPlan),
    showArchivedPlans: !productionWorkspaceCleared
  };
}
