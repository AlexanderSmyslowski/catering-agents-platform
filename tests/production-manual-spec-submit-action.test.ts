import { describe, expect, it, vi } from "vitest";
import {
  buildProductionManualSpecSubmitAction,
  type ProductionManualSpecSubmitInput
} from "../backoffice-ui/src/production-manual-spec-submit-action.js";

function manualInput() {
  return {
    eventType: "lunch",
    eventDate: "2026-06-15",
    attendeeCount: "40",
    menuItems: "Tomatensuppe"
  };
}

function input(overrides: Partial<ProductionManualSpecSubmitInput> = {}): ProductionManualSpecSubmitInput {
  return {
    createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-manual-1" } })),
    buildCurrentManualSpecInput: vi.fn(() => manualInput()),
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    clearMessages: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    resetManualSpecDraft: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production manual spec submit action", () => {
  it("creates a manual production spec and focuses the returned spec", async () => {
    const calls: string[] = [];
    const currentInput = manualInput();
    const actionsInput = input({
      buildCurrentManualSpecInput: vi.fn(() => {
        calls.push("buildCurrentManualSpecInput");
        return currentInput;
      }),
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      createAcceptedSpecFromManualForm: vi.fn(async () => {
        calls.push("createAcceptedSpecFromManualForm");
        return { acceptedEventSpec: { specId: "spec-manual-1" } };
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
      }),
      resetManualSpecDraft: vi.fn(() => {
        calls.push("resetManualSpecDraft");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const submitManualSpec = buildProductionManualSpecSubmitAction(actionsInput);

    await submitManualSpec();

    expect(actionsInput.createAcceptedSpecFromManualForm).toHaveBeenCalledWith(currentInput);
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "setProductionWorkspaceCleared:false",
      "clearMessages",
      "buildCurrentManualSpecInput",
      "createAcceptedSpecFromManualForm",
      "setFocusedProductionSpecId:spec-manual-1",
      "resetManualSpecDraft",
      "refreshDashboard",
      "setNotice:Manuelle Spezifikation wurde angelegt.",
      "setSubmitting:false"
    ]);
  });

  it("keeps the successful path usable even when the response has no spec id", async () => {
    const actionsInput = input({
      createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: {} }))
    });
    const submitManualSpec = buildProductionManualSpecSubmitAction(actionsInput);

    await submitManualSpec();

    expect(actionsInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionsInput.resetManualSpecDraft).toHaveBeenCalledTimes(1);
    expect(actionsInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionsInput.setNotice).toHaveBeenCalledWith("Manuelle Spezifikation wurde angelegt.");
  });

  it("surfaces manual spec failures and always exits submitting state", async () => {
    const actionsInput = input({
      createAcceptedSpecFromManualForm: vi.fn(async () => {
        throw new Error("Pflichtfeld fehlt");
      })
    });
    const submitManualSpec = buildProductionManualSpecSubmitAction(actionsInput);

    await submitManualSpec();

    expect(actionsInput.resetManualSpecDraft).not.toHaveBeenCalled();
    expect(actionsInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Pflichtfeld fehlt");
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
