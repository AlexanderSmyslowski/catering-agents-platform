import { describe, expect, it, vi } from "vitest";
import {
  resetProductionStateAfterDocumentFailure,
  type ProductionDocumentFailureResetActions
} from "../backoffice-ui/src/production-document-failure-reset.js";

describe("production document failure reset", () => {
  it("clears stale production context while keeping the failed file in the retryable intake draft", () => {
    const calls: string[] = [];
    const file = new File(["falsches angebot"], "falsches-angebot.txt", { type: "text/plain" });
    const actions: ProductionDocumentFailureResetActions = {
      failIncomingProductionFile: vi.fn((receivedFile) => {
        calls.push(`failIncomingProductionFile:${receivedFile.name}`);
      }),
      failDocumentProgress: vi.fn(() => {
        calls.push("failDocumentProgress");
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
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
      })
    };

    resetProductionStateAfterDocumentFailure(file, actions);

    expect(actions.failIncomingProductionFile).toHaveBeenCalledWith(file);
    expect(actions.setProductionWorkspaceCleared).toHaveBeenCalledWith(true);
    expect(actions.resetSpecEdit).toHaveBeenCalledWith(false);
    expect(calls).toEqual([
      "failIncomingProductionFile:falsches-angebot.txt",
      "failDocumentProgress",
      "setProductionWorkspaceCleared:true",
      "clearFocusedProductionSpecId",
      "clearSelectedPlanId",
      "resetPlanProgress",
      "resetIntakeRequestDetail",
      "resetSpecEdit:false"
    ]);
  });
});
