import { describe, expect, it } from "vitest";
import { buildProductionRouteVisibleArtifacts } from "../backoffice-ui/src/production-route-visible-artifacts.js";

describe("production route visible artifacts", () => {
  it("preserves artifact references while the workspace stays active", () => {
    const currentSpecPlans = [{ planId: "plan-1" }];
    const currentSpecPurchaseLists = [{ purchaseListId: "purchase-1" }];
    const selectedPlan = { planId: "plan-selected" };
    const selectedPlanSpec = { specId: "spec-selected" };
    const selectedPlanComponentsById = new Map([["component-1", { componentId: "component-1" }]]);
    const archivedPlans = [{ planId: "plan-old" }];
    const archivedPurchaseLists = [{ purchaseListId: "purchase-old" }];

    const visibleArtifacts = buildProductionRouteVisibleArtifacts({
      productionWorkspaceCleared: false,
      currentSpecPlans,
      currentSpecPurchaseLists,
      selectedPlan,
      selectedPlanSpec,
      selectedPlanComponentsById,
      archivedPlans,
      archivedPurchaseLists
    });

    expect(visibleArtifacts.currentSpecPlans).toBe(currentSpecPlans);
    expect(visibleArtifacts.currentSpecPurchaseLists).toBe(currentSpecPurchaseLists);
    expect(visibleArtifacts.selectedPlan).toBe(selectedPlan);
    expect(visibleArtifacts.selectedPlanSpec).toBe(selectedPlanSpec);
    expect(visibleArtifacts.selectedPlanComponentsById).toBe(selectedPlanComponentsById);
    expect(visibleArtifacts.archivedPlans).toBe(archivedPlans);
    expect(visibleArtifacts.archivedPurchaseLists).toBe(archivedPurchaseLists);
  });

  it("drops visible artifacts when the workspace was cleared", () => {
    const visibleArtifacts = buildProductionRouteVisibleArtifacts({
      productionWorkspaceCleared: true,
      currentSpecPlans: [{ planId: "plan-stale" }],
      currentSpecPurchaseLists: [{ purchaseListId: "purchase-stale" }],
      selectedPlan: { planId: "plan-selected-stale" },
      selectedPlanSpec: { specId: "spec-selected-stale" },
      selectedPlanComponentsById: new Map([["component-stale", { componentId: "component-stale" }]]),
      archivedPlans: [{ planId: "plan-archived-stale" }],
      archivedPurchaseLists: [{ purchaseListId: "purchase-archived-stale" }]
    });

    expect(visibleArtifacts.currentSpecPlans).toEqual([]);
    expect(visibleArtifacts.currentSpecPurchaseLists).toEqual([]);
    expect(visibleArtifacts.selectedPlan).toBeUndefined();
    expect(visibleArtifacts.selectedPlanSpec).toBeUndefined();
    expect(visibleArtifacts.selectedPlanComponentsById.size).toBe(0);
    expect(visibleArtifacts.archivedPlans).toEqual([]);
    expect(visibleArtifacts.archivedPurchaseLists).toEqual([]);
  });
});
