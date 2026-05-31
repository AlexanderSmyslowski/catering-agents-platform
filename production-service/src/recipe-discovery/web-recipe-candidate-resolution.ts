import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "@catering/shared-core";
import type { WebRecipeSearchProvider } from "./provider.js";
import type { RecipeSearchTrace } from "./recipe-search-trace.js";
import { collectWebRecipeCandidates } from "./web-recipe-candidate-search.js";
import {
  buildUnresolvedWebRecipeResolution,
  buildWebRecipeWinnerResolution,
  type WebRecipeResolution
} from "./web-recipe-resolution.js";
import { selectWebRecipeCandidate } from "./web-recipe-selection.js";
import { appendWebRecipeWinnerTrace } from "./web-recipe-trace.js";

export type WebRecipeRepositoryWriter = {
  save: (recipe: Recipe) => Promise<unknown>;
};

export async function resolveWebRecipeCandidate(input: {
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  webProvider: WebRecipeSearchProvider;
  repository: WebRecipeRepositoryWriter;
  searchTrace: RecipeSearchTrace;
}): Promise<WebRecipeResolution> {
  const {
    component,
    eventSpec,
    webProvider,
    repository,
    searchTrace
  } = input;
  const { candidates, webSearchFailed } = await collectWebRecipeCandidates({
    component,
    eventSpec,
    webProvider,
    searchTrace
  });

  const winner = selectWebRecipeCandidate(candidates);

  if (!winner) {
    return buildUnresolvedWebRecipeResolution({
      component,
      searchTrace: searchTrace.entries,
      webSearchFailed
    });
  }

  await repository.save(winner.recipe);
  appendWebRecipeWinnerTrace(searchTrace, winner.recipe);

  return buildWebRecipeWinnerResolution({
    component,
    winner,
    searchTrace: searchTrace.entries
  });
}
