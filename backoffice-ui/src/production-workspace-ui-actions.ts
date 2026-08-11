import {
  clearProductionWorkspaceState,
  resetProductionWorkspace
} from "./production-workspace-reset.js";

export type ProductionWorkspaceUiActionsInput = {
  setError: (message: undefined) => void;
  setNotice: (message: string | undefined) => void;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  resetIntakeDraft: () => void;
  resetDocumentProgress: () => void;
  clearFocusedProductionSpecId: () => void;
  clearSelectedPlanId: () => void;
  resetPlanProgress: () => void;
  resetIntakeRequestDetail: () => void;
  resetSpecEdit: (markDismissed: boolean) => void;
  clearActiveProductionCaseId: () => void;
  clearUploadInput: () => void;
};

export type ProductionWorkspaceUiActions = {
  clearMessages: () => void;
  resetProductionWorkspaceState: () => void;
  clearProductionWorkspace: () => void;
};

export function buildProductionWorkspaceUiActions({
  setError,
  setNotice,
  setProductionWorkspaceCleared,
  resetIntakeDraft,
  resetDocumentProgress,
  clearFocusedProductionSpecId,
  clearSelectedPlanId,
  resetPlanProgress,
  resetIntakeRequestDetail,
  resetSpecEdit,
  clearActiveProductionCaseId,
  clearUploadInput
}: ProductionWorkspaceUiActionsInput): ProductionWorkspaceUiActions {
  function clearMessages() {
    setError(undefined);
    setNotice(undefined);
  }

  function resetProductionWorkspaceState() {
    resetProductionWorkspace({
      setProductionWorkspaceCleared,
      resetIntakeDraft,
      resetDocumentProgress,
      clearFocusedProductionSpecId,
      clearSelectedPlanId,
      resetPlanProgress,
      resetIntakeRequestDetail,
      resetSpecEdit,
      clearActiveProductionCaseId,
      clearUploadInput
    });
  }

  function clearProductionWorkspace() {
    clearProductionWorkspaceState({
      resetProductionWorkspaceState,
      clearMessages,
      setNotice
    });
  }

  return {
    clearMessages,
    resetProductionWorkspaceState,
    clearProductionWorkspace
  };
}
