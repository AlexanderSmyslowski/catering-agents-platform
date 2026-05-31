import type { ProductionObjectsState } from "./production-objects-panel.js";

export type ProductionObjectsStateInput = {
  focusedProductionSpec?: Record<string, unknown>;
  productionWorkspaceCleared: boolean;
  currentSpecPlans: Array<Record<string, unknown>>;
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
};

export function buildProductionObjectsState({
  focusedProductionSpec,
  productionWorkspaceCleared,
  currentSpecPlans,
  selectedPlan,
  selectedPlanSpec,
  selectedPlanComponentsById,
  archivedPlans,
  specById
}: ProductionObjectsStateInput): ProductionObjectsState {
  return {
    focusedProductionSpec,
    productionWorkspaceCleared,
    currentSpecPlans,
    selectedPlan,
    selectedPlanSpec,
    selectedPlanComponentsById,
    archivedPlans,
    specById
  };
}
