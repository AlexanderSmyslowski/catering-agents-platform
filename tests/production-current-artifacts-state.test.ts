import { describe, expect, it } from "vitest";
import {
  buildProductionCurrentArtifactsState,
  selectCurrentProductionArtifactsScopeSpecId
} from "../backoffice-ui/src/production-current-artifacts-state.js";

describe("production current artifacts state", () => {
  const plans = [
    { planId: "plan-current", eventSpecId: "spec-current" },
    { planId: "plan-archived", eventSpecId: "spec-other" }
  ];
  const purchaseLists = [
    { purchaseListId: "purchase-current", eventSpecId: "spec-current" },
    { purchaseListId: "purchase-archived", eventSpecId: "spec-other" }
  ];

  it("splits plans and purchase lists into current and archived artifacts", () => {
    expect(
      buildProductionCurrentArtifactsState({
        currentProductionSpecId: "spec-current",
        orderedPlans: plans,
        orderedPurchaseLists: purchaseLists,
        productionWorkspaceCleared: false
      })
    ).toEqual({
      currentSpecPlans: [plans[0]],
      archivedPlans: [plans[1]],
      currentSpecPurchaseLists: [purchaseLists[0]],
      archivedPurchaseLists: [purchaseLists[1]]
    });
  });

  it("keeps the unscoped fallback behavior when no production spec is focused", () => {
    const state = buildProductionCurrentArtifactsState({
      currentProductionSpecId: "",
      orderedPlans: plans,
      orderedPurchaseLists: purchaseLists,
      productionWorkspaceCleared: false
    });

    expect(state.currentSpecPlans).toBe(plans);
    expect(state.archivedPlans).toEqual([]);
    expect(state.currentSpecPurchaseLists).toBe(purchaseLists);
    expect(state.archivedPurchaseLists).toEqual([]);
  });

  it("clears all artifact lists when the production workspace is cleared", () => {
    expect(
      buildProductionCurrentArtifactsState({
        currentProductionSpecId: "spec-current",
        orderedPlans: plans,
        orderedPurchaseLists: purchaseLists,
        productionWorkspaceCleared: true
      })
    ).toEqual({
      currentSpecPlans: [],
      archivedPlans: [],
      currentSpecPurchaseLists: [],
      archivedPurchaseLists: []
    });
  });

  it("scopes plan-centered artifacts from the selected or newest production plan", () => {
    expect(
      selectCurrentProductionArtifactsScopeSpecId({
        focusedProductionSpecId: " spec-focused ",
        selectedPlanId: "plan-other",
        orderedPlans: plans
      })
    ).toBe("spec-focused");

    expect(
      selectCurrentProductionArtifactsScopeSpecId({
        selectedPlanId: "plan-archived",
        orderedPlans: plans
      })
    ).toBe("spec-other");

    expect(
      selectCurrentProductionArtifactsScopeSpecId({
        selectedPlanId: undefined,
        orderedPlans: plans
      })
    ).toBe("spec-current");
  });

  it("normalizes selected plan and plan spec IDs before scoping current artifacts", () => {
    expect(
      selectCurrentProductionArtifactsScopeSpecId({
        selectedPlanId: " plan-archived ",
        orderedPlans: [
          { planId: "plan-current", eventSpecId: "spec-current" },
          { planId: " plan-archived ", eventSpecId: " spec-other " }
        ]
      })
    ).toBe("spec-other");
  });
});
