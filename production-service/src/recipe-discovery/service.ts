import type {
  AcceptedEventSpec,
  MenuComponent,
  RecipeSelection,
  Recipe
} from "@catering/shared-core";
import { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";
import { type WebRecipeSearchProvider } from "./provider.js";
import { selectInternalRecipeCandidate } from "./internal-recipe-selection.js";
import { buildInternalRecipeResolution } from "./internal-recipe-resolution.js";
import {
  buildMissingOverrideRecipeResolution,
  buildOverrideRecipeResolution
} from "./override-recipe-resolution.js";
import { createRecipeSearchTrace } from "./recipe-search-trace.js";
import {
  appendInternalRecipeCandidatesTrace,
  appendInternalRecipeWinnerTrace
} from "./internal-recipe-trace.js";
import { selectWebRecipeCandidate } from "./web-recipe-selection.js";
import {
  buildUnresolvedWebRecipeResolution,
  buildWebRecipeWinnerResolution
} from "./web-recipe-resolution.js";
import { collectWebRecipeCandidates } from "./web-recipe-candidate-search.js";

export interface RecipeResolution {
  recipe?: Recipe;
  selection: RecipeSelection;
  unresolvedItems: string[];
}

export class RecipeDiscoveryService {
  constructor(
    private readonly repository: InMemoryRecipeRepository,
    private readonly webProvider: WebRecipeSearchProvider
  ) {}

  async resolveRecipeOverride(
    recipeId: string,
    component: MenuComponent
  ): Promise<RecipeResolution> {
    const recipe = await this.repository.get(recipeId);
    if (!recipe) {
      return buildMissingOverrideRecipeResolution({ recipeId, component });
    }

    return buildOverrideRecipeResolution({ recipe, component });
  }

  async resolveRecipe(
    component: MenuComponent,
    eventSpec: AcceptedEventSpec
  ): Promise<RecipeResolution> {
    const searchTrace = createRecipeSearchTrace();
    const repositoryCandidates = await this.repository.findCandidates(component);
    const internalWinner = selectInternalRecipeCandidate(repositoryCandidates, component, eventSpec);

    appendInternalRecipeCandidatesTrace(searchTrace, repositoryCandidates);

    if (internalWinner?.recipe) {
      appendInternalRecipeWinnerTrace(searchTrace, internalWinner.recipe);
      return buildInternalRecipeResolution({
        component,
        winner: internalWinner,
        searchTrace: searchTrace.entries
      });
    }

    const { candidates, webSearchFailed } = await collectWebRecipeCandidates({
      component,
      eventSpec,
      webProvider: this.webProvider,
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

    await this.repository.save(winner.recipe);
    searchTrace.push(`Webtreffer gewählt: ${winner.recipe.name}.`);

    return buildWebRecipeWinnerResolution({
      component,
      winner,
      searchTrace: searchTrace.entries
    });
  }
}
