import { describe, expect, it, vi } from "vitest";
import {
  buildProductionPlanningControls,
  type ProductionPlanningControlsInput
} from "../backoffice-ui/src/production-planning-controls.js";

function input(
  overrides: Partial<ProductionPlanningControlsInput> = {}
): ProductionPlanningControlsInput {
  return {
    editingSpecId: "spec-plan-submit-1",
    updateAcceptedSpec: vi.fn(async () => ({
      acceptedEventSpec: {
        specId: "spec-plan-submit-1",
        event: { type: "lunch", date: "2026-06-30" },
        attendees: { expected: 40 }
      }
    })),
    buildCurrentSpecUpdateInput: vi.fn(() => ({ attendeeCount: 40 })),
    loadSpecIntoEditorState: vi.fn(() => "spec-plan-submit-1"),
    createProductionPlan: vi.fn(async () => ({ productionPlan: { planId: "plan-created-1" } })),
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    resetSpecEdit: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    clearMessages: vi.fn(),
    startPlanProgress: vi.fn(),
    clearSelectedPlanId: vi.fn(),
    setSelectedPlanId: vi.fn(),
    completePlanProgress: vi.fn(),
    failPlanProgress: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

const spec = {
  specId: "spec-plan-submit-1",
  event: { type: "lunch", date: "2026-06-30" },
  attendees: { expected: 40 }
};

describe("production planning controls", () => {
  it("keeps spec focus, save, and plan actions behind one App boundary", () => {
    const actionInput = input();
    const controls = buildProductionPlanningControls(actionInput);

    controls.beginSpecEdit(spec);
    controls.openSpecForQuestions("spec-questions");

    expect(actionInput.loadSpecIntoEditorState).toHaveBeenCalledWith(spec);
    expect(actionInput.setProductionWorkspaceCleared).toHaveBeenCalledWith(false);
    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-plan-submit-1");
    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-questions");
  });

  it("saves the current spec edit through the existing persist path", async () => {
    const calls: string[] = [];
    const actionInput = input({
      updateAcceptedSpec: vi.fn(async () => {
        calls.push("updateAcceptedSpec");
        return { acceptedEventSpec: spec };
      }),
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      })
    });
    const controls = buildProductionPlanningControls(actionInput);

    await controls.handleSaveSpecEdit();

    expect(actionInput.updateAcceptedSpec).toHaveBeenCalledWith("spec-plan-submit-1", { attendeeCount: 40 });
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "updateAcceptedSpec",
      "refreshDashboard",
      "setSubmitting:false"
    ]);
  });

  it("creates a production plan through the existing edited-spec preflight", async () => {
    const actionInput = input();
    const controls = buildProductionPlanningControls(actionInput);

    await controls.handleCreatePlan(spec);

    expect(actionInput.updateAcceptedSpec).toHaveBeenCalledWith("spec-plan-submit-1", { attendeeCount: 40 });
    expect(actionInput.createProductionPlan).toHaveBeenCalledWith(spec);
    expect(actionInput.setSelectedPlanId).toHaveBeenCalledWith("plan-created-1");
    expect(actionInput.completePlanProgress).toHaveBeenCalledTimes(1);
    expect(actionInput.failPlanProgress).not.toHaveBeenCalled();
  });
});
