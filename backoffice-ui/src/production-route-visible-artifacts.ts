export type ProductionRouteVisibleArtifactsInput = {
  productionWorkspaceCleared: boolean;
  currentSpecPlans: Array<Record<string, unknown>>;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  archivedPurchaseLists: Array<Record<string, unknown>>;
};

export type ProductionRouteVisibleArtifacts = {
  currentSpecPlans: Array<Record<string, unknown>>;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  archivedPurchaseLists: Array<Record<string, unknown>>;
};

export function buildProductionRouteVisibleArtifacts(
  input: ProductionRouteVisibleArtifactsInput
): ProductionRouteVisibleArtifacts {
  if (input.productionWorkspaceCleared) {
    return {
      currentSpecPlans: [],
      currentSpecPurchaseLists: [],
      selectedPlan: undefined,
      selectedPlanSpec: undefined,
      selectedPlanComponentsById: new Map<string, Record<string, unknown>>(),
      archivedPlans: [],
      archivedPurchaseLists: []
    };
  }

  return {
    currentSpecPlans: input.currentSpecPlans,
    currentSpecPurchaseLists: input.currentSpecPurchaseLists,
    selectedPlan: input.selectedPlan,
    selectedPlanSpec: input.selectedPlanSpec,
    selectedPlanComponentsById: input.selectedPlanComponentsById,
    archivedPlans: input.archivedPlans,
    archivedPurchaseLists: input.archivedPurchaseLists
  };
}
