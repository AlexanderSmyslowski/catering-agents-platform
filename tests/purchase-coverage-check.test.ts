import { describe, expect, it } from "vitest";
import {
  checkPurchaseCoverage,
  SCHEMA_VERSION,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";

function productionPlan(): ProductionPlan {
  return {
    schemaVersion: SCHEMA_VERSION,
    planId: "plan-coverage-1",
    eventSpecId: "spec-coverage-1",
    readiness: {
      status: "complete",
      reasons: ["Alle Pflichtangaben sind vorhanden."]
    },
    productionBatches: [
      {
        batchId: "batch-soup",
        componentId: "component-soup",
        recipeId: "recipe-tomato-soup",
        scaledYield: {
          amount: 20,
          unit: "portion"
        },
        batchCount: 1,
        lossFactor: 1.1,
        gnPlan: [{ container: "GN 1/1", count: 1 }],
        station: "hot-kitchen",
        prepWindow: "2026-05-18 T-1",
        ingredients: [
          {
            ingredientId: "tomato",
            name: "Tomaten",
            quantity: { amount: 5000, unit: "g" },
            group: "produce"
          },
          {
            ingredientId: "cream",
            name: "Sahne",
            quantity: { amount: 1000, unit: "ml" },
            group: "dairy"
          }
        ],
        steps: [{ index: 1, instruction: "Suppe kochen." }]
      }
    ],
    timeline: [],
    kitchenSheets: [],
    recipeSelections: [
      {
        componentId: "component-soup",
        recipeId: "recipe-tomato-soup",
        selectionReason: "Internes Rezept gewaehlt.",
        autoUsedInternetRecipe: false
      },
      {
        componentId: "component-dessert",
        selectionReason: "Komponente ist als Convenience-Zukauf markiert und wurde als Beschaffungsposition uebernommen.",
        autoUsedInternetRecipe: false
      }
    ],
    unresolvedItems: []
  };
}

function purchaseList(items: PurchaseList["items"]): PurchaseList {
  return {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: "purchase-coverage-1",
    eventSpecId: "spec-coverage-1",
    groupingMode: "group",
    totals: {
      itemCount: items.length,
      groups: [...new Set(items.map((item) => item.group))]
    },
    items
  };
}

describe("PurchaseCoverageCheck", () => {
  it("passes when every production ingredient is covered by the purchase list", () => {
    const result = checkPurchaseCoverage(
      productionPlan(),
      purchaseList([
        {
          ingredientId: "tomato",
          displayName: "Tomaten",
          normalizedQty: 5000,
          normalizedUnit: "g",
          purchaseQty: 5,
          purchaseUnit: "kg",
          group: "produce",
          sourceRecipes: ["recipe-tomato-soup"],
          mappingConfidence: 0.95
        },
        {
          ingredientId: "cream",
          displayName: "Sahne",
          normalizedQty: 1000,
          normalizedUnit: "ml",
          purchaseQty: 1,
          purchaseUnit: "l",
          group: "dairy",
          sourceRecipes: ["recipe-tomato-soup"],
          mappingConfidence: 0.95
        }
      ])
    );

    expect(result.status).toBe("passed");
    expect(result.coveredIngredients).toHaveLength(2);
    expect(result.missingIngredients).toEqual([]);
  });

  it("blocks when a recipe ingredient is missing from the purchase list", () => {
    const result = checkPurchaseCoverage(
      productionPlan(),
      purchaseList([
        {
          ingredientId: "tomato",
          displayName: "Tomaten",
          normalizedQty: 5000,
          normalizedUnit: "g",
          purchaseQty: 5,
          purchaseUnit: "kg",
          group: "produce",
          sourceRecipes: ["recipe-tomato-soup"],
          mappingConfidence: 0.95
        }
      ])
    );

    expect(result.status).toBe("blocked");
    expect(result.coveredIngredients.map((item) => item.ingredientId)).toEqual(["tomato"]);
    expect(result.missingIngredients).toEqual([
      {
        batchId: "batch-soup",
        componentId: "component-soup",
        recipeId: "recipe-tomato-soup",
        ingredientId: "cream",
        name: "Sahne"
      }
    ]);
  });

  it("records documented procurement exceptions for convenience or purchased components", () => {
    const result = checkPurchaseCoverage(
      productionPlan(),
      purchaseList([
        {
          ingredientId: "tomato",
          displayName: "Tomaten",
          normalizedQty: 5000,
          normalizedUnit: "g",
          purchaseQty: 5,
          purchaseUnit: "kg",
          group: "produce",
          sourceRecipes: ["recipe-tomato-soup"],
          mappingConfidence: 0.95
        },
        {
          ingredientId: "cream",
          displayName: "Sahne",
          normalizedQty: 1000,
          normalizedUnit: "ml",
          purchaseQty: 1,
          purchaseUnit: "l",
          group: "dairy",
          sourceRecipes: ["recipe-tomato-soup"],
          mappingConfidence: 0.95
        },
        {
          ingredientId: "proc-component-dessert-finished",
          displayName: "Dessert im Glas",
          normalizedQty: 20,
          normalizedUnit: "portion",
          purchaseQty: 20,
          purchaseUnit: "portion",
          group: "dessert",
          sourceRecipes: ["procurement:component-dessert"],
          mappingConfidence: 0.7
        }
      ])
    );

    expect(result.status).toBe("passed");
    expect(result.documentedProcurementExceptions).toEqual([
      {
        componentId: "component-dessert",
        ingredientId: "proc-component-dessert-finished",
        displayName: "Dessert im Glas",
        purchaseListId: "purchase-coverage-1"
      }
    ]);
  });

  it("does not pass when procurement exceptions exist but a recipe ingredient is still missing", () => {
    const result = checkPurchaseCoverage(
      productionPlan(),
      purchaseList([
        {
          ingredientId: "tomato",
          displayName: "Tomaten",
          normalizedQty: 5000,
          normalizedUnit: "g",
          purchaseQty: 5,
          purchaseUnit: "kg",
          group: "produce",
          sourceRecipes: ["recipe-tomato-soup"],
          mappingConfidence: 0.95
        },
        {
          ingredientId: "proc-component-dessert-finished",
          displayName: "Dessert im Glas",
          normalizedQty: 20,
          normalizedUnit: "portion",
          purchaseQty: 20,
          purchaseUnit: "portion",
          group: "dessert",
          sourceRecipes: ["procurement:component-dessert"],
          mappingConfidence: 0.7
        }
      ])
    );

    expect(result.documentedProcurementExceptions).toHaveLength(1);
    expect(result.missingIngredients.map((item) => item.ingredientId)).toEqual(["cream"]);
    expect(result.status).toBe("blocked");
  });
});
