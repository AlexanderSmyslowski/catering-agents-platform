import {
  buildProductionPlanComponentMap,
  selectProductionPlanSpec,
  selectProductionWorkbenchPlan
} from "./production-route-state.js";

export type ProductionSelectedPlanState<TPlan extends Record<string, unknown>> = {
  selectedPlan?: TPlan;
  selectedPlanSpec?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
};

export function buildProductionSelectedPlanState<TPlan extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  currentSpecPlans: TPlan[];
  orderedPlans: TPlan[];
  productionWorkspaceCleared: boolean;
  selectedPlanId?: string;
  specById: Map<string, Record<string, unknown>>;
}): ProductionSelectedPlanState<TPlan> {
  const selectedPlan = selectProductionWorkbenchPlan({
    currentProductionSpecId: input.currentProductionSpecId,
    currentSpecPlans: input.currentSpecPlans,
    orderedPlans: input.orderedPlans,
    productionWorkspaceCleared: input.productionWorkspaceCleared,
    selectedPlanId: input.selectedPlanId
  });
  const selectedPlanSpec = selectProductionPlanSpec({
    selectedPlan,
    specsById: input.specById
  });

  return {
    selectedPlan,
    selectedPlanSpec,
    selectedPlanComponentsById: buildProductionPlanComponentMap(selectedPlanSpec)
  };
}
