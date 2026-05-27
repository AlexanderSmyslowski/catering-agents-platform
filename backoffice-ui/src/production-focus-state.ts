import {
  selectFocusedProductionSpec,
  selectProductionIntakeRequestId
} from "./production-route-state.js";

export type ProductionFocusState = {
  focusedProductionSpec?: Record<string, unknown>;
  focusedProductionSpecRecord?: Record<string, unknown>;
  currentIntakeRequestId?: string;
};

export function buildProductionFocusState(input: {
  acceptedSpecs: Array<Record<string, unknown>>;
  filteredSpecs: Array<Record<string, unknown>>;
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
  const focusedProductionSpecRecord = focusedProductionSpec as Record<string, unknown> | undefined;

  return {
    focusedProductionSpec,
    focusedProductionSpecRecord,
    currentIntakeRequestId:
      input.route === "production" && focusedProductionSpecRecord
        ? selectProductionIntakeRequestId(focusedProductionSpecRecord)
        : undefined
  };
}
