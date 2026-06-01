import { describe, expect, it } from "vitest";
import { buildProductionArtifactSelectionAppBoundary } from "../backoffice-ui/src/production-artifact-selection-app-boundary.js";

describe("production artifact selection app boundary", () => {
  const currentSpec = {
    specId: "spec-current",
    menuPlan: [{ componentId: "component-main", label: "Main" }]
  };
  const otherSpec = {
    specId: "spec-other",
    menuPlan: [{ componentId: "component-other", label: "Other" }]
  };
  const specById = new Map<string, Record<string, unknown>>([
    ["spec-current", currentSpec],
    ["spec-other", otherSpec]
  ]);
  const orderedPlans = [
    { planId: "plan-current", eventSpecId: "spec-current" },
    { planId: "plan-other", eventSpecId: "spec-other" }
  ];
  const orderedPurchaseLists = [
    { purchaseListId: "purchase-current", eventSpecId: "spec-current" },
    { purchaseListId: "purchase-other", eventSpecId: "spec-other" }
  ];

  it("builds current artifacts and selected plan state from one App-visible boundary", () => {
    const state = buildProductionArtifactSelectionAppBoundary({
      focusedProductionSpecId: " spec-current ",
      selectedPlanId: "plan-other",
      orderedPlans,
      orderedPurchaseLists,
      productionWorkspaceCleared: false,
      specById
    });

    expect(state.currentProductionSpecId).toBe("spec-current");
    expect(state.currentSpecPlans).toEqual([orderedPlans[0]]);
    expect(state.archivedPlans).toEqual([orderedPlans[1]]);
    expect(state.currentSpecPurchaseLists).toEqual([orderedPurchaseLists[0]]);
    expect(state.archivedPurchaseLists).toEqual([orderedPurchaseLists[1]]);
    expect(state.selectedPlan).toBe(orderedPlans[1]);
    expect(state.selectedPlanSpec).toBe(otherSpec);
    expect([...state.selectedPlanComponentsById.keys()]).toEqual(["component-other"]);
  });

  it("keeps selected-plan scoping fallback and clears stale artifacts when workspace is cleared", () => {
    const selectedState = buildProductionArtifactSelectionAppBoundary({
      selectedPlanId: " plan-other ",
      orderedPlans,
      orderedPurchaseLists,
      productionWorkspaceCleared: false,
      specById
    });

    expect(selectedState.currentProductionSpecId).toBe("spec-other");
    expect(selectedState.currentSpecPlans).toEqual([orderedPlans[1]]);
    expect(selectedState.currentSpecPurchaseLists).toEqual([orderedPurchaseLists[1]]);
    expect(selectedState.selectedPlan).toBe(orderedPlans[1]);

    const clearedState = buildProductionArtifactSelectionAppBoundary({
      focusedProductionSpecId: "spec-current",
      selectedPlanId: "plan-current",
      orderedPlans,
      orderedPurchaseLists,
      productionWorkspaceCleared: true,
      specById
    });

    expect(clearedState.currentProductionSpecId).toBe("spec-current");
    expect(clearedState.currentSpecPlans).toEqual([]);
    expect(clearedState.archivedPlans).toEqual([]);
    expect(clearedState.currentSpecPurchaseLists).toEqual([]);
    expect(clearedState.archivedPurchaseLists).toEqual([]);
    expect(clearedState.selectedPlan).toBeUndefined();
    expect(clearedState.selectedPlanSpec).toBeUndefined();
    expect(clearedState.selectedPlanComponentsById.size).toBe(0);
  });
});
