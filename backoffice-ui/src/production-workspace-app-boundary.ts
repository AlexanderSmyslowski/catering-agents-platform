import {
  buildProductionWorkspaceControls,
  type ProductionWorkspaceControls,
  type ProductionWorkspaceControlsInput
} from "./production-workspace-controls.js";
import {
  buildProductionWorkspaceResetCallbacks,
  type ProductionWorkspaceResetCallbacks,
  type ProductionWorkspaceResetCallbacksInput
} from "./production-workspace-reset-callbacks.js";

export type ProductionWorkspaceAppBoundaryInput =
  Omit<
    ProductionWorkspaceControlsInput,
    | "clearFocusedProductionSpecId"
    | "clearSelectedPlanId"
    | "resetPlanProgress"
    | "resetIntakeRequestDetail"
    | "resetSpecEdit"
    | "clearUploadInput"
  > &
  ProductionWorkspaceResetCallbacksInput;

export type ProductionWorkspaceAppBoundary = {
  productionWorkspaceResetCallbacks: ProductionWorkspaceResetCallbacks;
  productionWorkspaceControls: ProductionWorkspaceControls;
};

export function buildProductionWorkspaceAppBoundary(
  input: ProductionWorkspaceAppBoundaryInput
): ProductionWorkspaceAppBoundary {
  const productionWorkspaceResetCallbacks = buildProductionWorkspaceResetCallbacks({
    setFocusedProductionSpecId: input.setFocusedProductionSpecId,
    setSelectedPlanId: input.setSelectedPlanId,
    resetPlanProgress: input.resetPlanProgress,
    resetIntakeRequestDetail: input.resetIntakeRequestDetail,
    resetSpecEdit: input.resetSpecEdit,
    uploadInputRef: input.uploadInputRef
  });

  return {
    productionWorkspaceResetCallbacks,
    productionWorkspaceControls: buildProductionWorkspaceControls({
      ...input,
      ...productionWorkspaceResetCallbacks
    })
  };
}
