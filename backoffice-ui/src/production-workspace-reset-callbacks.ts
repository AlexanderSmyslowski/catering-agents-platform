export type ProductionWorkspaceResetCallbacksInput = {
  setFocusedProductionSpecId: (specId: string | undefined) => void;
  setSelectedPlanId: (planId: string | undefined) => void;
  resetPlanProgress: () => void;
  resetIntakeRequestDetail: () => void;
  resetSpecEdit: (markDismissed: boolean) => void;
  uploadInputRef: { current: { value: string } | null };
};

export type ProductionWorkspaceResetCallbacks = {
  clearFocusedProductionSpecId: () => void;
  clearSelectedPlanId: () => void;
  resetPlanProgress: () => void;
  resetIntakeRequestDetail: () => void;
  resetSpecEdit: (markDismissed: boolean) => void;
  clearUploadInput: () => void;
};

export function buildProductionWorkspaceResetCallbacks(
  input: ProductionWorkspaceResetCallbacksInput
): ProductionWorkspaceResetCallbacks {
  return {
    clearFocusedProductionSpecId: () => input.setFocusedProductionSpecId(undefined),
    clearSelectedPlanId: () => input.setSelectedPlanId(undefined),
    resetPlanProgress: input.resetPlanProgress,
    resetIntakeRequestDetail: input.resetIntakeRequestDetail,
    resetSpecEdit: input.resetSpecEdit,
    clearUploadInput: () => {
      if (input.uploadInputRef.current) {
        input.uploadInputRef.current.value = "";
      }
    }
  };
}
