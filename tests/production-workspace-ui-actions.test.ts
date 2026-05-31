import { describe, expect, it, vi } from "vitest";
import {
  buildProductionWorkspaceUiActions,
  type ProductionWorkspaceUiActionsInput
} from "../backoffice-ui/src/production-workspace-ui-actions.js";

function input(
  overrides: Partial<ProductionWorkspaceUiActionsInput> = {}
): ProductionWorkspaceUiActionsInput {
  return {
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

describe("production workspace UI actions", () => {
  it("clears notice and error messages without touching workspace state", () => {
    const actionInput = input();
    const actions = buildProductionWorkspaceUiActions(actionInput);

    actions.clearMessages();

    expect(actionInput.setError).toHaveBeenCalledWith(undefined);
    expect(actionInput.setNotice).toHaveBeenCalledWith(undefined);
    expect(actionInput.setProductionWorkspaceCleared).not.toHaveBeenCalled();
    expect(actionInput.clearUploadInput).not.toHaveBeenCalled();
  });

  it("resets the active workspace through the existing reset sequence", () => {
    const calls: string[] = [];
    const actionInput = input({
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
    });
    const actions = buildProductionWorkspaceUiActions(actionInput);

    actions.resetProductionWorkspaceState();

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

  it("clears the workspace with message cleanup and the existing operator notice", () => {
    const calls: string[] = [];
    const actionInput = input({
      setError: vi.fn((message) => {
        calls.push(`setError:${String(message)}`);
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${String(message)}`);
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      clearUploadInput: vi.fn(() => {
        calls.push("clearUploadInput");
      })
    });
    const actions = buildProductionWorkspaceUiActions(actionInput);

    actions.clearProductionWorkspace();

    expect(actionInput.setNotice).toHaveBeenLastCalledWith(
      "Aktueller Upload wurde verworfen. Rückfragen und Ergebnisse wurden geleert."
    );
    expect(calls).toEqual([
      "setProductionWorkspaceCleared:true",
      "clearUploadInput",
      "setError:undefined",
      "setNotice:undefined",
      "setNotice:Aktueller Upload wurde verworfen. Rückfragen und Ergebnisse wurden geleert."
    ]);
  });
});
