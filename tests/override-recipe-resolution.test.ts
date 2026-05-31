import { describe, expect, it } from "vitest";
import type {
  MenuComponent,
  Recipe
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import {
  buildMissingOverrideRecipeResolution,
  buildOverrideRecipeResolution
} from "../production-service/src/recipe-discovery/override-recipe-resolution.js";

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

describe("override recipe resolution", () => {
  it("maps a valid manual recipe assignment into a deterministic planner resolution", () => {
    const recipe = buildRecipe();

    const resolution = buildOverrideRecipeResolution({
      recipe,
      component: buildComponent()
    });

    expect(resolution.recipe).toBe(recipe);
    expect(resolution.unresolvedItems).toEqual([]);
    expect(resolution.selection).toEqual({
      componentId: "component-tomato-soup",
      recipeId: "recipe-tomato-soup",
      selectionReason: "Rezept wurde manuell aus der Bibliothek zugewiesen.",
      searchTrace: ["Manuelle Rezeptzuweisung: Tomatensuppe Bankett (recipe-tomato-soup)."],
      autoUsedInternetRecipe: false,
      sourceTier: "internal_verified",
      qualityScore: 0.93,
      fitScore: 0.91
    });
  });

  it("keeps missing manual recipe assignments explicit for planner fallback handling", () => {
    const resolution = buildMissingOverrideRecipeResolution({
      recipeId: "recipe-missing",
      component: buildComponent()
    });

    expect(resolution.recipe).toBeUndefined();
    expect(resolution.selection).toEqual({
      componentId: "component-tomato-soup",
      selectionReason: "Das manuell hinterlegte Rezept recipe-missing wurde in der Bibliothek nicht gefunden.",
      searchTrace: ["Manuelle Rezeptzuweisung: recipe-missing", "Bibliothekstreffer: nicht gefunden."],
      autoUsedInternetRecipe: false
    });
    expect(resolution.unresolvedItems).toEqual([
      "Rezeptzuweisung recipe-missing für Tomatensuppe ist ungültig."
    ]);
  });
});
