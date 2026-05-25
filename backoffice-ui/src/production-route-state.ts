export type ProductionRouteFocusSpec = Record<string, unknown>;

export function selectFocusedProductionSpec(input: {
  acceptedSpecs: ProductionRouteFocusSpec[];
  filteredSpecs: ProductionRouteFocusSpec[];
  focusedProductionSpecId?: string;
  productionWorkspaceCleared: boolean;
  route: string;
  searchText: string;
}): ProductionRouteFocusSpec | undefined {
  if (input.productionWorkspaceCleared) {
    return undefined;
  }

  const productionSearchActive = input.route === "production" && input.searchText.trim().length > 0;
  const preferred = input.focusedProductionSpecId
    ? input.filteredSpecs.find((spec) => String(spec.specId) === input.focusedProductionSpecId)
    : undefined;

  if (productionSearchActive) {
    return preferred ?? input.filteredSpecs[input.filteredSpecs.length - 1];
  }

  return preferred ?? input.filteredSpecs[input.filteredSpecs.length - 1] ?? input.acceptedSpecs[input.acceptedSpecs.length - 1];
}

export function selectCurrentProductionItems<T extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  items: T[];
  productionWorkspaceCleared: boolean;
}): T[] {
  if (input.productionWorkspaceCleared) {
    return [];
  }

  if (!input.currentProductionSpecId) {
    return input.items;
  }

  return input.items.filter((item) => String(item.eventSpecId ?? "") === input.currentProductionSpecId);
}

export function selectArchivedProductionItems<T extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  items: T[];
  productionWorkspaceCleared: boolean;
}): T[] {
  if (!input.currentProductionSpecId || input.productionWorkspaceCleared) {
    return [];
  }

  return input.items.filter((item) => String(item.eventSpecId ?? "") !== input.currentProductionSpecId);
}
