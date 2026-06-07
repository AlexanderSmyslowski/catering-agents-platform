import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type MenuComponent, type Recipe, type WebRecipeCandidate } from "@catering/shared-core";
import {
  candidateSupportsMenuCategory,
  categoryBoostForText,
  evaluateMenuCategoryCompatibility,
  hasCategoryCue,
  recipeMenuCategoryConflictReason,
  recipeSupportsMenuCategory
} from "../production-service/src/recipe-discovery/menu-category-compatibility.js";

function component(menuCategory?: MenuComponent["menuCategory"]): MenuComponent {
  return {
    componentId: "component-1",
    label: "Gemuesepfanne",
    course: "main",
    serviceStyle: "buffet",
    menuCategory,
    dietaryTags: menuCategory ? [menuCategory] : [],
    productionDecision: {
      mode: "scratch"
    }
  };
}

function recipeCandidate(ingredientNames: string[], title = "Gemuesepfanne"): WebRecipeCandidate {
  return {
    url: "https://example.com/gemuesepfanne",
    title,
    recipe: {
      schemaVersion: SCHEMA_VERSION,
      recipeId: "candidate-1",
      name: title,
      baseYield: {
        servings: 10,
        unit: "servings"
      },
      ingredients: ingredientNames.map((name, index) => ({
        ingredientId: `ingredient-${index + 1}`,
        name,
        quantity: {
          amount: 1,
          unit: "kg"
        },
        group: "misc",
        purchaseUnit: "kg",
        normalizedUnit: "kg"
      })),
      steps: [
        {
          index: 1,
          instruction: "Zubereiten."
        }
      ],
      scalingRules: {
        defaultLossFactor: 1.05,
        batchSize: 10
      },
      allergens: [],
      dietTags: [],
      source: {
        tier: "internet_fallback",
        reference: "https://example.com/gemuesepfanne",
        originType: "web",
        retrievedAt: "2026-03-10T10:00:00.000Z",
        qualityScore: 0.8,
        fitScore: 0.8,
        extractionCompleteness: 0.9,
        approvalState: "review_required"
      }
    },
    qualitySignals: {
      structuredData: true,
      hasYield: true,
      ingredientCount: ingredientNames.length,
      stepCount: 1,
      mappedIngredientRatio: 1
    }
  };
}

function internalRecipe(ingredientNames: string[], dietTags: Recipe["dietTags"] = []): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-1",
    name: "Gemuesepfanne",
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: ingredientNames.map((name, index) => ({
      ingredientId: `ingredient-${index + 1}`,
      name,
      quantity: {
        amount: 1,
        unit: "kg"
      },
      group: "misc",
      purchaseUnit: "kg",
      normalizedUnit: "kg"
    })),
    steps: [
      {
        index: 1,
        instruction: "Zubereiten."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: [],
    dietTags,
    source: {
      tier: "internal_verified",
      reference: "Interne Bibliothek",
      originType: "internal_db",
      retrievedAt: "2026-03-10T10:00:00.000Z",
      qualityScore: 0.95,
      fitScore: 0.95,
      extractionCompleteness: 1,
      approvalState: "auto_usable"
    }
  };
}

describe("menu category compatibility", () => {
  it("recognizes explicit vegan and vegetarian cues", () => {
    expect(hasCategoryCue("vegan curry", "vegan")).toBe(true);
    expect(hasCategoryCue("plant based stew", "vegan")).toBe(true);
    expect(hasCategoryCue("vegetarian quiche", "vegetarian")).toBe(true);
    expect(hasCategoryCue("vegan curry", "vegetarian")).toBe(true);
  });

  it("keeps classic or missing categories permissive", () => {
    expect(hasCategoryCue("Kalbsbuletten", "classic")).toBe(true);
    expect(hasCategoryCue("Kalbsbuletten", undefined)).toBe(true);
    expect(candidateSupportsMenuCategory(recipeCandidate(["Kalb"]), component("classic"))).toBe(true);
  });

  it("rejects vegan candidates with non-vegan ingredients unless explicitly cued", () => {
    const candidate = recipeCandidate(["Zucchini", "Butter"]);

    expect(evaluateMenuCategoryCompatibility(candidate, component("vegan"))).toEqual({
      compatible: false,
      inferredDietTags: [],
      confidence: "none"
    });
    expect(candidateSupportsMenuCategory(candidate, component("vegan"))).toBe(false);
  });

  it("accepts vegan candidates from ingredients when no blocking ingredient is present", () => {
    expect(evaluateMenuCategoryCompatibility(recipeCandidate(["Zucchini", "Pilze"]), component("vegan"))).toEqual({
      compatible: true,
      inferredDietTags: ["vegan"],
      confidence: "ingredients"
    });
  });

  it("rejects vegetarian recipes with meat ingredients", () => {
    expect(recipeSupportsMenuCategory(internalRecipe(["Huhn", "Zucchini"]), component("vegetarian"))).toBe(false);
    expect(recipeSupportsMenuCategory(internalRecipe(["Pilze", "Zucchini"]), component("vegetarian"))).toBe(true);
  });

  it("explains category conflicts for already selected internal recipes", () => {
    expect(
      recipeMenuCategoryConflictReason(internalRecipe(["Sahne", "Ei"]), component("vegan"))
    ).toBe("Harte Menükategorie vegan blockiert die Rezeptwahl für Gemuesepfanne.");
    expect(recipeMenuCategoryConflictReason(internalRecipe(["Pilze", "Zucchini"]), component("vegan"))).toBeUndefined();
  });

  it("applies the existing category boost and penalty values", () => {
    expect(categoryBoostForText("vegan curry", component("vegan"))).toBe(0.2);
    expect(categoryBoostForText("klassisches curry", component("vegan"))).toBe(-0.05);
    expect(categoryBoostForText("klassisches curry", component(undefined))).toBe(0);
  });
});
