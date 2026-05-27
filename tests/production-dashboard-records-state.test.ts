import { describe, expect, it } from "vitest";
import { buildProductionDashboardRecordsState } from "../backoffice-ui/src/production-dashboard-records-state.js";

describe("production dashboard records state", () => {
  const acceptedSpecs = [
    { specId: "spec-old", label: "Classic Buffet" },
    { specId: "spec-current", label: "Almond Quick Lunch" }
  ];
  const productionPlans = [
    { planId: "plan-20260501", eventSpecId: "spec-old", label: "Classic Buffet" },
    { planId: "plan-20260503", eventSpecId: "spec-current", label: "Almond Quick Lunch" },
    { planId: "manual-plan", eventSpecId: "spec-manual", label: "Manual Plan" }
  ];
  const purchaseLists = [
    { purchaseListId: "purchase-20260502", eventSpecId: "spec-old", label: "Classic Einkauf" },
    { purchaseListId: "purchase-20260504", eventSpecId: "spec-current", label: "Almond Einkauf" }
  ];
  const auditEvents = [
    { auditId: "audit-1", summary: "Classic audit" },
    { auditId: "audit-2", summary: "Almond audit" }
  ];
  const recipes = [
    { recipeId: "recipe-classic", name: "Classic Recipe" },
    { recipeId: "recipe-almond", name: "Almond Curry" }
  ];

  it("keeps production records filtered and ordered with artifact spec ids", () => {
    const state = buildProductionDashboardRecordsState({
      acceptedSpecs,
      productionPlans,
      purchaseLists,
      auditEvents,
      recipes,
      searchText: ""
    });

    expect(state.filteredSpecs).toBe(acceptedSpecs);
    expect(state.orderedPlans.map((plan) => plan.planId)).toEqual([
      "plan-20260503",
      "plan-20260501",
      "manual-plan"
    ]);
    expect(state.orderedPurchaseLists.map((purchaseList) => purchaseList.purchaseListId)).toEqual([
      "purchase-20260504",
      "purchase-20260502"
    ]);
    expect(state.specById.get("spec-current")).toBe(acceptedSpecs[1]);
    expect(state.productionArtifactSpecIds).toEqual(["spec-current", "spec-old", "spec-manual"]);
  });

  it("applies the dashboard search text consistently to production-side records", () => {
    const state = buildProductionDashboardRecordsState({
      acceptedSpecs,
      productionPlans,
      purchaseLists,
      auditEvents,
      recipes,
      searchText: "almond"
    });

    expect(state.filteredSpecs.map((spec) => spec.specId)).toEqual(["spec-current"]);
    expect(state.orderedPlans.map((plan) => plan.planId)).toEqual(["plan-20260503"]);
    expect(state.orderedPurchaseLists.map((purchaseList) => purchaseList.purchaseListId)).toEqual([
      "purchase-20260504"
    ]);
    expect(state.filteredAuditEvents.map((event) => event.auditId)).toEqual(["audit-2"]);
    expect(state.filteredRecipes.map((recipe) => recipe.recipeId)).toEqual(["recipe-almond"]);
    expect(state.productionArtifactSpecIds).toEqual(["spec-current"]);
  });
});
