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

export function buildInternalRecipeCandidate(input: {
  recipe: Recipe;
  repositoryRank: number;
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
}): InternalRecipeCandidate {
  const recipeText = recipeSearchText(input.recipe);

  return {
    recipe: input.recipe,
    repositoryRank: input.repositoryRank,
    fitScore: fitScoreForRecipe(recipeText, input.component, input.eventSpec),
    primaryScore: primaryMatchScore(recipeText, input.component),
    specificPrimaryScore: specificPrimaryMatchScore(recipeText, input.component),
    leadNameScore: leadNameMatchScore(input.recipe.name, input.component)
  };
}

export function internalRecipeCandidatePassesThresholds(
  candidate: InternalRecipeCandidate
): boolean {
  return (
    (candidate.fitScore >= 0.75 ||
      (candidate.repositoryRank === 0 &&
        candidate.leadNameScore === 1 &&
        candidate.fitScore >= 0.55)) &&
    (candidate.primaryScore >= 0.5 || candidate.leadNameScore === 1) &&
    (candidate.specificPrimaryScore >= 0.34 || candidate.leadNameScore === 1)
  );
}

function internalRecipeCandidateSortScore(candidate: InternalRecipeCandidate): number {
  return candidate.fitScore + candidate.specificPrimaryScore * 0.5 + candidate.leadNameScore * 0.35;
}

export function compareInternalRecipeCandidates(
  left: InternalRecipeCandidate,
  right: InternalRecipeCandidate
): number {
  const tierDifference =
    tierWeight[right.recipe.source.tier] - tierWeight[left.recipe.source.tier];
  if (tierDifference !== 0) {
    return tierDifference;
  }

  const rankDifference = left.repositoryRank - right.repositoryRank;
  if (rankDifference !== 0) {
    return rankDifference;
  }

  return internalRecipeCandidateSortScore(right) - internalRecipeCandidateSortScore(left);
}

export function rankInternalRecipeCandidates(
  candidates: InternalRecipeCandidate[]
): InternalRecipeCandidate[] {
  return [...candidates].sort(compareInternalRecipeCandidates);
}

export function selectInternalRecipeCandidate(
  repositoryCandidates: Recipe[],
  component: MenuComponent,
  eventSpec: AcceptedEventSpec
): InternalRecipeCandidate | undefined {
  const candidates = repositoryCandidates
    .filter((recipe) => recipeSupportsMenuCategory(recipe, component))
    .map((recipe, index) =>
      buildInternalRecipeCandidate({
        recipe,
        repositoryRank: index,
        component,
        eventSpec
      })
    )
    .filter(internalRecipeCandidatePassesThresholds);

  return rankInternalRecipeCandidates(candidates)[0];
}
