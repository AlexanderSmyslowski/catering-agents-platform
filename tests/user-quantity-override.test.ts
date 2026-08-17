import { describe, expect, it } from "vitest";
import {
  confirmQuantityOverride,
  previewQuantityOverride,
  recalculateQuantityLineage,
  type ProductionScalingRule,
  type QuantityDecisionInput,
  type Recipe,
  type RecipeEventUseReview,
  type RecipeOutputMapping
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
      { ingredientId: "roastbeef", name: "Roastbeef", quantity: { amount: 550, unit: "g" }, group: "Fleisch" },
      { ingredientId: "salt", name: "Salz", quantity: { amount: 8, unit: "g" }, group: "Gewürze" }
    ],
    steps: [{ index: 1, instruction: "Produzieren." }],
    scalingRules: { defaultLossFactor: 0.15, batchSize: 25 },
    allergens: [],
    dietTags: []
  };
}

function authority(): QuantityDecisionInput {
  return {
    decisionId: "quantity-old",
    eventSpecId: "event-1",
    componentId: "roastbeef",
    guestCount: 50,
    serviceFormat: "buffet",
    dishRole: "main",
    basis: "per_person_weight",
    perUnitAmount: 55,
    perUnitUnit: "g",
    targetAmount: 2750,
    targetUnit: "g",
    rationale: "Bisherige freigegebene Eventmenge.",
    evidence: { kind: "operator_instruction", reference: "existing-authority" },
    reviewStatus: "approved"
  };
}

function mapping(): RecipeOutputMapping {
  return { recipeId: "recipe-roastbeef", outputAmount: 550, outputUnit: "g", recipeServings: 10, reviewedBy: "chef", reviewedAt: "2026-08-17T10:00:00.000Z" };
}

function recipeEventReview(): RecipeEventUseReview {
  return {
    eventSpecId: "event-1",
    recipeId: "recipe-roastbeef",
    reviewedBy: "chef",
    reviewedAt: "2026-08-17T21:05:00.000Z",
    decision: "accepted_for_event",
    confirmations: {
      quantitiesAndYield: true,
      methodAndEquipment: true,
      allergensAndDiet: true,
      holdingAndRegeneration: true
    }
  };
}

const stale = ["effective_event_recipe", "kitchen_sheet", "production_batch", "production_summary", "purchase_requirements", "quantity_cost_calculation", "quantity_recipe_bridge"];

function confirmedOverride() {
  const preview = previewQuantityOverride({
    eventSpecId: "event-1",
    componentId: "roastbeef",
    recipe: recipe(),
    currentAuthority: authority(),
    outputMapping: mapping(),
    edit: { origin: "target_output", perUnitAmount: 60, unit: "g" }
  });
  const confirmed = confirmQuantityOverride({ preview, overrideId: "override-approved", confirmedAt: "2026-08-17T20:31:00.000Z" });
  if (confirmed.status !== "confirmed") throw new Error("confirmation missing");
  return confirmed.override;
}

function approvedOverrideAuthority(): QuantityDecisionInput {
  const override = confirmedOverride();
  return {
    ...override.newAuthority,
    decisionId: override.overrideId,
    evidence: { kind: "operator_instruction", reference: override.overrideId },
    rationale: "Vom Küchenverantwortlichen freigegebene neue Eventmenge.",
    reviewStatus: "approved"
  };
}

function saltRule(reviewStatus: ProductionScalingRule["reviewStatus"] = "approved"): ProductionScalingRule {
  return {
    ruleId: "salt-large-batch",
    recipeId: "recipe-roastbeef",
    ingredientId: "salt",
    minServings: 50,
    maxServings: 60,
    model: { kind: "factor", factor: 0.8 },
    rationale: "Salz skaliert in dieser Produktionsgröße nicht vollständig linear.",
    supportingObservationIds: ["obs-salt-1"],
    reviewStatus,
    approvedBy: reviewStatus === "approved" ? "chef" : undefined,
    approvedAt: reviewStatus === "approved" ? "2026-08-17T21:00:00.000Z" : undefined
  };
}

