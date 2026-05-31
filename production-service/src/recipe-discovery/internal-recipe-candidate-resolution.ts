import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "@catering/shared-core";
import {
  buildInternalRecipeResolution,
  type InternalRecipeResolution
} from "./internal-recipe-resolution.js";
import { selectInternalRecipeCandidate } from "./internal-recipe-selection.js";
import {
  appendInternalRecipeCandidatesTrace,
  appendInternalRecipeWinnerTrace
} from "./internal-recipe-trace.js";
import type { RecipeSearchTrace } from "./recipe-search-trace.js";

export function resolveInternalRecipeCandidate(input: {
  repositoryCandidates: Recipe[];
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  searchTrace: RecipeSearchTrace;
}): InternalRecipeResolution | undefined {
  const {
    repositoryCandidates,
    component,
    eventSpec,
    searchTrace
  } = input;
  const internalWinner = selectInternalRecipeCandidate(repositoryCandidates, component, eventSpec);

  appendInternalRecipeCandidatesTrace(searchTrace, repositoryCandidates);

  if (!internalWinner?.recipe) {
    return undefined;
  }

  appendInternalRecipeWinnerTrace(searchTrace, internalWinner.recipe);
  return buildInternalRecipeResolution({
    component,
    winner: internalWinner,
    searchTrace: searchTrace.entries
  });
}
