import { getSpecLabel } from "./production-language.js";
import {
  completeProductionStateAfterPlanSuccess,
  prepareProductionSpecForPlanning,
  resetProductionStateAfterPlanFailure,
  startProductionPlanRunState,
  type ProductionPlanFailureActions,
  type ProductionPlanStartActions,
  type ProductionPlanSuccessActions,
  type ProductionSpecPlanningPreflightActions
} from "./production-plan-result-state.js";

export type ProductionPlanSubmissionServices = {
  createProductionPlan: (spec: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export type ProductionPlanSubmissionCallbacks =
  ProductionSpecPlanningPreflightActions &
  ProductionPlanStartActions &
  ProductionPlanSuccessActions &
  ProductionPlanFailureActions & {
    setSubmitting: (submitting: boolean) => void;
    setProductionWorkspaceCleared: (cleared: boolean) => void;
    clearMessages: () => void;
  };

export type ProductionPlanSubmissionActionInput =
  ProductionPlanSubmissionServices &
  ProductionPlanSubmissionCallbacks & {
    editingSpecId?: string;
  };

export function buildProductionPlanSubmissionAction({
  createProductionPlan,
  editingSpecId,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  persistCurrentSpecEdit,
  startPlanProgress,
  clearSelectedPlanId,
  setSelectedPlanId,
  refreshDashboard,
  completePlanProgress,
  failPlanProgress,
  setNotice,
  setError
}: ProductionPlanSubmissionActionInput) {
  return async function handleCreatePlan(spec: Record<string, unknown>) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const specForPlanning = await prepareProductionSpecForPlanning(spec, editingSpecId, {
        persistCurrentSpecEdit,
        setNotice
      });

      const specLabel = getSpecLabel(specForPlanning);
      startProductionPlanRunState(specForPlanning, specLabel, {
        startPlanProgress,
        clearSelectedPlanId,
        setNotice
      });
      const response = await createProductionPlan(specForPlanning);
      await completeProductionStateAfterPlanSuccess(response, {
        setSelectedPlanId,
        refreshDashboard,
        completePlanProgress,
        setNotice
      });
    } catch (submitError) {
      resetProductionStateAfterPlanFailure(submitError, {
        failPlanProgress,
        setError
      });
    } finally {
      setSubmitting(false);
    }
  };
}
