import type {
  AcceptedEventSpec,
  BusinessContext,
  PurchaseItem
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
  discoveryService: RecipeDiscoveryService;
  context?: BusinessContext;
  persistDiscoveredRecipes?: boolean;
}): Promise<RecipeBranchPlanningArtifacts> {
  const {
    eventSpec,
    component,
    servings,
    discoveryService,
    context = { businessId: "local" },
    persistDiscoveredRecipes = true
  } = input;

  return {
    procurementItems: procurementItemsForComponent(component, servings),
    recipeArtifacts: await buildRecipeComponentPlanningArtifacts({
      eventSpec,
      component,
      servings,
      discoveryService,
      context,
      persistDiscoveredRecipes
    })
  };
}
