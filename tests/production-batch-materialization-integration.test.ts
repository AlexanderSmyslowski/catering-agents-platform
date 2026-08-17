import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent,
  QuantityRecipeProductionBridgeResult,
  Recipe
} from "@catering/shared-core";
import { buildResolvedRecipePlanningArtifacts } from "../production-service/src/rules/planning-resolved-recipe-artifacts.js";

const eventSpec: AcceptedEventSpec = {
  schemaVersion: "1.0.0",
  specId: "event-1",
  lifecycle: { commercialState: "accepted" },
  readiness: { status: "complete", reasons: [] },
  sourceLineage: [{ sourceType: "manual_input", reference: "test" }],
  event: { type: "Firmenfeier", serviceForm: "Buffet", date: "2026-08-18" },
  attendees: { expected: 50 },
  servicePlan: { eventType: "Firmenfeier", serviceForm: "Buffet", modules: [] },
  menuPlan: []
};

const component: MenuComponent = {
  componentId: "roastbeef",
  label: "Roastbeef"
};

const recipe: Recipe = {
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
  ingredients: [{
    ingredientId: "roastbeef",
    name: "Roastbeef",
    quantity: { amount: 1000, unit: "g" },
    group: "Fleisch"
  }],
  steps: [{ index: 1, instruction: "Produzieren." }],
  scalingRules: { defaultLossFactor: 0.1 },
  allergens: [],
  dietTags: []
};

const bridgeResult: QuantityRecipeProductionBridgeResult = {
  status: "ready_for_scaling",
  eventSpecId: "event-1",
  componentId: "roastbeef",
  recipeId: "recipe-roastbeef",
  targetOutput: { amount: 2750, unit: "g" },
  targetServings: 50,
  conversionMethod: "reviewed_output_mapping",
  issues: []
};

describe("resolved recipe production artifacts", () => {
  it("materializes recipe batches only from the proven bridge target", () => {
    const artifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec,
      component,
      recipe,
      bridgeResult
    });

    expect(artifacts.batch.scaledYield).toEqual({ amount: 50, unit: "servings" });
    expect(artifacts.batch.ingredients[0]?.quantity.amount).toBe(5000);
    expect(artifacts.kitchenSheet.productionQty).toEqual({ amount: 50, unit: "servings" });
  });
});
