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

export type ProductionDraftPreparationSuccessActions = {
  refreshDashboard: () => Promise<void>;
  completePlanProgress: () => void;
  setNotice: (message: string) => void;
  showProductionDraftReview: (draftId: string) => void;
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
  actions.setNotice("Vollständiger Produktionsentwurf wird vorbereitet...");
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

export async function completeProductionStateAfterDraftPreparation(
  response: { draft: { draftId: unknown } },
  actions: ProductionDraftPreparationSuccessActions
) {
  await actions.refreshDashboard();
  actions.completePlanProgress();
  actions.setNotice("Produktionsentwurf wurde vorbereitet und wartet auf Prüfung.");
  if (typeof response.draft.draftId === "string" && response.draft.draftId.trim()) {
    actions.showProductionDraftReview(response.draft.draftId);
  }
}

export function resetProductionStateAfterPlanFailure(
  submitError: unknown,
  actions: ProductionPlanFailureActions
) {
  actions.failPlanProgress();
  actions.setError(
    formatSubmitErrorMessage(submitError, "Produktionsentwurf konnte nicht vorbereitet werden.")
  );
}
