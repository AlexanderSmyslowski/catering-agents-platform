import type {
  MenuComponent,
  Recipe,
  RecipeSearchQuery,
  RecipeSelection
} from "@catering/shared-core";

export type WebRecipeResolution = {
  recipe?: Recipe;
  selection: RecipeSelection;
  unresolvedItems: string[];
};

export type WebRecipeWinner = {
  recipe: Recipe;
  query: RecipeSearchQuery;
};

function categoryHintFor(component: MenuComponent): string {
  return component.menuCategory === "vegan"
    ? "veganer "
    : component.menuCategory === "vegetarian"
      ? "vegetarischer "
      : "";
}

function unresolvedSelectionReasonFor(component: MenuComponent, webSearchFailed: boolean): string {
  if (webSearchFailed) {
    return "Es konnte kein interner Rezeptkandidat gefunden werden und die Internetrecherche ist fehlgeschlagen.";
  }

  if (component.menuCategory === "vegan") {
    return "Es konnte kein interner oder externer veganer Rezeptkandidat belastbar validiert werden.";
  }

  if (component.menuCategory === "vegetarian") {
    return "Es konnte kein interner oder externer vegetarischer Rezeptkandidat belastbar validiert werden.";
  }

  return "Es konnte kein interner oder externer Rezeptkandidat belastbar validiert werden.";
}

export function buildUnresolvedWebRecipeResolution(input: {
  component: MenuComponent;
  searchTrace: string[];
  webSearchFailed: boolean;
}): WebRecipeResolution {
  const {
    component,
    searchTrace,
    webSearchFailed
  } = input;
  const categoryHint = categoryHintFor(component);

  return {
    selection: {
      componentId: component.componentId,
      selectionReason: unresolvedSelectionReasonFor(component, webSearchFailed),
      searchTrace,
      autoUsedInternetRecipe: false
    },
    unresolvedItems: [
      webSearchFailed
        ? `Kein ${categoryHint}Rezeptkandidat für ${component.label} gefunden, Internetrecherche fehlgeschlagen.`
        : `Kein ${categoryHint}Rezeptkandidat für ${component.label} gefunden.`
    ]
  };
}

export function buildWebRecipeWinnerResolution(input: {
  component: MenuComponent;
  winner: WebRecipeWinner;
  searchTrace: string[];
}): WebRecipeResolution {
  const {
    component,
    winner,
    searchTrace
  } = input;
  const { recipe } = winner;
  const autoUsedInternetRecipe = recipe.source.approvalState === "auto_usable";

  return {
    recipe,
    selection: {
      componentId: component.componentId,
      recipeId: recipe.recipeId,
      selectionReason: autoUsedInternetRecipe
        ? "Internet-Ausweichrezept mit ausreichender Qualität automatisch ausgewählt."
        : "Internet-Ausweichrezept ausgewählt, aber zur Prüfung markiert.",
      searchQuery: winner.query.query,
      searchTrace,
      autoUsedInternetRecipe,
      sourceTier: recipe.source.tier,
      qualityScore: recipe.source.qualityScore,
      fitScore: recipe.source.fitScore
    },
    unresolvedItems: autoUsedInternetRecipe
      ? []
      : [`Rezept ${recipe.name} muss vor der finalen Produktion manuell geprueft werden.`]
  };
}
