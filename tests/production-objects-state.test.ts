import { describe, expect, it } from "vitest";
import { buildProductionObjectsState } from "../backoffice-ui/src/production-objects-state.js";

describe("production objects state", () => {
  it("maps focused and selected production object values without recomputing behavior", () => {
    const focusedSpec = { specId: "spec-1", eventType: "Lunch" };
    const selectedPlan = { planId: "plan-1", eventSpecId: "spec-1" };
    const selectedPlanSpec = { specId: "spec-1", guestCount: 42 };
    const currentPlan = { planId: "plan-current", eventSpecId: "spec-1" };
    const archivedPlan = { planId: "plan-archived", eventSpecId: "spec-2" };
    const selectedPlanComponentsById = new Map([["component-1", { componentId: "component-1" }]]);
    const specById = new Map([["spec-1", focusedSpec]]);

    const objectsState = buildProductionObjectsState({
      focusedProductionSpec: focusedSpec,
      productionWorkspaceCleared: false,
      currentSpecPlans: [currentPlan],
      selectedPlan,
      selectedPlanSpec,
      selectedPlanComponentsById,
      archivedPlans: [archivedPlan],
      specById
    });

    expect(objectsState.focusedProductionSpec).toBe(focusedSpec);
    expect(objectsState.currentSpecPlans).toEqual([currentPlan]);
    expect(objectsState.selectedPlan).toBe(selectedPlan);
    expect(objectsState.selectedPlanSpec).toBe(selectedPlanSpec);
    expect(objectsState.selectedPlanComponentsById).toBe(selectedPlanComponentsById);
    expect(objectsState.archivedPlans).toEqual([archivedPlan]);
    expect(objectsState.specById).toBe(specById);
  });

  it("keeps cleared workspace state empty without inventing active objects", () => {
    const selectedPlanComponentsById = new Map<string, Record<string, unknown>>();
    const specById = new Map<string, Record<string, unknown>>();

    const objectsState = buildProductionObjectsState({
      productionWorkspaceCleared: true,
      currentSpecPlans: [],
      selectedPlanComponentsById,
      archivedPlans: [],
      specById
    });

    expect(objectsState.productionWorkspaceCleared).toBe(true);
    expect(objectsState.focusedProductionSpec).toBeUndefined();
    expect(objectsState.selectedPlan).toBeUndefined();
    expect(objectsState.selectedPlanSpec).toBeUndefined();
    expect(objectsState.currentSpecPlans).toEqual([]);
    expect(objectsState.selectedPlanComponentsById).toBe(selectedPlanComponentsById);
    expect(objectsState.specById).toBe(specById);
  });
});
