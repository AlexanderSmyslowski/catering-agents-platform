import type {
  Recipe,
  RecipeSearchQuery
} from "@catering/shared-core";

export type WebRecipeSelectionCandidate = {
  recipe: Recipe;
  query: RecipeSearchQuery;
};

export function selectWebRecipeCandidate(
  candidates: WebRecipeSelectionCandidate[]
): WebRecipeSelectionCandidate | undefined {
  return candidates.sort((left, right) => {
    const leftScore = left.recipe.source.qualityScore * 1.4 + left.recipe.source.fitScore;
    const rightScore = right.recipe.source.qualityScore * 1.4 + right.recipe.source.fitScore;
    return rightScore - leftScore;
  })[0];
}
