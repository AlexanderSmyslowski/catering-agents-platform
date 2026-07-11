import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aggregatePurchaseList,
  isMetroIngredientGroupId,
  metroIngredientGroups,
  scaleRecipe,
  toProductionBatch,
  validateRecipe,
  type PurchaseItem,
  type ProductionBatch,
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

function productionBatch(recipe: Recipe, index: number): ProductionBatch {
  return {
    ...toProductionBatch(recipe, `component-${index}`, recipe.baseYield.servings),
    batchId: `batch-${index}`,
    station: "Produktionsküche",
    prepWindow: "Produktionstag",
    gnPlan: []
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

  it("keeps every transcribed quantity unchanged at the recipe base yield", () => {
    const recipes = loadSeeds();

    for (const recipe of recipes) {
      const scaled = scaleRecipe(recipe, recipe.baseYield.servings);
      expect(scaled.scaledYield, recipe.recipeId).toEqual({
        amount: recipe.baseYield.servings,
        unit: "servings"
      });
      expect(scaled.ingredients, recipe.recipeId).toEqual(recipe.ingredients);
    }

    const vitello = recipes.find((recipe) =>
      recipe.recipeId === "koepff-vitello-tonnato-riesenkapern-weisser-thunfisch"
    )!;
    const batch = toProductionBatch(vitello, "component-vitello", 45);
    expect(batch.lossFactor).toBe(1.29);
    expect(ingredientAmount({ ...vitello, ingredients: batch.ingredients }, "Kalbsnuss, roh")).toBe(3200);

    expect(ingredientAmount(
      { ...vitello, ingredients: scaleRecipe(vitello, 90).ingredients },
      "Kalbsnuss, roh"
    )).toBe(6400);
    expect(ingredientAmount(
      { ...vitello, ingredients: scaleRecipe(vitello, 30).ingredients },
      "Kalbsnuss, roh"
    )).toBe(2133.33);
  });

  it("sums the same Metro article across recipe-local ingredient ids", () => {
    const recipes = loadSeeds();
    const purchaseList = aggregatePurchaseList(
      "spec-koepff-aggregate",
      recipes.map(productionBatch)
    );
    const oliveOilItems = purchaseList.items.filter(
      (item) => item.displayName === "Olivenöl mild"
    );
    const expectedSources = recipes
      .filter((recipe) => recipe.ingredients.some((ingredient) => ingredient.name === "Olivenöl mild"))
      .map((recipe) => recipe.recipeId)
      .sort();

    expect(oliveOilItems).toHaveLength(1);
    expect(oliveOilItems[0]).toMatchObject({
      displayName: "Olivenöl mild",
      normalizedQty: 970,
      normalizedUnit: "ml",
      purchaseQty: 970,
      purchaseUnit: "ml",
      group: "oele_essige_kochwein"
    });
    expect([...(oliveOilItems[0]?.sourceRecipes ?? [])].sort()).toEqual(expectedSources);
    expect(purchaseList.items.some((item) => item.displayName === "Weißwein trocken")).toBe(true);
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
