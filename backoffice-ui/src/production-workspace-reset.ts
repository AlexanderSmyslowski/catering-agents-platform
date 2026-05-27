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

export type ProductionIntakeArchiveSuccessActions = {
  resetProductionWorkspaceState: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
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

export async function completeProductionIntakeArchiveSuccess(
  archivedRequestId: string,
  actions: ProductionIntakeArchiveSuccessActions
) {
  actions.resetProductionWorkspaceState();
  await actions.refreshDashboard();
  actions.setNotice(
    `Fehlupload ${archivedRequestId} wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen.`
  );
}
