import {
  buildProductionIntakeArchiveAction,
  type ProductionIntakeArchiveServices
} from "./production-intake-archive-action.js";
import {
  buildProductionWorkspaceActionState,
  type ProductionWorkspaceActionState
} from "./production-workspace-action-state.js";
import {
  buildProductionWorkspaceUiActions,
  type ProductionWorkspaceUiActionsInput
} from "./production-workspace-ui-actions.js";

export type ProductionWorkspaceControlsInput =
  Omit<ProductionWorkspaceUiActionsInput, "setError"> &
  ProductionIntakeArchiveServices & {
    hasFocusedProductionSpec: boolean;
    hasSelectedPlan: boolean;
    hasIntakeFile: boolean;
    hasActiveDocumentName: boolean;
    documentPhase: string;
    planPhase: string;
    hasFocusedProductionSpecId: boolean;
    hasSelectedPlanId: boolean;
    currentIntakeRequestId?: string;
    productionWorkspaceCleared: boolean;
    setSubmitting: (submitting: boolean) => void;
    setError: (message: string | undefined) => void;
    refreshDashboard: () => Promise<void>;
  };

export type ProductionWorkspaceControls = ProductionWorkspaceActionState & {
  clearMessages: () => void;
  resetProductionWorkspaceState: () => void;
  clearProductionWorkspace: () => void;
  handleArchiveCurrentIntake: () => Promise<void>;
};

export function buildProductionWorkspaceControls(
  input: ProductionWorkspaceControlsInput
): ProductionWorkspaceControls {
  const actionState = buildProductionWorkspaceActionState({
    hasFocusedProductionSpec: input.hasFocusedProductionSpec,
    hasSelectedPlan: input.hasSelectedPlan,
    hasIntakeFile: input.hasIntakeFile,
    hasActiveDocumentName: input.hasActiveDocumentName,
    documentPhase: input.documentPhase,
    planPhase: input.planPhase,
    hasFocusedProductionSpecId: input.hasFocusedProductionSpecId,
    hasSelectedPlanId: input.hasSelectedPlanId,
    currentIntakeRequestId: input.currentIntakeRequestId,
    productionWorkspaceCleared: input.productionWorkspaceCleared
  });

  const workspaceUiActions = buildProductionWorkspaceUiActions({
    setError: input.setError,
    setNotice: input.setNotice,
    setProductionWorkspaceCleared: input.setProductionWorkspaceCleared,
    resetIntakeDraft: input.resetIntakeDraft,
    resetDocumentProgress: input.resetDocumentProgress,
    clearFocusedProductionSpecId: input.clearFocusedProductionSpecId,
    clearSelectedPlanId: input.clearSelectedPlanId,
    resetPlanProgress: input.resetPlanProgress,
    resetIntakeRequestDetail: input.resetIntakeRequestDetail,
    resetSpecEdit: input.resetSpecEdit,
    clearUploadInput: input.clearUploadInput
  });

  return {
    ...actionState,
    ...workspaceUiActions,
    handleArchiveCurrentIntake: buildProductionIntakeArchiveAction({
      archiveIntakeRequest: input.archiveIntakeRequest,
      currentIntakeRequestId: input.currentIntakeRequestId,
      setSubmitting: input.setSubmitting,
      clearMessages: workspaceUiActions.clearMessages,
      resetProductionWorkspaceState: workspaceUiActions.resetProductionWorkspaceState,
      refreshDashboard: input.refreshDashboard,
      setNotice: input.setNotice,
      setError: input.setError
    })
  };
}
