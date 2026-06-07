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
import {
  primarySearchSegment,
  recipeSearchText,
  specificPrimaryFocusTokens
} from "./recipe-query-builder.js";
import {
  normalizeComparableText,
  rawComparableTokens
} from "./recipe-text-normalization.js";

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
  specificPrimaryFocusTokenCount: number;
  exactPrimaryNameScore: number;
  genericPrimaryOnly: boolean;
};

const genericInternalPrimaryTokens = new Set([
  "bowl",
  "bowls",
  "salat",
  "salad",
  "suppe",
  "soup",
  "kuchen",
  "cake",
  "station"
]);

function isGenericInternalPrimaryOnly(label: string): boolean {
  const tokens = rawComparableTokens(primarySearchSegment(label));
  return tokens.length > 0 && tokens.every((token) => genericInternalPrimaryTokens.has(token));
}

export function buildInternalRecipeCandidate(input: {
  recipe: Recipe;
  repositoryRank: number;
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
}): InternalRecipeCandidate {
  const recipeText = recipeSearchText(input.recipe);
  const focusTokens = specificPrimaryFocusTokens(input.component);
  const exactPrimaryNameScore =
    normalizeComparableText(input.recipe.name) ===
    normalizeComparableText(primarySearchSegment(input.component.label))
      ? 1
      : 0;
  const genericPrimaryOnly = isGenericInternalPrimaryOnly(input.component.label);

  return {
    recipe: input.recipe,
    repositoryRank: input.repositoryRank,
    fitScore: fitScoreForRecipe(recipeText, input.component, input.eventSpec),
    primaryScore: primaryMatchScore(recipeText, input.component),
    specificPrimaryScore: specificPrimaryMatchScore(recipeText, input.component),
    leadNameScore: leadNameMatchScore(input.recipe.name, input.component),
    specificPrimaryFocusTokenCount: focusTokens.length,
    exactPrimaryNameScore,
    genericPrimaryOnly
  };
}

export function internalRecipeCandidatePassesThresholds(
  candidate: InternalRecipeCandidate
): boolean {
  if (
    candidate.genericPrimaryOnly &&
    candidate.exactPrimaryNameScore !== 1
  ) {
    return false;
  }

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
