import { extractProductionPlanId } from "./production-api-response-ids.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionPlanStartActions = {
  startPlanProgress: (spec: Record<string, unknown>, specLabel: string) => void;
  clearSelectedPlanId: () => void;
  setNotice: (message: string) => void;
};

export type ProductionSpecPlanningPreflightActions = {
  persistCurrentSpecEdit: (options: { quiet: true }) => Promise<Record<string, unknown> | undefined>;
  setNotice: (message: string) => void;
};

export type ProductionPlanSuccessActions = {
  setSelectedPlanId: (planId: string) => void;
  refreshDashboard: () => Promise<void>;
  completePlanProgress: () => void;
  setNotice: (message: string) => void;
};

export type ProductionPlanFailureActions = {
  failPlanProgress: () => void;
  setError: (message: string) => void;
};

export function startProductionPlanRunState(
  spec: Record<string, unknown>,
  specLabel: string,
  actions: ProductionPlanStartActions
) {
  actions.startPlanProgress(spec, specLabel);
  actions.clearSelectedPlanId();
  actions.setNotice("Rezeptsuche, Produktionsplanung und Einkaufsberechnung laufen...");
}

export async function prepareProductionSpecForPlanning(
  spec: Record<string, unknown>,
  editingSpecId: string | undefined,
  actions: ProductionSpecPlanningPreflightActions
) {
  const focusedSpecId = String(spec.specId ?? "");
  if (!editingSpecId || editingSpecId !== focusedSpecId) {
    return spec;
  }

  actions.setNotice("Antworten werden übernommen...");
  return (await actions.persistCurrentSpecEdit({ quiet: true })) ?? spec;
}

export async function completeProductionStateAfterPlanSuccess(
  response: Record<string, unknown>,
  actions: ProductionPlanSuccessActions
) {
  const planId = extractProductionPlanId(response);
  if (planId) {
    actions.setSelectedPlanId(planId);
  }
  await actions.refreshDashboard();
  actions.completePlanProgress();
  actions.setNotice("Produktionsplan ist zur fachlichen Prüfung bereit; keine automatische Produktionsfreigabe.");
}

export function resetProductionStateAfterPlanFailure(
  submitError: unknown,
  actions: ProductionPlanFailureActions
) {
  actions.failPlanProgress();
  actions.setError(
    formatSubmitErrorMessage(submitError, "Produktionsplan konnte nicht erstellt werden.")
  );
}
