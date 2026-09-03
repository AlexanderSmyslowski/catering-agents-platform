import {
  assertBusinessId,
  type AcceptedEventSpec,
  type BusinessContext,
  type PurchaseItem,
  type QuantityRecipeProductionBridgeResult,
  type RecipeEventUseReview
} from "@catering/shared-core";
import type { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import { procurementItemsForComponent } from "./procurement-rules.js";
import {
  buildRecipeComponentPlanningArtifacts,
  type RecipeComponentPlanningArtifacts
} from "./planning-recipe-component-artifacts.js";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

export type RecipeBranchPlanningArtifacts = {
  procurementItems: PurchaseItem[];
  recipeArtifacts: RecipeComponentPlanningArtifacts;
};

export async function buildRecipeBranchPlanningArtifacts(input: {
  eventSpec: AcceptedEventSpec;
  component: MenuPlanComponent;
  servings: number;
  bridgeResult?: QuantityRecipeProductionBridgeResult;
  recipeEventUseReview?: RecipeEventUseReview;
  allowQuantityRecipeBridgeResolver?: boolean;
  discoveryService: RecipeDiscoveryService;
  context: BusinessContext;
  persistDiscoveredRecipes?: boolean;
}): Promise<RecipeBranchPlanningArtifacts> {
  const {
    eventSpec,
    component,
    servings,
    bridgeResult,
    recipeEventUseReview,
    allowQuantityRecipeBridgeResolver,
    discoveryService,
    context,
    persistDiscoveredRecipes = true
  } = input;
  if (!context) throw new Error("Ein Betriebskontext ist erforderlich.");
  assertBusinessId(context.businessId);

  return {
    procurementItems: procurementItemsForComponent(component, servings),
    recipeArtifacts: await buildRecipeComponentPlanningArtifacts({
      eventSpec,
      component,
      servings,
      bridgeResult,
      recipeEventUseReview,
      allowQuantityRecipeBridgeResolver,
      discoveryService,
      context,
      persistDiscoveredRecipes
    })
  };
}
