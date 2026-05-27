export type ProductionWorkspaceResetActions = {
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  resetIntakeDraft: () => void;
  resetDocumentProgress: () => void;
  clearFocusedProductionSpecId: () => void;
  clearSelectedPlanId: () => void;
  resetPlanProgress: () => void;
  resetIntakeRequestDetail: () => void;
  resetSpecEdit: (markDismissed: boolean) => void;
  clearUploadInput: () => void;
};

export function resetProductionWorkspace(actions: ProductionWorkspaceResetActions) {
  actions.setProductionWorkspaceCleared(true);
  actions.resetIntakeDraft();
  actions.resetDocumentProgress();
  actions.clearFocusedProductionSpecId();
  actions.clearSelectedPlanId();
  actions.resetPlanProgress();
  actions.resetIntakeRequestDetail();
  actions.resetSpecEdit(false);
  actions.clearUploadInput();
}
