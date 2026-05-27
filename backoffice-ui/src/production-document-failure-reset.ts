export type ProductionDocumentFailureResetActions = {
  failIncomingProductionFile: (file: File) => void;
  failDocumentProgress: () => void;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  clearFocusedProductionSpecId: () => void;
  clearSelectedPlanId: () => void;
  resetPlanProgress: () => void;
  resetIntakeRequestDetail: () => void;
  resetSpecEdit: (markDismissed: boolean) => void;
};

export function resetProductionStateAfterDocumentFailure(
  file: File,
  actions: ProductionDocumentFailureResetActions
) {
  actions.failIncomingProductionFile(file);
  actions.failDocumentProgress();
  actions.setProductionWorkspaceCleared(true);
  actions.clearFocusedProductionSpecId();
  actions.clearSelectedPlanId();
  actions.resetPlanProgress();
  actions.resetIntakeRequestDetail();
  actions.resetSpecEdit(false);
}
