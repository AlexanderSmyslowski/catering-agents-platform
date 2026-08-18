import { describe, expect, it, vi } from "vitest";
import type { ApprovedProductionSpec } from "@catering/shared-core";
import { buildProductionApp, ProductionStore } from "@catering/production-service";

const headers = { "x-actor-name": "Produktions-Mitarbeiter" };

function approvedSpec(): ApprovedProductionSpec {
  return {
    schemaVersion: "1.0",
    businessId: "local",
    approvedProductionSpecId: "approved-spec-quantity-app",
    sourceDraft: { draftId: "draft-quantity-app", revision: 1 },
    approvalRequestId: "approval-quantity-app",
    approvedAt: "2026-08-18T07:00:00.000Z",
    artifacts: {
      eventSpec: {
        schemaVersion: "1.0.0",
        specId: "event-quantity-app",
        lifecycle: { commercialState: "accepted" },
        readiness: { status: "complete", reasons: [] },
        sourceLineage: [{ sourceType: "manual_input", reference: "fixture" }],
        event: { type: "Sommerfest", serviceForm: "buffet" },
        attendees: { expected: 20 },
        servicePlan: { eventType: "Sommerfest", serviceForm: "buffet", modules: [] },
        menuPlan: [{ componentId: "component-1", label: "Testgericht", course: "main" }]
      },
      productionPlan: {
        schemaVersion: "1.0.0",
        planId: "plan-quantity-app",
        eventSpecId: "event-quantity-app",
        readiness: { status: "complete", reasons: [] },
        productionBatches: [{
          batchId: "batch-1",
          componentId: "component-1",
          recipeId: "recipe-1",
          scaledYield: { amount: 20, unit: "servings" },
          batchCount: 1,
          lossFactor: 0,
          gnPlan: [],
          station: "Küche",
          prepWindow: "Vortag",
          ingredients: [{ ingredientId: "ingredient-1", name: "Zutat", quantity: { amount: 1000, unit: "g" }, group: "Test" }],
          steps: [{ index: 1, instruction: "Produzieren." }]
        }],
        timeline: [],
        kitchenSheets: [],
        recipeSelections: [{ componentId: "component-1", recipeId: "recipe-1", selectionReason: "approved", autoUsedInternetRecipe: false }],
        unresolvedItems: []
      },
      purchaseList: {
        schemaVersion: "1.0.0",
        purchaseListId: "purchase-quantity-app",
        eventSpecId: "event-quantity-app",
        items: [{
          ingredientId: "ingredient-1",
          displayName: "Zutat",
          normalizedQty: 1000,
          normalizedUnit: "g",
          purchaseQty: 1,
          purchaseUnit: "kg",
          group: "Test",
          sourceRecipes: ["recipe-1"],
          mappingConfidence: 1
        }],
        groupingMode: "group",
        totals: { itemCount: 1, groups: ["Test"] }
      },
      recipes: [{
        schemaVersion: "1.0.0",
        recipeId: "recipe-1",
        name: "Testgericht",
        source: {
          tier: "internal_verified",
          originType: "internal_db",
          reference: "fixture",
          retrievedAt: "2026-08-18T06:00:00.000Z",
          approvalState: "approved_internal",
          qualityScore: 1,
          fitScore: 1,
          extractionCompleteness: 1
        },
        baseYield: { servings: 10, unit: "servings" },
        ingredients: [{ ingredientId: "ingredient-1", name: "Zutat", quantity: { amount: 500, unit: "g" }, group: "Test" }],
        steps: [{ index: 1, instruction: "Produzieren." }],
        scalingRules: { defaultLossFactor: 0 },
        allergens: [],
        dietTags: []
      }]
    }
  };
}

function buildApp() {
  const store = new ProductionStore();
  vi.spyOn(store, "getCase").mockResolvedValue({
    schemaVersion: "1.0",
    businessId: "local",
    caseId: "case-quantity-app",
    product: "production",
    displayName: "Test",
    status: "open",
    version: 1,
    createdAt: "2026-08-18T07:00:00.000Z",
    updatedAt: "2026-08-18T07:00:00.000Z",
    approvedProductionSpecId: "approved-spec-quantity-app"
  });
  vi.spyOn(store, "getApprovedProductionSpec").mockResolvedValue(approvedSpec());
  return buildProductionApp({
    store,
    env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_DEV_AUTH: "true" }
  });
}

describe("production app quantity workflow registration", () => {
  it("resolves the linked approved snapshot server-side", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/production/cases/case-quantity-app/quantity-workflow", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({ componentId: "component-1", status: "evidence_insufficient" });
  });

  it("persists a confirmed quantity change and exposes it after reload as review-required authority", async () => {
    const app = buildApp();
    const preview = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-quantity-app/quantity-workflow/component-1/preview",
      headers,
      payload: { edit: { origin: "target_output", perUnitAmount: 1.2, unit: "servings" } }
    });
    expect(preview.statusCode).toBe(200);
    const previewPayload = preview.json();

    const confirm = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-quantity-app/quantity-workflow/component-1/confirm",
      headers,
      payload: {
        previewId: previewPayload.previewId,
        edit: { origin: "target_output", perUnitAmount: 1.2, unit: "servings" }
      }
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().status).toBe("review_required");

    const reload = await app.inject({ method: "GET", url: "/v1/production/cases/case-quantity-app/quantity-workflow", headers });
    expect(reload.statusCode).toBe(200);
    expect(reload.json().items[0]).toMatchObject({
      currentAuthority: {
        perUnitAmount: 1.2,
        targetAmount: 24,
        unit: "servings",
        reviewStatus: "kitchen_review_required"
      }
    });
    expect(reload.json().items[0].purchaseRows[0].editable).toBe(false);
  });
});
