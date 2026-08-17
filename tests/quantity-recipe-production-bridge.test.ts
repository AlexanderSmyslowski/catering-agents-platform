import { describe, expect, it } from "vitest";
import {
  evaluateQuantityRecipeProductionBridge,
  type QuantityDecisionInput,
  type Recipe,
  type RecipeEventUseReview,
  type RecipeOutputMapping
} from "@catering/shared-core";

function quantityDecision(overrides: Partial<QuantityDecisionInput> = {}): QuantityDecisionInput {
  return {
    decisionId: "qd-bridge-1",
    eventSpecId: "event-1",
    componentId: "roastbeef",
    guestCount: 50,
    serviceFormat: "buffet",
    dishRole: "main",
    basis: "servings_per_person",
    perUnitAmount: 1,
    perUnitUnit: "servings",
    targetAmount: 50,
    targetUnit: "servings",
    rationale: "Freigegebene Ausgabemenge für diesen Auftrag.",
    evidence: { kind: "operator_instruction", reference: "event-plan" },
    reviewStatus: "approved",
    ...overrides
  };
}

function weightDecision(overrides: Partial<QuantityDecisionInput> = {}): QuantityDecisionInput {
  return quantityDecision({
    basis: "per_person_weight",
    perUnitAmount: 55,
    perUnitUnit: "g",
    targetAmount: 2750,
    targetUnit: "g",
    ...overrides
  });
}

function durableApprovedRecipe(): Recipe {
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
    ingredients: [],
    steps: [{ index: 1, instruction: "Produzieren." }],
    scalingRules: { defaultLossFactor: 1 },
    allergens: [],
    dietTags: [],
    knowledge: {
      artifactKind: "operational_adaptation",
      sourceCitation: { title: "THE ONE Küchenstandard" },
      derivation: { method: "human_adaptation" },
      production: {},
      verification: {
        sourceStatus: "verified",
        allergenStatus: "verified",
        productionStatus: "verified",
        verifiedBy: "Kitchen lead",
        verifiedAt: "2026-08-17T10:00:00.000Z"
      },
      version: { revision: 1 }
    }
  };
}

function bootstrapRecipe(): Recipe {
  const recipe = durableApprovedRecipe();
  return {
    ...recipe,
    source: { ...recipe.source, tier: "digitized_cookbook", originType: "cookbook", approvalState: "review_required" },
    knowledge: {
      ...recipe.knowledge!,
      artifactKind: "ai_derived_candidate",
      derivation: { method: "ai_derivation" },
      verification: {
        sourceStatus: "verified",
        allergenStatus: "unverified",
        productionStatus: "unverified",
        verifiedBy: "Kitchen lead",
        verifiedAt: "2026-08-17T10:00:00.000Z"
      }
    }
  };
}

const acceptedEventReview: RecipeEventUseReview = {
  eventSpecId: "event-1",
  recipeId: "recipe-roastbeef",
  reviewedBy: "Kitchen lead",
  reviewedAt: "2026-08-17T12:00:00.000Z",
  decision: "accepted_for_event",
  confirmations: {
    quantitiesAndYield: true,
    methodAndEquipment: true,
    allergensAndDiet: true,
    holdingAndRegeneration: true
  }
};

function mapping(overrides: Partial<RecipeOutputMapping> = {}): RecipeOutputMapping {
  return {
    recipeId: "recipe-roastbeef",
    outputAmount: 550,
    outputUnit: "g",
    recipeServings: 10,
    reviewedBy: "Kitchen lead",
    reviewedAt: "2026-08-17T12:00:00.000Z",
    ...overrides
  };
}

