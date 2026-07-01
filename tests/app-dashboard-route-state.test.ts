import { describe, expect, it } from "vitest";
import { buildAppDashboardRouteState } from "../backoffice-ui/src/app-dashboard-route-state.js";
import type { DashboardState } from "../backoffice-ui/src/api.js";

function dashboard(): DashboardState {
  return {
    intakeRequests: [
      { requestId: "request-old", originalText: "alt" },
      { requestId: "request-latest", originalText: "neu" }
    ],
    acceptedSpecs: [
      { specId: "spec-old", label: "Classic Buffet", readiness: { status: "complete" } },
      { specId: "spec-current", label: "Almond Quick Lunch", readiness: { status: "partial" } }
    ],
    offerDrafts: [
      { draftId: "draft-old", label: "Classic Draft" },
      { draftId: "draft-current", label: "Almond Draft" }
    ],
    productionPlans: [
      { planId: "plan-20260501", eventSpecId: "spec-old", label: "Classic Buffet" },
      { planId: "plan-20260503", eventSpecId: "spec-current", label: "Almond Quick Lunch" }
    ],
    purchaseLists: [
      { purchaseListId: "purchase-20260502", eventSpecId: "spec-old", label: "Classic Einkauf" },
      { purchaseListId: "purchase-20260504", eventSpecId: "spec-current", label: "Almond Einkauf" }
    ],
    recipes: [
      { recipeId: "recipe-approved", name: "Almond Curry", source: { approvalState: "approved_internal" } },
      { recipeId: "recipe-review", name: "Classic Salad", source: { approvalState: "review_required" } }
    ],
    auditEvents: [
      { auditId: "audit-classic", summary: "Classic audit" },
      { auditId: "audit-almond", summary: "Almond audit" }
    ]
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
    expect(state.activeOfferSpec?.specId).toBe("spec-current");
    expect(state.recipeReviewCounts).toEqual({ approved: 1, reviewRequired: 1, rejected: 0 });
    expect(state.recipeReviewStatusLabel).toBe("1 zu prüfen");
  });

  it("keeps the empty home loading and offer fallback behavior", () => {
    const emptyDashboard: DashboardState = {
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
