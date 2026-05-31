import { describe, expect, it } from "vitest";
import type {
  MenuComponent,
  Recipe
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import { buildInternalRecipeResolution } from "../production-service/src/recipe-discovery/internal-recipe-resolution.js";

function buildComponent(): MenuComponent {
  return {
    componentId: "component-tomato-soup",
    label: "Tomatensuppe",
    menuCategory: "vegetarian",
    serviceStyle: "buffet"
  };
}

function buildRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-soup",
    name: "Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "house:tomato-soup",
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.93,
      fitScore: 0.91,
      extractionCompleteness: 1
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

describe("internal recipe resolution", () => {
  it("maps an internal winner into the planner resolution without adding unresolved items", () => {
    const recipe = buildRecipe();
    const trace = [
      "Interne Kandidaten: Tomatensuppe Bankett",
      "Interner Treffer gewählt: Tomatensuppe Bankett."
    ];

    const resolution = buildInternalRecipeResolution({
      component: buildComponent(),
      winner: {
        recipe,
        repositoryRank: 0,
        fitScore: 0.88,
        primaryScore: 1,
        specificPrimaryScore: 1,
        leadNameScore: 1
      },
      searchTrace: trace
    });

    expect(resolution.recipe).toBe(recipe);
    expect(resolution.unresolvedItems).toEqual([]);
    expect(resolution.selection).toEqual({
      componentId: "component-tomato-soup",
      recipeId: "recipe-tomato-soup",
      selectionReason: "Passendes Rezept in der internen Bibliothek gefunden.",
      autoUsedInternetRecipe: false,
      searchTrace: trace,
      sourceTier: "internal_verified",
      qualityScore: 0.93,
      fitScore: 0.88
    });
  });
});
