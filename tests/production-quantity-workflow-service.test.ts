import { describe, expect, it } from "vitest";
import type {
  ProductionScalingRule,
  QuantityDecisionInput,
  QuantityRecommendationInput,
  Recipe,
  RecipeOutputMapping
} from "@catering/shared-core";
import {
  buildQuantityWorkflowProjection,
  previewProductionQuantityOverride
} from "../production-service/src/quantity-workflow/service.js";

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
  return {
    recipeId: "recipe-roastbeef",
    outputAmount: 550,
    outputUnit: "g",
    recipeServings: 10,
    reviewedBy: "chef",
    reviewedAt: "2026-08-17T10:00:00.000Z"
  };
}

function recommendation(evidence = true): QuantityRecommendationInput {
  return {
    decisionId: "recommendation-1",
    eventSpecId: "event-1",
    componentId: "roastbeef",
    guestCount: 50,
    serviceFormat: "buffet",
    dishRole: "main",
    basis: "per_person_weight",
    evidence: evidence
      ? [{
          evidenceId: "professional-1",
          sourceKind: "professional_reference",
          reference: "Professional Catering Reference",
          dishRole: "main",
          serviceFormats: ["buffet"],
          basis: "per_person_weight",
          unit: "g",
          minAmount: 50,
          preferredAmount: 55,
          maxAmount: 65,
          rationale: "Professioneller Korridor für diese Rolle und Ausgabeform."
        }]
      : []
  };
}

function saltRule(): ProductionScalingRule {
  return {
    ruleId: "salt-large-batch",
    recipeId: "recipe-roastbeef",
    ingredientId: "salt",
    minServings: 50,
    maxServings: 60,
    model: { kind: "factor", factor: 0.8 },
    rationale: "Salz skaliert in dieser Produktionsgröße nicht vollständig linear.",
    supportingObservationIds: ["obs-salt-1"],
    reviewStatus: "approved",
    approvedBy: "chef",
    approvedAt: "2026-08-17T21:00:00.000Z"
  };
}

describe("production quantity workflow service", () => {
  it("projects a concrete recommendation and professional corridor without replacing current authority", () => {
    const result = buildQuantityWorkflowProjection({
      componentId: "roastbeef",
      label: "Roastbeef",
      recommendationInput: recommendation(),
      currentAuthority: authority(),
      purchaseRows: [
        {
          rowId: "purchase-roastbeef",
          articleName: "Roastbeef",
          amount: 2750,
          unit: "g",
          lineage: { eventSpecId: "event-1", componentId: "roastbeef", recipeId: "recipe-roastbeef", ingredientId: "roastbeef" }
        }
      ]
    });

    expect(result).toMatchObject({
      componentId: "roastbeef",
      label: "Roastbeef",
      status: "recommended",
      recommendedAmount: 55,
      unit: "g",
      professionalRange: { min: 50, max: 65, unit: "g" },
      targetTotal: { amount: 2750, unit: "g" },
      currentAuthority: { perUnitAmount: 55, targetAmount: 2750, unit: "g" },
      canEdit: true
    });
    expect(result.purchaseRows[0]).toMatchObject({ rowId: "purchase-roastbeef", editable: true });
  });

  it("shows evidence insufficiency without inventing a quantity", () => {
    const result = buildQuantityWorkflowProjection({
      componentId: "roastbeef",
      label: "Roastbeef",
      recommendationInput: recommendation(false),
      currentAuthority: authority(),
      purchaseRows: []
    });

    expect(result.status).toBe("evidence_insufficient");
    expect(result.recommendedAmount).toBeUndefined();
    expect(result.professionalRange).toBeUndefined();
    expect(result.reviewMessage).toContain("Küchenentscheidung");
  });

  it("marks ambiguous or non-recipe purchase rows read-only", () => {
    const result = buildQuantityWorkflowProjection({
      componentId: "roastbeef",
      label: "Roastbeef",
      recommendationInput: recommendation(),
      currentAuthority: authority(),
      purchaseRows: [
        { rowId: "ambiguous", articleName: "Salz", amount: 40, unit: "g" },
        {
          rowId: "wrong-component",
          articleName: "Roastbeef",
          amount: 2750,
          unit: "g",
          lineage: { eventSpecId: "event-1", componentId: "other", recipeId: "recipe-roastbeef", ingredientId: "roastbeef" }
        }
      ]
    });

    expect(result.purchaseRows.map((row) => row.editable)).toEqual([false, false]);
    expect(result.purchaseRows.every((row) => row.readOnlyReason)).toBe(true);
  });

  it("previews a target edit side-effect-free and exposes baseline versus approved nonlinear effective quantities", () => {
    const oldAuthority = authority();
    const result = previewProductionQuantityOverride({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      recipe: recipe(),
      currentAuthority: oldAuthority,
      outputMapping: mapping(),
      recommendationReference: "recommendation-1",
      edit: { origin: "target_output", perUnitAmount: 60, unit: "g" },
      productionScalingRules: [saltRule()]
    });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") throw new Error("preview missing");
    expect(oldAuthority.targetAmount).toBe(2750);
    expect(result.previousValue).toEqual({ amount: 55, unit: "g" });
    expect(result.requestedValue).toEqual({ amount: 60, unit: "g" });
    expect(result.resultingTarget).toEqual({ amount: 3000, unit: "g" });
    expect(result.scaleFactor).toBeCloseTo(3000 / 2750);
    expect(result.recipeChanges.find((x) => x.ingredientId === "salt")).toMatchObject({ baselineAmount: 43.64, effectiveAmount: 34.91, unit: "g" });
    expect(result.appliedRuleIds).toEqual(["salt-large-batch"]);
    expect(result.confirmable).toBe(true);
  });

  it("previews a purchase edit as a complete recipe-scale change rather than a one-row patch", () => {
    const result = previewProductionQuantityOverride({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      recipe: recipe(),
      currentAuthority: authority(),
      outputMapping: mapping(),
      edit: { origin: "purchase_ingredient", ingredientId: "roastbeef", amount: 3000, unit: "g" }
    });

    expect(result.status).toBe("preview_ready");
    if (result.status !== "preview_ready") throw new Error("preview missing");
    expect(result.requestedValue).toEqual({ amount: 3000, unit: "g" });
    expect(result.recipeChanges).toHaveLength(2);
    expect(result.purchaseChanges).toHaveLength(2);
    const roastbeefAmount = result.recipeChanges.find((x) => x.ingredientId === "roastbeef")?.effectiveAmount;
    expect(roastbeefAmount).toBeDefined();
    expect(Math.abs(roastbeefAmount! - 3000)).toBeLessThanOrEqual(0.5);
    expect(result.recipeChanges.find((x) => x.ingredientId === "salt")?.effectiveAmount).toBe(43.64);
  });
});