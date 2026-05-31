import { describe, expect, it, vi } from "vitest";
import {
  buildProductionIntakeArchiveAction,
  type ProductionIntakeArchiveActionInput
} from "../backoffice-ui/src/production-intake-archive-action.js";

function input(overrides: Partial<ProductionIntakeArchiveActionInput> = {}): ProductionIntakeArchiveActionInput {
  return {
    archiveIntakeRequest: vi.fn(async () => undefined),
    currentIntakeRequestId: "request-wrong-upload-1",
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    resetProductionWorkspaceState: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production intake archive action", () => {
  it("archives the active intake request as a wrong upload and resets the workspace", async () => {
    const calls: string[] = [];
    const actionsInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      archiveIntakeRequest: vi.fn(async (requestId, reasonCode) => {
        calls.push(`archiveIntakeRequest:${requestId}:${reasonCode}`);
      }),
      resetProductionWorkspaceState: vi.fn(() => {
        calls.push("resetProductionWorkspaceState");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const archiveCurrentIntake = buildProductionIntakeArchiveAction(actionsInput);

    await archiveCurrentIntake();

    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "archiveIntakeRequest:request-wrong-upload-1:wrong_upload",
      "resetProductionWorkspaceState",
      "refreshDashboard",
      "setNotice:Fehlupload request-wrong-upload-1 wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen.",
      "setSubmitting:false"
    ]);
  });

  it("stops before submission when there is no linked intake context", async () => {
    const actionsInput = input({ currentIntakeRequestId: undefined });
    const archiveCurrentIntake = buildProductionIntakeArchiveAction(actionsInput);

    await archiveCurrentIntake();

    expect(actionsInput.setError).toHaveBeenCalledWith("Kein verknüpfter Intake-Kontext zum Archivieren vorhanden.");
    expect(actionsInput.archiveIntakeRequest).not.toHaveBeenCalled();
    expect(actionsInput.setSubmitting).not.toHaveBeenCalled();
    expect(actionsInput.clearMessages).not.toHaveBeenCalled();
  });

  it("surfaces archive failures and always exits submitting state", async () => {
    const actionsInput = input({
      archiveIntakeRequest: vi.fn(async () => {
        throw new Error("Archiv nicht erreichbar");
      })
    });
    const archiveCurrentIntake = buildProductionIntakeArchiveAction(actionsInput);

    await archiveCurrentIntake();

    expect(actionsInput.resetProductionWorkspaceState).not.toHaveBeenCalled();
    expect(actionsInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Archiv nicht erreichbar");
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
