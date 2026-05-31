import type {
  MenuComponent,
  Recipe,
  RecipeSelection
} from "@catering/shared-core";
import type { InternalRecipeCandidate } from "./internal-recipe-selection.js";

export type InternalRecipeResolution = {
  recipe: Recipe;
  selection: RecipeSelection;
  unresolvedItems: string[];
};

export function buildInternalRecipeResolution(input: {
  component: MenuComponent;
  winner: InternalRecipeCandidate;
  searchTrace: string[];
}): InternalRecipeResolution {
  const {
    component,
    winner,
    searchTrace
  } = input;
  const { recipe } = winner;

  return {
    recipe,
    selection: {
      componentId: component.componentId,
      recipeId: recipe.recipeId,
      selectionReason: "Passendes Rezept in der internen Bibliothek gefunden.",
      autoUsedInternetRecipe: false,
      searchTrace,
      sourceTier: recipe.source.tier,
      qualityScore: recipe.source.qualityScore,
      fitScore: winner.fitScore
    },
    unresolvedItems: []
  };
}
