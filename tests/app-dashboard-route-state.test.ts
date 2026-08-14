import { describe, expect, it } from "vitest";
import { buildAppDashboardRouteState } from "../backoffice-ui/src/app-dashboard-route-state.js";
import type { ProductRouteDashboard } from "../backoffice-ui/src/api.js";
import type {
  AcceptedEventSpec,
  AuditEntry,
  OfferDraft,
  ProductionPlan,
  PurchaseList,
  Recipe
} from "@catering/shared-core";

function acceptedSpec(specId: string, title: string, status: "complete" | "partial"): AcceptedEventSpec {
  return {
    schemaVersion: "1.0",
    specId,
    lifecycle: { commercialState: "manual" },
    readiness: { status, reasons: [] },
    sourceLineage: [],
    event: { title },
    attendees: { expected: 30 },
    servicePlan: { eventType: "Empfang", serviceForm: "Buffet", modules: [] },
    menuPlan: []
  };
}

function offerDraft(draftId: string, label: string, proposedEventSpec: AcceptedEventSpec): OfferDraft {
  return {
    schemaVersion: "1.0",
    businessId: "local",
    draftId,
    revision: 1,
    eventSummary: label,
    serviceModules: [],
    pricingSummary: { subtotal: { amount: 0, currency: "EUR" } },
    assumptions: [],
    openQuestions: [],
    variantSet: [],
    customerFacingText: "",
    internalWorkingText: "",
    proposedEventSpec
  };
}

function productionPlan(planId: string, eventSpecId: string, label: string): ProductionPlan {
  return {
    schemaVersion: "1.0",
    planId,
    eventSpecId,
    readiness: { status: "complete", reasons: [] },
    productionBatches: [],
    timeline: [{ label, at: "2026-05-03T12:00:00.000Z" }],
    kitchenSheets: [],
    recipeSelections: [],
    unresolvedItems: []
  };
}

function purchaseList(purchaseListId: string, eventSpecId: string, label: string): PurchaseList {
  return {
    schemaVersion: "1.0",
    purchaseListId,
    eventSpecId,
    items: [{
      ingredientId: `${purchaseListId}-ingredient`,
      displayName: label,
      normalizedQty: 1,
      normalizedUnit: "Stück",
      purchaseQty: 1,
      purchaseUnit: "Stück",
      group: "Test",
      sourceRecipes: [],
      mappingConfidence: 1
    }],
    groupingMode: "group",
    totals: { itemCount: 1, groups: ["Test"] }
  };
}

function recipe(recipeId: string, name: string, approvalState: "approved_internal" | "review_required"): Recipe {
  return {
    schemaVersion: "1.0",
    recipeId,
    name,
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: recipeId,
      retrievedAt: "2026-05-01T00:00:00.000Z",
      approvalState,
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: { servings: 10, unit: "Portion" },
    ingredients: [],
    steps: [],
    scalingRules: { defaultLossFactor: 0 },
    allergens: [],
    dietTags: []
  };
}

function auditEntry(auditId: string, summary: string): AuditEntry {
  return {
    auditId,
    businessId: "local",
    at: "2026-05-03T12:00:00.000Z",
    action: "test",
    entityType: "test",
    entityId: auditId,
    actor: { name: "Test", source: "fixture" },
    summary
  };
}

function dashboard(): ProductRouteDashboard {
  const oldSpec = acceptedSpec("spec-old", "Classic Buffet", "complete");
  const currentSpec = acceptedSpec("spec-current", "Almond Quick Lunch", "partial");
  return {
    intakeRequests: [
      { requestId: "request-old", originalText: "alt" },
      { requestId: "request-latest", originalText: "neu" }
    ],
    acceptedSpecs: [oldSpec, currentSpec],
    offerDrafts: [
      offerDraft("draft-old", "Classic Draft", oldSpec),
      offerDraft("draft-current", "Almond Draft", currentSpec)
    ],
    productionPlans: [
      productionPlan("plan-20260501", "spec-old", "Classic Buffet"),
      productionPlan("plan-20260503", "spec-current", "Almond Quick Lunch")
    ],
    purchaseLists: [
      purchaseList("purchase-20260502", "spec-old", "Classic Einkauf"),
      purchaseList("purchase-20260504", "spec-current", "Almond Einkauf")
    ],
    recipes: [
      recipe("recipe-approved", "Almond Curry", "approved_internal"),
      recipe("recipe-review", "Classic Salad", "review_required")
    ],
    auditEvents: [auditEntry("audit-classic", "Classic audit"), auditEntry("audit-almond", "Almond audit")]
  };
}

