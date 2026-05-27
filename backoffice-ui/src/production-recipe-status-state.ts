import {
  countRecipeReviewStates,
  formatRecipeReviewStatusLabel,
  formatRecipeUsageStatusLabel,
  type RecipeReviewCounts
} from "./production-recipe-review-state.js";

export type ProductionRecipeStatusSummaryState = {
  recipeReviewCounts: RecipeReviewCounts;
  recipeReviewStatusLabel: string;
  recipeUsageStatusLabel: string;
  recipeCount: number;
};

export function buildProductionRecipeStatusSummaryState(input: {
  recipes: Array<Record<string, unknown>>;
}): ProductionRecipeStatusSummaryState {
  const recipeReviewCounts = countRecipeReviewStates(input.recipes);

  return {
    recipeReviewCounts,
    recipeReviewStatusLabel: formatRecipeReviewStatusLabel(recipeReviewCounts),
    recipeUsageStatusLabel: formatRecipeUsageStatusLabel(recipeReviewCounts),
    recipeCount: input.recipes.length
  };
}
