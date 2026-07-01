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

export type ProductionWorkspaceClearActions = {
  resetProductionWorkspaceState: () => void;
  clearMessages: () => void;
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

export function clearProductionWorkspaceState(actions: ProductionWorkspaceClearActions) {
  actions.resetProductionWorkspaceState();
  actions.clearMessages();
  actions.setNotice("Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert.");
}

export async function completeProductionIntakeArchiveSuccess(
  actions: ProductionIntakeArchiveSuccessActions
) {
  actions.resetProductionWorkspaceState();
  await actions.refreshDashboard();
  actions.setNotice(
    "Fehlupload wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
  );
}