describe("user quantity override and bidirectional recalculation", () => {
  it("previews a target-output edit without changing the old authority", () => {
    const result = previewQuantityOverride({ eventSpecId: "event-1", componentId: "roastbeef", recipe: recipe(), currentAuthority: authority(), outputMapping: mapping(), recommendationReference: "rec-55g", edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } });
    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") throw new Error("preview missing");
    expect(result.previousAuthority.targetAmount).toBe(2750);
    expect(result.proposedAuthority).toMatchObject({ perUnitAmount: 60, targetAmount: 3000, targetUnit: "g" });
    expect(result.scaleFactor).toBeCloseTo(3000 / 2750);
    expect(result.proportionalBaseline.ingredients.map((line) => line.quantity.amount)).toEqual([3000, 43.64]);
    expect(result.effectiveRecipeQuantity).toEqual(result.proportionalBaseline);
    expect(result.purchaseQuantities).toEqual(result.proportionalBaseline.ingredients);
    expect(result.staleArtifacts).toEqual(stale);
    expect(result.recommendationReference).toBe("rec-55g");
  });

  it("previews a recipe-total edit through the reviewed output mapping", () => {
    const result = previewQuantityOverride({ eventSpecId: "event-1", componentId: "roastbeef", recipe: recipe(), currentAuthority: authority(), outputMapping: mapping(), edit: { origin: "recipe_total", targetAmount: 3300, unit: "g" } });
    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") throw new Error("preview missing");
    expect(result.proposedAuthority.targetAmount).toBe(3300);
    expect(result.proposedAuthority.perUnitAmount).toBe(66);
    expect(result.scaleFactor).toBe(1.2);
  });

  it("previews a purchase edit as a whole-recipe scale change", () => {
    const result = previewQuantityOverride({ eventSpecId: "event-1", componentId: "roastbeef", recipe: recipe(), currentAuthority: authority(), outputMapping: mapping(), edit: { origin: "purchase_ingredient", ingredientId: "roastbeef", amount: 3000, unit: "g" } });
    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") throw new Error("preview missing");
    expect(result.scaleFactor).toBeCloseTo(3000 / 2750);
    expect(result.proposedAuthority.targetAmount).toBe(3000);
    expect(result.proportionalBaseline.ingredients[0]?.quantity.amount).toBe(3000);
    expect(result.proportionalBaseline.ingredients[1]?.quantity.amount).toBe(43.64);
  });

  it.each([
    ["zero", { origin: "target_output", perUnitAmount: 0, unit: "g" }],
    ["unit mismatch", { origin: "target_output", perUnitAmount: 60, unit: "kg" }],
    ["unknown ingredient", { origin: "purchase_ingredient", ingredientId: "cream", amount: 3, unit: "l" }]
  ] as const)("blocks invalid preview: %s", (_label, edit) => {
    const result = previewQuantityOverride({ eventSpecId: "event-1", componentId: "roastbeef", recipe: recipe(), currentAuthority: authority(), outputMapping: mapping(), edit });
    expect(result.status).toBe("blocked");
  });

  it("confirms only a valid preview with explicit metadata", () => {
    const preview = previewQuantityOverride({ eventSpecId: "event-1", componentId: "roastbeef", recipe: recipe(), currentAuthority: authority(), outputMapping: mapping(), recommendationReference: "rec-55g", edit: { origin: "purchase_ingredient", ingredientId: "roastbeef", amount: 3000, unit: "g" } });
    const confirmed = confirmQuantityOverride({ preview, overrideId: "override-1", confirmedAt: "2026-08-17T20:30:00.000Z", operatorId: "alexander" });
    expect(confirmed.status).toBe("confirmed");
    if (confirmed.status !== "confirmed") throw new Error("confirmation missing");
    expect(confirmed.override).toMatchObject({ overrideId: "override-1", editOrigin: "purchase_ingredient", purchaseIngredientId: "roastbeef", operatorId: "alexander", recommendationReference: "rec-55g" });
    expect(confirmed.override.staleArtifacts).toEqual(stale);
  });

  it("recalculates through the existing review gate without inventing approval", () => {
    const override = confirmedOverride();
    const result = recalculateQuantityLineage({ confirmedOverride: override, recipe: recipe(), outputMapping: mapping() });
    expect(result.quantityDecision.decision.reviewStatus).toBe("kitchen_review_required");
    expect(result.bridge.status).toBe("review_required");
    expect(result.currentRecipe).toBeUndefined();
    expect(result.purchaseQuantities).toBeUndefined();
  });

  it("applies approved nonlinear rules only after quantity and recipe event use are separately approved", () => {
    const result = recalculateQuantityLineage({
      confirmedOverride: confirmedOverride(),
      reviewedQuantityDecision: approvedOverrideAuthority(),
      recipe: recipe(),
      recipeEventUseReview: recipeEventReview(),
      outputMapping: mapping(),
      productionScalingRules: [saltRule()],
      productionContext: []
    });
    expect(result.bridge.status).toBe("ready_for_scaling");
    expect(result.proportionalBaseline?.ingredients.find((x) => x.ingredientId === "salt")?.quantity.amount).toBe(43.64);
    expect(result.effectiveRecipeQuantity?.ingredients.find((x) => x.ingredientId === "salt")?.quantity.amount).toBe(34.91);
    expect(result.purchaseQuantities?.find((x) => x.ingredientId === "salt")?.quantity.amount).toBe(34.91);
    expect(result.appliedProductionScalingRuleIds).toEqual(["salt-large-batch"]);
  });

  it("does not apply a candidate nonlinear rule as production truth", () => {
    const result = recalculateQuantityLineage({
      confirmedOverride: confirmedOverride(),
      reviewedQuantityDecision: approvedOverrideAuthority(),
      recipe: recipe(),
      recipeEventUseReview: recipeEventReview(),
      outputMapping: mapping(),
      productionScalingRules: [saltRule("candidate")]
    });
    expect(result.bridge.status).toBe("ready_for_scaling");
    expect(result.effectiveRecipeQuantity).toEqual(result.proportionalBaseline);
    expect(result.appliedProductionScalingRuleIds).toEqual([]);
  });
});