describe("quantity → recipe production bridge", () => {
  it("maps an approved servings target directly to targetServings", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision(),
      recipe: durableApprovedRecipe()
    });

    expect(result.status).toBe("ready_for_scaling");
    expect(result.targetServings).toBe(50);
    expect(result.conversionMethod).toBe("direct_servings");
    expect(result.targetOutput).toEqual({ amount: 50, unit: "servings" });
    expect(result.issues).toEqual([]);
  });

  it("maps reviewed output grams to recipe servings without adding a buffer", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: weightDecision(),
      recipe: durableApprovedRecipe(),
      outputMapping: mapping()
    });

    expect(result.status).toBe("ready_for_scaling");
    expect(result.targetServings).toBe(50);
    expect(result.targetOutput).toEqual({ amount: 2750, unit: "g" });
    expect(result.conversionMethod).toBe("reviewed_output_mapping");
    expect(result).not.toHaveProperty("bufferFactor");
    expect(result).not.toHaveProperty("lossFactor");
  });

  it("requires review instead of guessing servings for a weight target without mapping", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: weightDecision(),
      recipe: durableApprovedRecipe()
    });

    expect(result.status).toBe("review_required");
    expect(result.targetServings).toBeUndefined();
    expect(result.issues).toContain("output_mapping_missing");
  });

  it("blocks a mapping with a different output unit instead of silently converting", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: weightDecision(),
      recipe: durableApprovedRecipe(),
      outputMapping: mapping({ outputUnit: "kg" })
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toContain("output_mapping_unit_mismatch");
  });

  it("blocks a mapping bound to another recipe", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: weightDecision(),
      recipe: durableApprovedRecipe(),
      outputMapping: mapping({ recipeId: "other-recipe" })
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toContain("output_mapping_recipe_mismatch");
  });

  it.each([
    ["zero output", { outputAmount: 0 }],
    ["NaN servings", { recipeServings: Number.NaN }],
    ["blank reviewer", { reviewedBy: " " }],
    ["invalid timestamp", { reviewedAt: "not-a-date" }]
  ])("blocks invalid mapping evidence: %s", (_label, override) => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: weightDecision(),
      recipe: durableApprovedRecipe(),
      outputMapping: mapping(override)
    });

    expect(result.status).toBe("blocked");
    expect(result.issues.some((issue) => issue.startsWith("output_mapping_"))).toBe(true);
  });

  it("blocks a quantity decision bound to another event", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision({ eventSpecId: "event-2" }),
      recipe: durableApprovedRecipe()
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toContain("quantity_event_binding_mismatch");
  });

  it("blocks a quantity decision bound to another component", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision({ componentId: "dessert" }),
      recipe: durableApprovedRecipe()
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toContain("quantity_component_binding_mismatch");
  });

  it("keeps a valid but not approved quantity decision in kitchen review", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision({ reviewStatus: "kitchen_review_required" }),
      recipe: durableApprovedRecipe()
    });

    expect(result.status).toBe("review_required");
    expect(result.issues).toContain("quantity_review_required");
  });

  it("blocks a rejected quantity decision", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision({ reviewStatus: "rejected" }),
      recipe: durableApprovedRecipe()
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toContain("quantity_unusable");
  });

  it("keeps a zero-seed recipe without event review in kitchen review", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision(),
      recipe: bootstrapRecipe()
    });

    expect(result.status).toBe("review_required");
    expect(result.issues).toContain("recipe_event_review_required");
  });

  it("allows a zero-seed candidate after exact-event kitchen acceptance", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision(),
      recipe: bootstrapRecipe(),
      recipeEventUseReview: acceptedEventReview
    });

    expect(result.status).toBe("ready_for_scaling");
    expect(result.targetServings).toBe(50);
  });

  it("blocks a recipe rejected for the event", () => {
    const result = evaluateQuantityRecipeProductionBridge({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      quantityDecision: quantityDecision(),
      recipe: bootstrapRecipe(),
      recipeEventUseReview: { ...acceptedEventReview, decision: "rejected_for_event" }
    });

    expect(result.status).toBe("blocked");
    expect(result.issues).toContain("recipe_event_blocked");
  });
});
