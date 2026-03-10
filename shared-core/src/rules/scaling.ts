import type { IngredientLine, ProductionBatch, Quantity, Recipe, RecipeStep } from "../types.js";

function roundQuantity(amount: number): number {
  return Number(amount.toFixed(2));
}

export interface ScaledRecipeResult {
  scaledYield: Quantity;
  ingredients: IngredientLine[];
  steps: RecipeStep[];
  batchCount: number;
}

export function scaleRecipe(
  recipe: Recipe,
  targetServings: number
): ScaledRecipeResult {
  const effectiveServings = Math.max(targetServings, recipe.baseYield.servings);
  const factor = effectiveServings / recipe.baseYield.servings;
  const lossFactor = recipe.scalingRules.defaultLossFactor;
  const batchSize = recipe.scalingRules.batchSize ?? effectiveServings;
  const batchCount = Math.max(1, Math.ceil(effectiveServings / batchSize));

  return {
    scaledYield: {
      amount: roundQuantity(effectiveServings * lossFactor),
      unit: "servings"
    },
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: {
        ...ingredient.quantity,
        amount: roundQuantity(ingredient.quantity.amount * factor * lossFactor)
      }
    })),
    steps: recipe.steps,
    batchCount
  };
}

export function toProductionBatch(
  recipe: Recipe,
  componentId: string,
  targetServings: number
): Omit<ProductionBatch, "batchId" | "station" | "prepWindow" | "gnPlan"> {
  const scaled = scaleRecipe(recipe, targetServings);

  return {
    componentId,
    recipeId: recipe.recipeId,
    scaledYield: scaled.scaledYield,
    batchCount: scaled.batchCount,
    lossFactor: recipe.scalingRules.defaultLossFactor,
    ingredients: scaled.ingredients,
    steps: scaled.steps
  };
}

