import type {
  MenuComponent,
  Recipe,
  RecipeSelection
} from "@catering/shared-core";

export type OverrideRecipeResolution = {
  recipe?: Recipe;
  selection: RecipeSelection;
  unresolvedItems: string[];
};

export function buildMissingOverrideRecipeResolution(input: {
  recipeId: string;
  component: MenuComponent;
}): OverrideRecipeResolution {
  const { recipeId, component } = input;

  return {
    selection: {
      componentId: component.componentId,
      selectionReason: `Das manuell hinterlegte Rezept ${recipeId} wurde in der Bibliothek nicht gefunden.`,
      searchTrace: [`Manuelle Rezeptzuweisung: ${recipeId}`, "Bibliothekstreffer: nicht gefunden."],
      autoUsedInternetRecipe: false
    },
    unresolvedItems: [`Rezeptzuweisung ${recipeId} für ${component.label} ist ungültig.`]
  };
}

export function buildOverrideRecipeResolution(input: {
  recipe: Recipe;
  component: MenuComponent;
}): OverrideRecipeResolution {
  const { recipe, component } = input;

  return {
    recipe,
    selection: {
      componentId: component.componentId,
      recipeId: recipe.recipeId,
      selectionReason: "Rezept wurde manuell aus der Bibliothek zugewiesen.",
      searchTrace: [`Manuelle Rezeptzuweisung: ${recipe.name} (${recipe.recipeId}).`],
      autoUsedInternetRecipe: false,
      sourceTier: recipe.source.tier,
      qualityScore: recipe.source.qualityScore,
      fitScore: recipe.source.fitScore
    },
    unresolvedItems: []
  };
}
