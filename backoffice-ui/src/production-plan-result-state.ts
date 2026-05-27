import { extractProductionPlanId } from "./production-api-response-ids.js";

export type ProductionPlanStartActions = {
  startPlanProgress: (spec: Record<string, unknown>, specLabel: string) => void;
  clearSelectedPlanId: () => void;
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
  actions.setNotice("Produktionsplan wurde erzeugt.");
}

export function resetProductionStateAfterPlanFailure(
  submitError: unknown,
  actions: ProductionPlanFailureActions
) {
  actions.failPlanProgress();
  actions.setError(
    submitError instanceof Error ? submitError.message : "Produktionsplan konnte nicht erstellt werden."
  );
}
