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

export function selectCurrentProductionArtifactsScopeSpecId(input: {
  focusedProductionSpecId?: string;
  selectedPlanId?: string;
  orderedPlans: Array<Record<string, unknown>>;
}): string {
  const focusedProductionSpecId = input.focusedProductionSpecId?.trim();
  if (focusedProductionSpecId) {
    return focusedProductionSpecId;
  }

  const selectedPlan = input.selectedPlanId
    ? input.orderedPlans.find((plan) => String(plan.planId ?? "") === input.selectedPlanId)
    : undefined;
  const fallbackPlan = selectedPlan ?? input.orderedPlans[0];
  return String(fallbackPlan?.eventSpecId ?? "");
}

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
