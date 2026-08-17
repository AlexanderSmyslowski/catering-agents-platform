import { describe, expect, it } from "vitest";
import {
  materializeProductionBatchFromBridge,
  type QuantityRecipeProductionBridgeResult,
  type Recipe
} from "@catering/shared-core";

function recipe(): Recipe {
  return {
    schemaVersion: "1.0.0",
    recipeId: "recipe-roastbeef",
    name: "Roastbeef",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "THE ONE",
      retrievedAt: "2026-08-17T10:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: { servings: 10, unit: "servings" },
    ingredients: [
      {
        ingredientId: "roastbeef",
        name: "Roastbeef",
        quantity: { amount: 1000, unit: "g" },
        group: "Fleisch"
      },
      {
        ingredientId: "salt",
        name: "Salz",
        quantity: { amount: 10, unit: "g" },
        group: "Gewürze"
      }
    ],
    steps: [{ index: 1, instruction: "Produzieren." }],
    scalingRules: { defaultLossFactor: 0.15, batchSize: 25 },
    allergens: [],
    dietTags: []
  };
}

function readyBridge(overrides: Partial<QuantityRecipeProductionBridgeResult> = {}): QuantityRecipeProductionBridgeResult {
  return {
    status: "ready_for_scaling",
    eventSpecId: "event-1",
    componentId: "roastbeef",
    recipeId: "recipe-roastbeef",
    targetOutput: { amount: 2750, unit: "g" },
    targetServings: 50,
    conversionMethod: "reviewed_output_mapping",
    issues: [],
    ...overrides
  };
}

function materialize(bridgeResult = readyBridge()) {
  return materializeProductionBatchFromBridge({
    eventSpecId: "event-1",
    componentId: "roastbeef",
    recipe: recipe(),
    bridgeResult
  });
}

describe("production batch materialization", () => {
  it("materializes exactly the proven target servings", () => {
    const batch = materialize();

    expect(batch.recipeId).toBe("recipe-roastbeef");
    expect(batch.componentId).toBe("roastbeef");
    expect(batch.scaledYield).toEqual({ amount: 50, unit: "servings" });
    expect(batch.batchCount).toBe(2);
    expect(batch.ingredients).toEqual([
      {
        ingredientId: "roastbeef",
        name: "Roastbeef",
        quantity: { amount: 5000, unit: "g" },
        group: "Fleisch"
      },
      {
        ingredientId: "salt",
        name: "Salz",
        quantity: { amount: 50, unit: "g" },
        group: "Gewürze"
      }
    ]);
  });

  it("keeps loss factor as metadata without inflating ingredients", () => {
    const batch = materialize();

    expect(batch.lossFactor).toBe(0.15);
    expect(batch.ingredients[0]?.quantity.amount).toBe(5000);
  });

  it.each(["blocked", "review_required"] as const)("fails closed when bridge status is %s", (status) => {
    expect(() => materialize(readyBridge({ status, targetServings: undefined, conversionMethod: undefined })))
      .toThrow("bridge_not_ready_for_scaling");
  });

  it("fails closed on event mismatch", () => {
    expect(() => materialize(readyBridge({ eventSpecId: "event-2" })))
      .toThrow("bridge_event_binding_mismatch");
  });

  it("fails closed on component mismatch", () => {
    expect(() => materialize(readyBridge({ componentId: "dessert" })))
      .toThrow("bridge_component_binding_mismatch");
  });

  it("fails closed on recipe mismatch", () => {
    expect(() => materialize(readyBridge({ recipeId: "other-recipe" })))
      .toThrow("bridge_recipe_binding_mismatch");
  });

  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY]
  ])("fails closed for invalid target servings: %s", (_label, targetServings) => {
    expect(() => materialize(readyBridge({ targetServings })))
      .toThrow("bridge_target_servings_invalid");
  });
});
