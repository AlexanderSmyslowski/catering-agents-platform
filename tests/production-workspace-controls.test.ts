import { describe, expect, it, vi } from "vitest";
import {
  buildProductionWorkspaceControls,
  type ProductionWorkspaceControlsInput
} from "../backoffice-ui/src/production-workspace-controls.js";

function input(
  overrides: Partial<ProductionWorkspaceControlsInput> = {}
): ProductionWorkspaceControlsInput {
  return {
    hasFocusedProductionSpec: false,
    hasSelectedPlan: false,
    hasIntakeFile: false,
    hasActiveDocumentName: false,
    documentPhase: "idle",
    planPhase: "idle",
    hasFocusedProductionSpecId: false,
    hasSelectedPlanId: false,
    currentIntakeRequestId: undefined,
    productionWorkspaceCleared: false,
    archiveIntakeRequest: vi.fn(async () => undefined),
    setSubmitting: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setError: vi.fn(),
    setNotice: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    resetIntakeDraft: vi.fn(),
    resetDocumentProgress: vi.fn(),
    clearFocusedProductionSpecId: vi.fn(),
    clearSelectedPlanId: vi.fn(),
    resetPlanProgress: vi.fn(),
    resetIntakeRequestDetail: vi.fn(),
    resetSpecEdit: vi.fn(),
    clearUploadInput: vi.fn(),
    ...overrides
  };
}

describe("production workspace controls", () => {
  it("builds clear/archive state and keeps archive disabled for idle workspace", () => {
    const controls = buildProductionWorkspaceControls(input());

    expect(controls.canClearProductionWorkspace).toBe(false);
    expect(controls.canArchiveCurrentIntake).toBe(false);
  });

  it("clears the local workspace through the existing reset and notice path", () => {
    const calls: string[] = [];
    const controlsInput = input({
      hasSelectedPlan: true,
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      clearUploadInput: vi.fn(() => {
        calls.push("clearUploadInput");
      }),
      setError: vi.fn((message) => {
        calls.push(`setError:${String(message)}`);
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${String(message)}`);
      })
    });

    const controls = buildProductionWorkspaceControls(controlsInput);
    controls.clearProductionWorkspace();

    expect(controls.canClearProductionWorkspace).toBe(true);
    expect(calls).toEqual([
      "setProductionWorkspaceCleared:true",
      "clearUploadInput",
      "setError:undefined",
      "setNotice:undefined",
      "setNotice:Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert."
    ]);
  });

  it("archives the linked intake context through the existing soft-archive handler", async () => {
    const calls: string[] = [];
    const controlsInput = input({
      currentIntakeRequestId: "request-wrong-upload-1",
      archiveIntakeRequest: vi.fn(async (requestId, reasonCode) => {
        calls.push(`archiveIntakeRequest:${requestId}:${reasonCode}`);
      }),
      resetIntakeDraft: vi.fn(() => {
        calls.push("resetIntakeDraft");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${String(message)}`);
      })
    });

    const controls = buildProductionWorkspaceControls(controlsInput);
    await controls.handleArchiveCurrentIntake();

    expect(controls.canArchiveCurrentIntake).toBe(true);
    expect(calls).toEqual([
      "setNotice:undefined",
      "archiveIntakeRequest:request-wrong-upload-1:wrong_upload",
      "resetIntakeDraft",
      "refreshDashboard",
      "setNotice:Fehlupload wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
    ]);
  });
});
