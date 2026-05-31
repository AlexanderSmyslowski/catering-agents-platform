import type { Recipe } from "@catering/shared-core";
import type { RecipeSearchTrace } from "./recipe-search-trace.js";

export function appendInternalRecipeCandidatesTrace(
  searchTrace: RecipeSearchTrace,
  repositoryCandidates: Recipe[]
) {
  if (repositoryCandidates.length > 0) {
    searchTrace.push(
      `Interne Kandidaten: ${repositoryCandidates
        .slice(0, 3)
        .map((recipe) => recipe.name)
        .join(", ")}`
    );
    return;
  }

  searchTrace.push("Interne Kandidaten: keine Treffer.");
}

export function appendInternalRecipeWinnerTrace(searchTrace: RecipeSearchTrace, recipe: Recipe) {
  searchTrace.push(`Interner Treffer gewählt: ${recipe.name}.`);
}
