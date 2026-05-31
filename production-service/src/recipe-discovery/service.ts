import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe,
  RecipeSearchQuery,
  RecipeSelection,
  WebRecipeCandidate
} from "@catering/shared-core";
import { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";
import { type WebRecipeSearchProvider } from "./provider.js";
import { buildSearchQueries } from "./recipe-query-builder.js";
import { isStrongRecipeCandidate } from "./recipe-candidate-scoring.js";
import { selectInternalRecipeCandidate } from "./internal-recipe-selection.js";
import { buildInternalRecipeResolution } from "./internal-recipe-resolution.js";
import {
  buildMissingOverrideRecipeResolution,
  buildOverrideRecipeResolution
} from "./override-recipe-resolution.js";
import { createRecipeSearchTrace } from "./recipe-search-trace.js";
import { selectWebRecipeCandidate } from "./web-recipe-selection.js";
import {
  buildUnresolvedWebRecipeResolution,
  buildWebRecipeWinnerResolution
} from "./web-recipe-resolution.js";
import { materializeWebRecipeCandidate } from "./web-recipe-candidate-materialization.js";

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

    if (repositoryCandidates.length > 0) {
      searchTrace.push(
        `Interne Kandidaten: ${repositoryCandidates
          .slice(0, 3)
          .map((recipe) => recipe.name)
          .join(", ")}`
      );
    } else {
      searchTrace.push("Interne Kandidaten: keine Treffer.");
    }

    if (internalWinner?.recipe) {
      searchTrace.push(`Interner Treffer gewählt: ${internalWinner.recipe.name}.`);
      return buildInternalRecipeResolution({
        component,
        winner: internalWinner,
        searchTrace: searchTrace.entries
      });
    }

    const locales: ("de" | "en")[] = ["de", "en"];
    const candidates: {
      recipe: Recipe;
      query: RecipeSearchQuery;
    }[] = [];
    let webSearchFailed = false;

    for (const locale of locales) {
      for (const queryText of buildSearchQueries(component, eventSpec, locale)) {
        const query: RecipeSearchQuery = {
          component,
          eventSpec,
          locale,
          query: queryText
        };

        let searchResults: WebRecipeCandidate[] = [];
        try {
          searchTrace.push(`Websuche: ${query.query}`);
          searchResults = await this.webProvider.searchRecipes(query);
        } catch {
          webSearchFailed = true;
          searchTrace.push(`Websuche fehlgeschlagen: ${query.query}`);
        }

        for (const candidate of searchResults) {
          const materialization = materializeWebRecipeCandidate({
            candidate,
            component,
            eventSpec,
            locale,
            query
          });
          if (materialization.traceMessage) {
            searchTrace.push(materialization.traceMessage);
          }
          if (materialization.candidate) {
            candidates.push(materialization.candidate);
          }
        }

        if (candidates.some((candidate) => isStrongRecipeCandidate(candidate.recipe))) {
          break;
        }
      }

      if (candidates.some((candidate) => isStrongRecipeCandidate(candidate.recipe))) {
        break;
      }
    }

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
