import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "@catering/shared-core";
import { recipeSupportsMenuCategory } from "./menu-category-compatibility.js";
import {
  fitScoreForRecipe,
  leadNameMatchScore,
  primaryMatchScore,
  specificPrimaryMatchScore
} from "./recipe-candidate-scoring.js";
import { recipeSearchText } from "./recipe-query-builder.js";

const tierWeight: Record<Recipe["source"]["tier"], number> = {
  internal_verified: 4,
  digitized_cookbook: 3,
  internal_approved: 2,
  internet_fallback: 1
};

export type InternalRecipeCandidate = {
  recipe: Recipe;
  repositoryRank: number;
  fitScore: number;
  primaryScore: number;
  specificPrimaryScore: number;
  leadNameScore: number;
};

export function selectInternalRecipeCandidate(
  repositoryCandidates: Recipe[],
  component: MenuComponent,
  eventSpec: AcceptedEventSpec
): InternalRecipeCandidate | undefined {
  return repositoryCandidates
    .filter((recipe) => recipeSupportsMenuCategory(recipe, component))
    .map((recipe, index) => ({
      recipe,
      repositoryRank: index,
      fitScore: fitScoreForRecipe(recipeSearchText(recipe), component, eventSpec),
      primaryScore: primaryMatchScore(recipeSearchText(recipe), component),
      specificPrimaryScore: specificPrimaryMatchScore(recipeSearchText(recipe), component),
      leadNameScore: leadNameMatchScore(recipe.name, component)
    }))
    .filter(
      (candidate) =>
        (candidate.fitScore >= 0.75 ||
          (candidate.repositoryRank === 0 &&
            candidate.leadNameScore === 1 &&
            candidate.fitScore >= 0.55)) &&
        (candidate.primaryScore >= 0.5 || candidate.leadNameScore === 1) &&
        (candidate.specificPrimaryScore >= 0.34 || candidate.leadNameScore === 1)
    )
    .sort((left, right) => {
      const tierDifference =
        tierWeight[right.recipe.source.tier] - tierWeight[left.recipe.source.tier];
      if (tierDifference !== 0) {
        return tierDifference;
      }

      const rankDifference = left.repositoryRank - right.repositoryRank;
      if (rankDifference !== 0) {
        return rankDifference;
      }

      const leftScore =
        left.fitScore + left.specificPrimaryScore * 0.5 + left.leadNameScore * 0.35;
      const rightScore =
        right.fitScore + right.specificPrimaryScore * 0.5 + right.leadNameScore * 0.35;
      return rightScore - leftScore;
    })[0];
}
