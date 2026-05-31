import type { Recipe } from "@catering/shared-core";
import type { RecipeSearchTrace } from "./recipe-search-trace.js";

export function appendWebRecipeWinnerTrace(searchTrace: RecipeSearchTrace, recipe: Recipe) {
  searchTrace.push(`Webtreffer gewählt: ${recipe.name}.`);
}
