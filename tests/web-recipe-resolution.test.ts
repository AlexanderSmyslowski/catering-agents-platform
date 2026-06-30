import { describe, expect, it } from "vitest";
import type {
  MenuComponent,
  Recipe,
  RecipeSearchQuery
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import {
  buildUnresolvedWebRecipeResolution,
  buildWebRecipeWinnerResolution
} from "../production-service/src/recipe-discovery/web-recipe-resolution.js";

function buildComponent(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-tomato-soup",
    label: "Tomatensuppe",
    menuCategory: "vegetarian",
    serviceStyle: "buffet",
    ...overrides
  };
}

function buildRecipe(overrides: Partial<Recipe["source"]> = {}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-web-tomato-soup",
    name: "Tomatensuppe Web",
    source: {
      tier: "internet_fallback",
      originType: "web",
      reference: "web:tomato-soup",
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "review_required",
      qualityScore: 0.82,
      fitScore: 0.86,
      extractionCompleteness: 0.95,
      ...overrides
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "ingredient-tomato",
        name: "Tomaten",
        quantity: { amount: 2, unit: "kg" },
        group: "produce"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten garen."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: [],
    dietTags: ["vegetarian"]
  };
}

function buildQuery(query: string): RecipeSearchQuery {
  return {
    query
  } as unknown as RecipeSearchQuery;
}

describe("web recipe resolution", () => {
  it("keeps unresolved vegetarian web misses explicit for the planner", () => {
    const trace = ["Interne Kandidaten: keine Treffer.", "Websuche: tomatensuppe rezept"];

    const resolution = buildUnresolvedWebRecipeResolution({
      component: buildComponent(),
      searchTrace: trace,
      webSearchFailed: false
    });

    expect(resolution.recipe).toBeUndefined();
    expect(resolution.selection).toEqual({
      componentId: "component-tomato-soup",
      selectionReason:
        "Es konnte kein interner oder externer vegetarischer Rezeptkandidat belastbar validiert werden.",
      searchTrace: trace,
      autoUsedInternetRecipe: false
    });
    expect(resolution.unresolvedItems).toEqual([
      "Kein vegetarischer Rezeptkandidat für Tomatensuppe gefunden."
    ]);
  });

  it("keeps failed web search wording separate from ordinary no-match wording", () => {
    const resolution = buildUnresolvedWebRecipeResolution({
      component: buildComponent({ menuCategory: "vegan", label: "Linsensalat" }),
      searchTrace: ["Websuche fehlgeschlagen: linsensalat vegan rezept"],
      webSearchFailed: true
    });

    expect(resolution.selection.selectionReason).toBe(
      "Es konnte kein interner Rezeptkandidat gefunden werden und die Internetrecherche ist fehlgeschlagen."
    );
    expect(resolution.unresolvedItems).toEqual([
      "Kein veganer Rezeptkandidat für Linsensalat gefunden, Internetrecherche fehlgeschlagen."
    ]);
  });

  it("maps review-required web winners into manual review unresolved items", () => {
    const recipe = buildRecipe();
    const trace = ["Websuche: tomatensuppe rezept", "Webtreffer gewählt: Tomatensuppe Web."];

    const resolution = buildWebRecipeWinnerResolution({
      component: buildComponent(),
      winner: {
        recipe,
        query: buildQuery("tomatensuppe rezept")
      },
      searchTrace: trace
    });

    expect(resolution.recipe).toBe(recipe);
    expect(resolution.selection).toEqual({
      componentId: "component-tomato-soup",
      recipeId: "recipe-web-tomato-soup",
      selectionReason: "Internet-Ausweichrezept ausgewählt, aber zur Prüfung markiert.",
      searchQuery: "tomatensuppe rezept",
      searchTrace: trace,
      autoUsedInternetRecipe: false,
      sourceTier: "internet_fallback",
      qualityScore: 0.82,
      fitScore: 0.86
    });
    expect(resolution.unresolvedItems).toEqual([
      "Rezept Tomatensuppe Web muss vor der finalen Produktion manuell geprüft werden."
    ]);
  });

  it("maps auto-usable web winners into manual review unresolved items", () => {
    const resolution = buildWebRecipeWinnerResolution({
      component: buildComponent(),
      winner: {
        recipe: buildRecipe({ approvalState: "auto_usable" }),
        query: buildQuery("tomatensuppe catering rezept")
      },
      searchTrace: ["Webtreffer gewählt: Tomatensuppe Web."]
    });

    expect(resolution.selection.selectionReason).toBe(
      "Internet-Ausweichrezept ausgewählt, aber zur Prüfung markiert."
    );
    expect(resolution.selection.autoUsedInternetRecipe).toBe(false);
    expect(resolution.unresolvedItems).toEqual([
      "Rezept Tomatensuppe Web muss vor der finalen Produktion manuell geprüft werden."
    ]);
  });
});
