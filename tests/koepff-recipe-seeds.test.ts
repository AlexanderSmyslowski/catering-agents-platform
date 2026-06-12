import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aggregatePurchaseList,
  isMetroIngredientGroupId,
  metroIngredientGroups,
  validateRecipe,
  type PurchaseItem,
  type Recipe
} from "@catering/shared-core";

const seedDir = "data-seeds/recipes-koepff";

function loadSeeds(): Recipe[] {
  return readdirSync(seedDir)
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => validateRecipe(JSON.parse(readFileSync(`${seedDir}/${entry}`, "utf8")) as Recipe));
}

function ingredientAmount(recipe: Recipe, ingredientName: string): number {
  const ingredient = recipe.ingredients.find((item) => item.name === ingredientName);
  if (!ingredient) {
    throw new Error(`Ingredient ${ingredientName} missing in ${recipe.recipeId}`);
  }
  return ingredient.quantity.amount;
}

function purchaseItem(group: string, displayName: string): PurchaseItem {
  return {
    ingredientId: `${group}-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    displayName,
    normalizedQty: 1,
    normalizedUnit: "kg",
    purchaseQty: 1,
    purchaseUnit: "kg",
    group,
    supplierHint: "Metro Fresh",
    sourceRecipes: ["recipe-test"],
    mappingConfidence: 0.9
  };
}

describe("Köpff recipe seeds", () => {
  it("validates all 11 seeds against the existing recipe schema", () => {
    const seeds = loadSeeds();

    expect(seeds).toHaveLength(11);
    for (const recipe of seeds) {
      expect(recipe.baseYield).toEqual({
        servings: 45,
        unit: "Portionen"
      });
      expect(recipe.source.reference).toBe("Produktionsmappe Köpff 2026-06-14");
      expect(recipe.source.approvalState).toBe("review_required");
    }
  });

  it("uses only the 12 Metro ingredient groups", () => {
    const seeds = loadSeeds();

    expect(metroIngredientGroups).toHaveLength(12);
    for (const recipe of seeds) {
      for (const ingredient of recipe.ingredients) {
        expect(isMetroIngredientGroupId(ingredient.group), `${recipe.recipeId}: ${ingredient.group}`).toBe(true);
      }
    }
  });

  it("keeps selected source quantities exactly as transcribed", () => {
    const recipes = new Map(loadSeeds().map((recipe) => [recipe.recipeId, recipe]));

    expect(
      ingredientAmount(
        recipes.get("koepff-vitello-tonnato-riesenkapern-weisser-thunfisch")!,
        "Kalbsnuss, roh"
      )
    ).toBe(3200);
    expect(
      ingredientAmount(
        recipes.get("koepff-gruener-spargel-trueffel-hollandaise-parmesan-chips")!,
        "Parmesan"
      )
    ).toBe(225);
    expect(
      ingredientAmount(
        recipes.get("koepff-rotgarnelen-avocado-wasabi-creme")!,
        "Rotgarnelen, roh geschält/entdarmt"
      )
    ).toBe(45);
    expect(
      ingredientAmount(
        recipes.get("koepff-grillgemuese-raukepesto-schafskaesequader")!,
        "Schafskäse / Feta"
      )
    ).toBe(810);
  });

  it("sorts purchase items in Metro group order and keeps unknown groups last", () => {
    const purchaseList = aggregatePurchaseList("spec-koepff-test", [], [
      purchaseItem("trockenlager", "Zucker"),
      purchaseItem("fleisch", "Roastbeef"),
      purchaseItem("obst_gemuese", "Zucchini"),
      purchaseItem("legacy_group", "Altgruppe"),
      purchaseItem("getraenke_als_zutat", "Orangensaft"),
      purchaseItem("kaese", "Parmesan")
    ]);

    expect(purchaseList.items.map((item) => item.group)).toEqual([
      "obst_gemuese",
      "fleisch",
      "kaese",
      "trockenlager",
      "getraenke_als_zutat",
      "legacy_group"
    ]);
  });
});
