import { describe, expect, it } from "vitest";
import type {
  ApprovedProductionSpec,
  QuantityRecommendationEvidence,
  TrustedActor
} from "@catering/shared-core";
import { buildApprovedSnapshotQuantityRuntime } from "../production-service/src/quantity-workflow/default-runtime.js";

const actor: TrustedActor = {
  businessId: "local",
  name: "Produktions-Mitarbeiter",
  source: "dev-default",
  trusted: false
};

function snapshot(): ApprovedProductionSpec {
  return {
    schemaVersion: "1.0",
    businessId: "local",
    approvedProductionSpecId: "approved-spec-1",
    sourceDraft: { draftId: "draft-1", revision: 3 },
    approvalRequestId: "approval-1",
    approvedAt: "2026-08-17T20:00:00.000Z",
    artifacts: {
      eventSpec: {
        schemaVersion: "1.0.0",
        specId: "event-1",
        lifecycle: { commercialState: "accepted" },
        readiness: { status: "complete", issues: [] },
        sourceLineage: [{ sourceType: "manual_input", reference: "fixture" }],
        event: { type: "Sommerfest", serviceForm: "buffet" },
        attendees: { expected: 50 },
        servicePlan: { eventType: "Sommerfest", serviceForm: "buffet", modules: [] },
        menuPlan: [{ componentId: "roastbeef", label: "Roastbeef", course: "main" }]
      },
      productionPlan: {
        schemaVersion: "1.0.0",
        planId: "plan-1",
        eventSpecId: "event-1",
        readiness: { status: "complete", issues: [] },
        productionBatches: [{
          batchId: "batch-1",
          componentId: "roastbeef",
          recipeId: "recipe-1",
          scaledYield: { amount: 50, unit: "servings" },
          batchCount: 2,
          lossFactor: 0,
          gnPlan: [],
          station: "Kaltküche",
          prepWindow: "Vortag",
          ingredients: [
            { ingredientId: "beef", name: "Roastbeef", quantity: { amount: 2750, unit: "g" }, group: "Fleisch" },
            { ingredientId: "salt", name: "Salz", quantity: { amount: 40, unit: "g" }, group: "Gewürze" }
          ],
          steps: [{ index: 1, instruction: "Produzieren." }]
        }],
        timeline: [],
        kitchenSheets: [],
        recipeSelections: [{ componentId: "roastbeef", recipeId: "recipe-1", selectionReason: "approved", autoUsedInternetRecipe: false }],
        unresolvedItems: []
      },
      purchaseList: {
        schemaVersion: "1.0.0",
        purchaseListId: "purchase-1",
        eventSpecId: "event-1",
        items: [
          {
            ingredientId: "beef",
            displayName: "Roastbeef",
            normalizedQty: 2750,
            normalizedUnit: "g",
            purchaseQty: 2.75,
            purchaseUnit: "kg",
            group: "Fleisch",
            sourceRecipes: ["recipe-1"],
            mappingConfidence: 1
          },
          {
            ingredientId: "salt",
            displayName: "Salz",
            normalizedQty: 40,
            normalizedUnit: "g",
            purchaseQty: 40,
            purchaseUnit: "g",
            group: "Gewürze",
            sourceRecipes: ["recipe-1", "recipe-other"],
            mappingConfidence: 1
          }
        ],
        groupingMode: "group",
        totals: { itemCount: 2, groups: ["Fleisch", "Gewürze"] }
      },
      recipes: [{
        schemaVersion: "1.0.0",
        recipeId: "recipe-1",
        name: "Roastbeef",
        source: {
          tier: "internal_verified",
          originType: "internal_db",
          reference: "fixture",
          retrievedAt: "2026-08-17T10:00:00.000Z",
          approvalState: "approved_internal",
          qualityScore: 1,
          fitScore: 1,
          extractionCompleteness: 1
        },
        baseYield: { servings: 10, unit: "servings" },
        ingredients: [
          { ingredientId: "beef", name: "Roastbeef", quantity: { amount: 550, unit: "g" }, group: "Fleisch" },
          { ingredientId: "salt", name: "Salz", quantity: { amount: 8, unit: "g" }, group: "Gewürze" }
        ],
        steps: [{ index: 1, instruction: "Produzieren." }],
        scalingRules: { defaultLossFactor: 0, batchSize: 25 },
        allergens: [],
        dietTags: []
      }]
    }
  };
}

describe("approved snapshot quantity runtime", () => {
  it("reconstructs approved servings authority without client-owned evidence", async () => {
    const evidence: QuantityRecommendationEvidence[] = [{
      evidenceId: "professional-1",
      sourceKind: "professional_reference",
      reference: "Reference",
      dishRole: "main",
      serviceFormats: ["buffet"],
      basis: "servings_per_person",
      unit: "servings",
      minAmount: 0.8,
      preferredAmount: 1,
      maxAmount: 1.2,
      rationale: "Professionelle Portionslogik."
    }];
    const result = await buildApprovedSnapshotQuantityRuntime({
      actor,
      caseId: "case-1",
      approvedSpec: snapshot(),
      evidenceFor: async () => evidence
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.projectionInput.currentAuthority).toMatchObject({
      eventSpecId: "event-1",
      componentId: "roastbeef",
      basis: "servings_per_person",
      perUnitAmount: 1,
      targetAmount: 50,
      targetUnit: "servings",
      reviewStatus: "approved"
    });
    expect(result[0]?.projectionInput.recommendationInput.evidence).toEqual(evidence);
    expect(result[0]?.previewInput.outputMapping).toMatchObject({
      recipeId: "recipe-1",
      outputAmount: 10,
      outputUnit: "servings",
      recipeServings: 10
    });
  });

  it("defaults to no professional evidence and marks only exactly reversible purchase rows editable", async () => {
    const result = await buildApprovedSnapshotQuantityRuntime({
      actor,
      caseId: "case-1",
      approvedSpec: snapshot()
    });

    expect(result[0]?.projectionInput.recommendationInput.evidence).toEqual([]);
    expect(result[0]?.projectionInput.purchaseRows.map((row) => [row.rowId, Boolean(row.lineage)])).toEqual([
      ["purchase-1:beef", true],
      ["purchase-1:salt", false]
    ]);
  });
});
