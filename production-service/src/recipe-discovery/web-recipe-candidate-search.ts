import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe,
  RecipeSearchQuery
} from "@catering/shared-core";
import type { WebRecipeSearchProvider } from "./provider.js";
import type { RecipeSearchTrace } from "./recipe-search-trace.js";
import { isStrongRecipeCandidate } from "./recipe-candidate-scoring.js";
import { buildSearchQueries } from "./recipe-query-builder.js";
import { materializeWebRecipeCandidate } from "./web-recipe-candidate-materialization.js";

export interface MaterializedWebRecipeCandidate {
  recipe: Recipe;
  query: RecipeSearchQuery;
}

export interface WebRecipeCandidateSearchResult {
  candidates: MaterializedWebRecipeCandidate[];
  webSearchFailed: boolean;
}

export async function collectWebRecipeCandidates({
  component,
  eventSpec,
  webProvider,
  searchTrace
}: {
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  webProvider: WebRecipeSearchProvider;
  searchTrace: RecipeSearchTrace;
}): Promise<WebRecipeCandidateSearchResult> {
  const locales: ("de" | "en")[] = ["de", "en"];
  const candidates: MaterializedWebRecipeCandidate[] = [];
  let webSearchFailed = false;

  for (const locale of locales) {
    for (const queryText of buildSearchQueries(component, eventSpec, locale)) {
      const query: RecipeSearchQuery = {
        component,
        eventSpec,
        locale,
        query: queryText
      };

      try {
        searchTrace.push(`Websuche: ${query.query}`);
        const searchResults = await webProvider.searchRecipes(query);

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
      } catch {
        webSearchFailed = true;
        searchTrace.push(`Websuche fehlgeschlagen: ${query.query}`);
      }

      if (candidates.some((candidate) => isStrongRecipeCandidate(candidate.recipe))) {
        break;
      }
    }

    if (candidates.some((candidate) => isStrongRecipeCandidate(candidate.recipe))) {
      break;
    }
  }

  return { candidates, webSearchFailed };
}
