import {
  selectArchivedProductionItems,
  selectCurrentProductionItems
} from "./production-route-state.js";

export type ProductionCurrentArtifactsState<
  TPlan extends Record<string, unknown>,
  TPurchaseList extends Record<string, unknown>
> = {
  currentSpecPlans: TPlan[];
  archivedPlans: TPlan[];
  currentSpecPurchaseLists: TPurchaseList[];
  archivedPurchaseLists: TPurchaseList[];
};

export function buildProductionCurrentArtifactsState<
  TPlan extends Record<string, unknown>,
  TPurchaseList extends Record<string, unknown>
>(input: {
  currentProductionSpecId: string;
  orderedPlans: TPlan[];
  orderedPurchaseLists: TPurchaseList[];
  productionWorkspaceCleared: boolean;
}): ProductionCurrentArtifactsState<TPlan, TPurchaseList> {
  const currentItemInput = {
    currentProductionSpecId: input.currentProductionSpecId,
    productionWorkspaceCleared: input.productionWorkspaceCleared
  };

  return {
    currentSpecPlans: selectCurrentProductionItems({
      ...currentItemInput,
      items: input.orderedPlans
    }),
    archivedPlans: selectArchivedProductionItems({
      ...currentItemInput,
      items: input.orderedPlans
    }),
    currentSpecPurchaseLists: selectCurrentProductionItems({
      ...currentItemInput,
      items: input.orderedPurchaseLists
    }),
    archivedPurchaseLists: selectArchivedProductionItems({
      ...currentItemInput,
      items: input.orderedPurchaseLists
    })
  };
}
