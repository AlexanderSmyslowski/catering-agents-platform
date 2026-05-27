import {
  canArchiveCurrentIntake,
  canClearProductionWorkspace
} from "./production-route-state.js";

export type ProductionWorkspaceActionState = {
  canClearProductionWorkspace: boolean;
  canArchiveCurrentIntake: boolean;
};

export function buildProductionWorkspaceActionState(input: {
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
}): ProductionWorkspaceActionState {
  return {
    canClearProductionWorkspace: canClearProductionWorkspace({
      hasFocusedProductionSpec: input.hasFocusedProductionSpec,
      hasSelectedPlan: input.hasSelectedPlan,
      hasIntakeFile: input.hasIntakeFile,
      hasActiveDocumentName: input.hasActiveDocumentName,
      documentPhase: input.documentPhase,
      planPhase: input.planPhase,
      hasFocusedProductionSpecId: input.hasFocusedProductionSpecId,
      hasSelectedPlanId: input.hasSelectedPlanId
    }),
    canArchiveCurrentIntake: canArchiveCurrentIntake({
      currentIntakeRequestId: input.currentIntakeRequestId,
      productionWorkspaceCleared: input.productionWorkspaceCleared
    })
  };
}
