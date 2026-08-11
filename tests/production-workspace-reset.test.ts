import { describe, expect, it, vi } from "vitest";
import {
  clearProductionWorkspaceState,
  completeProductionIntakeArchiveSuccess,
  resetProductionWorkspace,
  type ProductionIntakeArchiveSuccessActions,
  type ProductionWorkspaceClearActions,
  type ProductionWorkspaceResetActions
} from "../backoffice-ui/src/production-workspace-reset.js";

describe("production workspace reset", () => {
  it("clears the workspace with reset, message cleanup and the existing operator notice", () => {
    const calls: string[] = [];
    const actions: ProductionWorkspaceClearActions = {
      resetProductionWorkspaceState: vi.fn(() => {
        calls.push("resetProductionWorkspaceState");
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    };

    clearProductionWorkspaceState(actions);

    expect(actions.setNotice).toHaveBeenCalledWith(
      "Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert."
    );
    expect(calls).toEqual([
      "resetProductionWorkspaceState",
      "clearMessages",
      "setNotice:Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert."
    ]);
  });

  it("completes a soft-archived intake by resetting the workspace before refreshing and announcing it", async () => {
    const calls: string[] = [];
    const actions: ProductionIntakeArchiveSuccessActions = {
      resetProductionWorkspaceState: vi.fn(() => {
        calls.push("resetProductionWorkspaceState");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    };

    await completeProductionIntakeArchiveSuccess(actions);

    expect(actions.setNotice).toHaveBeenCalledWith(
      "Fehlupload wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
    );
    expect(calls).toEqual([
      "resetProductionWorkspaceState",
      "refreshDashboard",
      "setNotice:Fehlupload wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
    ]);
  });

  it("clears the active production workspace and upload input in the existing reset order", () => {
    const calls: string[] = [];
    const actions: ProductionWorkspaceResetActions = {
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      resetIntakeDraft: vi.fn(() => {
        calls.push("resetIntakeDraft");
      }),
      resetDocumentProgress: vi.fn(() => {
        calls.push("resetDocumentProgress");
      }),
      clearFocusedProductionSpecId: vi.fn(() => {
        calls.push("clearFocusedProductionSpecId");
      }),
      clearSelectedPlanId: vi.fn(() => {
        calls.push("clearSelectedPlanId");
      }),
      resetPlanProgress: vi.fn(() => {
        calls.push("resetPlanProgress");
      }),
      resetIntakeRequestDetail: vi.fn(() => {
        calls.push("resetIntakeRequestDetail");
      }),
      resetSpecEdit: vi.fn((markDismissed) => {
        calls.push(`resetSpecEdit:${markDismissed}`);
      }),
      clearActiveProductionCaseId: vi.fn(() => {
        calls.push("clearActiveProductionCaseId");
      }),
      clearUploadInput: vi.fn(() => {
        calls.push("clearUploadInput");
      })
    };

    resetProductionWorkspace(actions);

    expect(actions.setProductionWorkspaceCleared).toHaveBeenCalledWith(true);
    expect(actions.resetSpecEdit).toHaveBeenCalledWith(false);
    expect(actions.clearUploadInput).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      "setProductionWorkspaceCleared:true",
      "resetIntakeDraft",
      "resetDocumentProgress",
      "clearFocusedProductionSpecId",
      "clearSelectedPlanId",
      "resetPlanProgress",
      "resetIntakeRequestDetail",
      "resetSpecEdit:false",
      "clearActiveProductionCaseId",
      "clearUploadInput"
    ]);
  });
});
