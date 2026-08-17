import { recipeSourceExportMetadataForRecipe } from "./export-source-metadata.js";
import type { QuantityRecipeProductionBridgeResult } from "./quantity-recipe-production-bridge.js";
import { scaleRecipe } from "./rules/scaling.js";
import type { ProductionBatch, Recipe } from "./types.js";

export interface ProductionBatchMaterializationInput {
  eventSpecId: string;
  componentId: string;
  recipe: Recipe;
  bridgeResult: QuantityRecipeProductionBridgeResult;
}

export function materializeProductionBatchFromBridge(
  input: ProductionBatchMaterializationInput
): Omit<ProductionBatch, "batchId" | "station" | "prepWindow" | "gnPlan"> {
  const { bridgeResult } = input;

  if (bridgeResult.status !== "ready_for_scaling") {
    throw new Error("bridge_not_ready_for_scaling");
  }

  if (bridgeResult.eventSpecId !== input.eventSpecId) {
    throw new Error("bridge_event_binding_mismatch");
  }

  if (bridgeResult.componentId !== input.componentId) {
    throw new Error("bridge_component_binding_mismatch");
  }

  if (bridgeResult.recipeId !== input.recipe.recipeId) {
    throw new Error("bridge_recipe_binding_mismatch");
  }

  if (
    bridgeResult.targetServings === undefined ||
    !Number.isFinite(bridgeResult.targetServings) ||
    bridgeResult.targetServings <= 0
  ) {
    throw new Error("bridge_target_servings_invalid");
  }

  const scaled = scaleRecipe(input.recipe, bridgeResult.targetServings);

  return {
    componentId: input.componentId,
    recipeId: input.recipe.recipeId,
    scaledYield: scaled.scaledYield,
    batchCount: scaled.batchCount,
    lossFactor: input.recipe.scalingRules.defaultLossFactor,
    ingredients: scaled.ingredients,
    steps: scaled.steps,
    recipeSource: recipeSourceExportMetadataForRecipe(input.recipe)
  };
}
