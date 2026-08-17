import { describe, expect, it } from "vitest";
import {
  applyNonlinearProductionScaling,
  type ProductionScalingRule,
  type Recipe
} from "@catering/shared-core";

function recipe(): Recipe {
  return {
    schemaVersion: "1.0.0",
    recipeId: "recipe-rahmsauce-v3",
    name: "Rahmsauce",
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
      { ingredientId: "cream", name: "Sahne", quantity: { amount: 500, unit: "ml" }, group: "Molkerei" },
      { ingredientId: "stock", name: "Fond", quantity: { amount: 300, unit: "ml" }, group: "Trockenlager" },
      { ingredientId: "salt", name: "Salz", quantity: { amount: 8, unit: "g" }, group: "Gewürze" }
    ],
    steps: [{ index: 1, instruction: "Sauce herstellen." }],
    scalingRules: { defaultLossFactor: 0, batchSize: 50 },
    allergens: [],
    dietTags: []
  };
}

function approvedRule(overrides: Partial<ProductionScalingRule> = {}): ProductionScalingRule {
  return {
    ruleId: "rule-cream-100-150",
    recipeId: "recipe-rahmsauce-v3",
    ingredientId: "cream",
    minServings: 100,
    maxServings: 150,
    model: { kind: "factor", factor: 0.9 },
    rationale: "Bei großen Chargen weniger Sahne erforderlich.",
    supportingObservationIds: ["obs-1"],
    reviewStatus: "approved",
    approvedBy: "chef-1",
    approvedAt: "2026-08-17T20:00:00.000Z",
    ...overrides
  };
}

describe("nonlinear production scaling", () => {
  it("keeps the proportional baseline when no approved rule applies", () => {
    const result = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 120, rules: [] });
    expect(result.effectiveRecipe.ingredients).toEqual(result.proportionalBaseline.ingredients);
    expect(result.appliedRuleIds).toEqual([]);
  });

  it("applies an approved factor rule only to the bound ingredient", () => {
    const result = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 120, rules: [approvedRule()] });
    const baselineCream = result.proportionalBaseline.ingredients.find((x) => x.ingredientId === "cream")!;
    const effectiveCream = result.effectiveRecipe.ingredients.find((x) => x.ingredientId === "cream")!;
    const baselineStock = result.proportionalBaseline.ingredients.find((x) => x.ingredientId === "stock")!;
    const effectiveStock = result.effectiveRecipe.ingredients.find((x) => x.ingredientId === "stock")!;

    expect(baselineCream.quantity.amount).toBe(6000);
    expect(effectiveCream.quantity.amount).toBe(5400);
    expect(effectiveStock.quantity.amount).toBe(baselineStock.quantity.amount);
    expect(result.appliedRuleIds).toEqual(["rule-cream-100-150"]);
    expect(result.adjustments).toEqual([
      expect.objectContaining({ ingredientId: "cream", baselineAmount: 6000, effectiveAmount: 5400 })
    ]);
  });

  it.each([
    [{ kind: "cap", amount: 5200, unit: "ml" } as const, 5200],
    [{ kind: "floor", amount: 6500, unit: "ml" } as const, 6500],
    [{ kind: "anchor", servings: 120, amount: 5100, unit: "ml" } as const, 5100]
  ])("applies %o deterministically", (model, expected) => {
    const result = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 120, rules: [approvedRule({ model })] });
    expect(result.effectiveRecipe.ingredients.find((x) => x.ingredientId === "cream")!.quantity.amount).toBe(expected);
  });

  it("does not apply an anchor away from its explicit production size", () => {
    const result = applyNonlinearProductionScaling({
      recipe: recipe(),
      targetServings: 121,
      rules: [approvedRule({ model: { kind: "anchor", servings: 120, amount: 5100, unit: "ml" } })]
    });
    expect(result.appliedRuleIds).toEqual([]);
  });

  it.each(["candidate", "rejected", "superseded", "revoked"] as const)("never auto-applies %s rules", (reviewStatus) => {
    const result = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 120, rules: [approvedRule({ reviewStatus })] });
    expect(result.appliedRuleIds).toEqual([]);
    expect(result.effectiveRecipe.ingredients).toEqual(result.proportionalBaseline.ingredients);
  });

  it("never applies a rule to another recipe", () => {
    const result = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 120, rules: [approvedRule({ recipeId: "other" })] });
    expect(result.appliedRuleIds).toEqual([]);
  });

  it("never applies a rule outside its servings range", () => {
    const result = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 80, rules: [approvedRule()] });
    expect(result.appliedRuleIds).toEqual([]);
  });

  it("requires matching production context when a rule declares context", () => {
    const rule = approvedRule({ requiredContext: ["tilting-pan"] });
    const miss = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 120, rules: [rule], context: ["combi-oven"] });
    const match = applyNonlinearProductionScaling({ recipe: recipe(), targetServings: 120, rules: [rule], context: ["tilting-pan"] });
    expect(miss.appliedRuleIds).toEqual([]);
    expect(match.appliedRuleIds).toEqual([rule.ruleId]);
  });

  it("fails closed on correction-unit mismatch", () => {
    const result = applyNonlinearProductionScaling({
      recipe: recipe(),
      targetServings: 120,
      rules: [approvedRule({ model: { kind: "cap", amount: 5.2, unit: "l" } })]
    });
    expect(result.appliedRuleIds).toEqual([]);
    expect(result.issues).toContain("rule_unit_mismatch:rule-cream-100-150");
  });

  it("fails closed rather than averaging conflicting approved rules", () => {
    const result = applyNonlinearProductionScaling({
      recipe: recipe(),
      targetServings: 120,
      rules: [approvedRule(), approvedRule({ ruleId: "rule-cream-2", model: { kind: "factor", factor: 0.85 } })]
    });
    expect(result.appliedRuleIds).toEqual([]);
    expect(result.issues).toContain("conflicting_approved_rules:cream");
    expect(result.effectiveRecipe.ingredients.find((x) => x.ingredientId === "cream")!.quantity.amount).toBe(6000);
  });
});