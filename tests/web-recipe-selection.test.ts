import { describe, expect, it } from "vitest";
import type {
  Recipe,
  RecipeSearchQuery
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import { selectWebRecipeCandidate } from "../production-service/src/recipe-discovery/web-recipe-selection.js";

function buildRecipe(overrides: {
  recipeId: string;
  qualityScore: number;
  fitScore: number;
}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: overrides.recipeId,
    name: overrides.recipeId,
    source: {
      tier: "internet_fallback",
      originType: "web",
      reference: `web:${overrides.recipeId}`,
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "review_required",
      qualityScore: overrides.qualityScore,
      fitScore: overrides.fitScore,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "ingredient-1",
        name: "Tomaten",
        quantity: { amount: 1, unit: "kg" },
        group: "produce"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Vorbereiten."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: [],
    dietTags: []
  };
}

function buildQuery(query: string): RecipeSearchQuery {
  return {
    query
  } as unknown as RecipeSearchQuery;
}

describe("web recipe selection", () => {
  it("selects the candidate with the existing weighted quality and fit score", () => {
    const highFit = {
      recipe: buildRecipe({
        recipeId: "recipe-high-fit",
        qualityScore: 0.75,
        fitScore: 0.95
      }),
      query: buildQuery("high fit")
    };
    const highQuality = {
      recipe: buildRecipe({
        recipeId: "recipe-high-quality",
        qualityScore: 0.9,
        fitScore: 0.78
      }),
      query: buildQuery("high quality")
    };

    const selected = selectWebRecipeCandidate([highFit, highQuality]);

    expect(selected).toBe(highQuality);
  });

  it("keeps the candidate query paired with the selected recipe", () => {
    const selected = selectWebRecipeCandidate([
      {
        recipe: buildRecipe({
          recipeId: "recipe-low",
          qualityScore: 0.7,
          fitScore: 0.7
        }),
        query: buildQuery("low")
      },
      {
        recipe: buildRecipe({
          recipeId: "recipe-selected",
          qualityScore: 0.8,
          fitScore: 0.9
        }),
        query: buildQuery("selected")
      }
    ]);

    expect(selected?.recipe.recipeId).toBe("recipe-selected");
    expect(selected?.query.query).toBe("selected");
  });

  it("does not reorder the caller-owned candidate list while selecting", () => {
    const originalOrder = [
      {
        recipe: buildRecipe({
          recipeId: "recipe-first",
          qualityScore: 0.7,
          fitScore: 0.7
        }),
        query: buildQuery("first")
      },
      {
        recipe: buildRecipe({
          recipeId: "recipe-winner",
          qualityScore: 0.95,
          fitScore: 0.95
        }),
        query: buildQuery("winner")
      },
      {
        recipe: buildRecipe({
          recipeId: "recipe-last",
          qualityScore: 0.6,
          fitScore: 0.6
        }),
        query: buildQuery("last")
      }
    ];

    const selected = selectWebRecipeCandidate(originalOrder);

    expect(selected?.recipe.recipeId).toBe("recipe-winner");
    expect(originalOrder.map((candidate) => candidate.recipe.recipeId)).toEqual([
      "recipe-first",
      "recipe-winner",
      "recipe-last"
    ]);
  });

  it("returns undefined when no web candidates survived filtering and validation", () => {
    expect(selectWebRecipeCandidate([])).toBeUndefined();
  });
});
