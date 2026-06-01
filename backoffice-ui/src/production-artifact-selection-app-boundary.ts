import {
  buildProductionCurrentArtifactsState,
  selectCurrentProductionArtifactsScopeSpecId,
  type ProductionCurrentArtifactsState
} from "./production-current-artifacts-state.js";
import {
  buildProductionSelectedPlanState,
  type ProductionSelectedPlanState
} from "./production-selected-plan-state.js";

export type ProductionArtifactSelectionAppBoundary<
  TPlan extends Record<string, unknown>,
  TPurchaseList extends Record<string, unknown>
> = ProductionCurrentArtifactsState<TPlan, TPurchaseList> &
  ProductionSelectedPlanState<TPlan> & {
    currentProductionSpecId: string;
  };

export function buildProductionArtifactSelectionAppBoundary<
  TPlan extends Record<string, unknown>,
  TPurchaseList extends Record<string, unknown>
>(input: {
  focusedProductionSpecId?: string;
  selectedPlanId?: string;
  orderedPlans: TPlan[];
  orderedPurchaseLists: TPurchaseList[];
  productionWorkspaceCleared: boolean;
  specById: Map<string, Record<string, unknown>>;
}): ProductionArtifactSelectionAppBoundary<TPlan, TPurchaseList> {
  const currentProductionSpecId = selectCurrentProductionArtifactsScopeSpecId({
    focusedProductionSpecId: input.focusedProductionSpecId,
    selectedPlanId: input.selectedPlanId,
    orderedPlans: input.orderedPlans
  });
  const currentArtifacts = buildProductionCurrentArtifactsState({
    currentProductionSpecId,
    orderedPlans: input.orderedPlans,
    orderedPurchaseLists: input.orderedPurchaseLists,
    productionWorkspaceCleared: input.productionWorkspaceCleared
  });
  const selectedPlanState = buildProductionSelectedPlanState({
    currentProductionSpecId,
    currentSpecPlans: currentArtifacts.currentSpecPlans,
    orderedPlans: input.orderedPlans,
    productionWorkspaceCleared: input.productionWorkspaceCleared,
    selectedPlanId: input.selectedPlanId,
    specById: input.specById
  });

  return {
    currentProductionSpecId,
    ...currentArtifacts,
    ...selectedPlanState
  };
}