describe("app dashboard route state", () => {
  it("builds the App dashboard-derived route state in one tested boundary", () => {
    const state = buildAppDashboardRouteState({
      dashboard: dashboard(),
      route: "production",
      loading: true,
      searchText: "almond",
      selectedDraftId: "draft-old"
    });

    expect(state.filteredOfferDrafts.map((draft) => draft.draftId)).toEqual(["draft-current"]);
    expect(state.filteredSpecs.map((spec) => spec.specId)).toEqual(["spec-current"]);
    expect(state.orderedPlans.map((plan) => plan.planId)).toEqual(["plan-20260503"]);
    expect(state.orderedPurchaseLists.map((purchaseList) => purchaseList.purchaseListId)).toEqual([
      "purchase-20260504"
    ]);
    expect(state.filteredRecipes.map((recipe) => recipe.recipeId)).toEqual(["recipe-approved"]);
    expect(state.filteredAuditEvents.map((event) => event.auditId)).toEqual(["audit-almond"]);
    expect(state.productionArtifactSpecIds).toEqual(["spec-current"]);
    expect(state.offerHandoffCounts).toEqual({ complete: 1, partial: 1 });
    expect(state.latestIntakeRequestSummary).toBe("letzte Erfassung: unbekannte Quelle");
    expect(state.isInitialHomeLoading).toBe(false);
    expect(state.isInitialProductionLoading).toBe(false);
    expect(state.selectedDraft?.draftId).toBe("draft-old");
    expect(state.activeOfferDraft?.draftId).toBe("draft-old");
    expect(state.activeOfferSpec).toBeUndefined();
    expect(state.recipeReviewCounts).toEqual({ approved: 1, reviewRequired: 1, rejected: 0 });
    expect(state.recipeReviewStatusLabel).toBe("1 zu prüfen");
  });

  it("does not open the latest offer data without an explicit selection", () => {
    const state = buildAppDashboardRouteState({
      dashboard: dashboard(),
      route: "offer",
      loading: false,
      searchText: "",
      selectedDraftId: undefined
    });

    expect(state.filteredOfferDrafts).toHaveLength(2);
    expect(state.selectedDraft).toBeUndefined();
    expect(state.activeOfferDraft).toBeUndefined();
    expect(state.activeOfferSpec).toBeUndefined();
  });

  it("keeps the empty home loading and offer fallback behavior", () => {
    const emptyDashboard: ProductRouteDashboard = {
      intakeRequests: [],
      acceptedSpecs: [],
      offerDrafts: [],
      productionPlans: [],
      purchaseLists: [],
      recipes: [],
      auditEvents: []
    };

    const state = buildAppDashboardRouteState({
      dashboard: emptyDashboard,
      route: "home",
      loading: true,
      searchText: "",
      selectedDraftId: undefined
    });

    expect(state.isInitialHomeLoading).toBe(true);
    expect(state.isInitialProductionLoading).toBe(false);
    expect(state.selectedDraft).toBeUndefined();
    expect(state.activeOfferDraft).toBeUndefined();
    expect(state.activeOfferSpec).toBeUndefined();
    expect(state.filteredOfferDrafts).toBe(emptyDashboard.offerDrafts);
    expect(state.filteredSpecs).toBe(emptyDashboard.acceptedSpecs);
  });
});
