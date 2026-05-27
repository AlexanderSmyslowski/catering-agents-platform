import { describe, expect, it, vi } from "vitest";
import {
  resetProductionWorkspace,
  type ProductionWorkspaceResetActions
} from "../backoffice-ui/src/production-workspace-reset.js";

describe("production workspace reset", () => {
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
      "clearUploadInput"
    ]);
  });
});
