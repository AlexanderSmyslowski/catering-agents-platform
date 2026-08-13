import type { Recipe } from "@catering/shared-core";
import {
  countProductRecipeReviewStates,
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
  return buildRecipeStatusSummary(input.recipes);
}

export function buildProductRecipeStatusSummaryState(input: {
  recipes: Recipe[];
}): ProductionRecipeStatusSummaryState {
  const recipeReviewCounts = countProductRecipeReviewStates(input.recipes);
  return {
    recipeReviewCounts,
    recipeReviewStatusLabel: formatRecipeReviewStatusLabel(recipeReviewCounts),
    recipeUsageStatusLabel: formatRecipeUsageStatusLabel(recipeReviewCounts),
    recipeCount: input.recipes.length
  };
}

function buildRecipeStatusSummary(recipes: Array<{ source?: { approvalState?: string } }>): ProductionRecipeStatusSummaryState {
  const recipeReviewCounts = countRecipeReviewStates(recipes);

  return {
    recipeReviewCounts,
    recipeReviewStatusLabel: formatRecipeReviewStatusLabel(recipeReviewCounts),
    recipeUsageStatusLabel: formatRecipeUsageStatusLabel(recipeReviewCounts),
    recipeCount: recipes.length
  };
}
