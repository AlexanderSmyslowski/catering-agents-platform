import { describe, expect, it } from "vitest";
import { buildProductionSelectedPlanState } from "../backoffice-ui/src/production-selected-plan-state.js";

describe("production selected plan state", () => {
  const currentSpecPlans = [
    { planId: "plan-current-selected", eventSpecId: "spec-current" },
    { planId: "plan-current-first", eventSpecId: "spec-current" }
  ];
  const orderedPlans = [
    { planId: "plan-other-selected", eventSpecId: "spec-other" },
    ...currentSpecPlans,
    { planId: "plan-unscoped", eventSpecId: "spec-archived" }
  ];
  const currentSpec = {
    specId: "spec-current",
    menuPlan: [
      { componentId: "component-main", label: "Main" },
      { componentId: "component-dessert", label: "Dessert" }
    ]
  };
  const otherSpec = {
    specId: "spec-other",
    menuPlan: [{ componentId: "component-other", label: "Other" }]
  };
  const specById = new Map<string, Record<string, unknown>>([
    ["spec-current", currentSpec],
    ["spec-other", otherSpec]
  ]);

  it("selects the requested plan and resolves its spec and component map", () => {
    const state = buildProductionSelectedPlanState({
      currentProductionSpecId: "spec-current",
      currentSpecPlans,
      orderedPlans,
      productionWorkspaceCleared: false,
      selectedPlanId: " plan-current-selected ",
      specById
    });

    expect(state.selectedPlan).toBe(currentSpecPlans[0]);
    expect(state.selectedPlanSpec).toBe(currentSpec);
    expect([...state.selectedPlanComponentsById.keys()]).toEqual([
      "component-main",
      "component-dessert"
    ]);
  });

  it("normalizes selected plan IDs and selected plan spec IDs before resolving state", () => {
    const spacedCurrentPlan = { planId: " plan-current-spaced ", eventSpecId: " spec-current " };
    const state = buildProductionSelectedPlanState({
      currentProductionSpecId: "spec-current",
      currentSpecPlans: [spacedCurrentPlan],
      orderedPlans: [orderedPlans[0], spacedCurrentPlan],
      productionWorkspaceCleared: false,
      selectedPlanId: "plan-current-spaced",
      specById
    });

    expect(state.selectedPlan).toBe(spacedCurrentPlan);
    expect(state.selectedPlanSpec).toBe(currentSpec);
    expect([...state.selectedPlanComponentsById.keys()]).toEqual([
      "component-main",
      "component-dessert"
    ]);
  });

  it("keeps existing selected-plan fallback priority", () => {
    expect(
      buildProductionSelectedPlanState({
        currentProductionSpecId: "spec-current",
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared: false,
        selectedPlanId: "plan-other-selected",
        specById
      }).selectedPlan
    ).toBe(orderedPlans[0]);

    expect(
      buildProductionSelectedPlanState({
        currentProductionSpecId: "spec-current",
        currentSpecPlans,
        orderedPlans,
        productionWorkspaceCleared: false,
        selectedPlanId: undefined,
        specById
      }).selectedPlan
    ).toBe(currentSpecPlans[0]);
  });

  it("clears selected plan state when the production workspace is cleared", () => {
    const state = buildProductionSelectedPlanState({
      currentProductionSpecId: "spec-current",
      currentSpecPlans,
      orderedPlans,
      productionWorkspaceCleared: true,
      selectedPlanId: "plan-current-selected",
      specById
    });

    expect(state.selectedPlan).toBeUndefined();
    expect(state.selectedPlanSpec).toBeUndefined();
    expect(state.selectedPlanComponentsById.size).toBe(0);
  });
});
