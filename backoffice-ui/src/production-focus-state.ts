import {
  selectFocusedProductionSpec,
  selectProductionIntakeRequestId
} from "./production-route-state.js";
import type { ProductionRouteFocusSpec } from "./production-route-state.js";

export type ProductionFocusState = {
  focusedProductionSpec?: ProductionRouteFocusSpec;
  focusedProductionSpecRecord?: ProductionRouteFocusSpec;
  currentIntakeRequestId?: string;
};

export function buildProductionFocusState(input: {
  acceptedSpecs: ProductionRouteFocusSpec[];
  filteredSpecs: ProductionRouteFocusSpec[];
  focusedProductionSpecId?: string;
  productionArtifactSpecIds: string[];
  productionWorkspaceCleared: boolean;
  route: string;
  searchText: string;
}): ProductionFocusState {
  const focusedProductionSpec = selectFocusedProductionSpec({
    acceptedSpecs: input.acceptedSpecs,
    filteredSpecs: input.filteredSpecs,
    focusedProductionSpecId: input.focusedProductionSpecId,
    productionArtifactSpecIds: input.productionArtifactSpecIds,
    productionWorkspaceCleared: input.productionWorkspaceCleared,
    route: input.route,
    searchText: input.searchText
  });
  const focusedProductionSpecRecord = focusedProductionSpec;

  return {
    focusedProductionSpec,
    focusedProductionSpecRecord,
    currentIntakeRequestId:
      input.route === "production" && focusedProductionSpecRecord
        ? selectProductionIntakeRequestId(focusedProductionSpecRecord)
        : undefined
  };
}
