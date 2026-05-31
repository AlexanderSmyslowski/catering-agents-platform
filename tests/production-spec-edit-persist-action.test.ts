import { describe, expect, it, vi } from "vitest";
import {
  buildProductionSpecEditPersistAction,
  type ProductionSpecEditPersistActionInput
} from "../backoffice-ui/src/production-spec-edit-persist-action.js";

function input(
  overrides: Partial<ProductionSpecEditPersistActionInput> = {}
): ProductionSpecEditPersistActionInput {
  return {
    editingSpecId: "spec-lunch",
    updateAcceptedSpec: vi.fn(async () => ({
      acceptedEventSpec: { specId: "spec-lunch-updated", eventType: "Lunch" }
    })),
    buildCurrentSpecUpdateInput: vi.fn(() => ({ attendeeCount: 42 })),
    setProductionWorkspaceCleared: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    resetSpecEdit: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    ...overrides
  };
}

describe("production spec edit persist action", () => {
  it("returns undefined without touching the API when no spec edit is active", async () => {
    const actionInput = input({ editingSpecId: undefined });
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await expect(persistCurrentSpecEdit()).resolves.toBeUndefined();

    expect(actionInput.buildCurrentSpecUpdateInput).not.toHaveBeenCalled();
    expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
    expect(actionInput.refreshDashboard).not.toHaveBeenCalled();
  });

  it("persists the current update input and focuses the returned spec", async () => {
    const calls: string[] = [];
    const updatedSpec = { specId: "spec-returned", eventType: "Dinner" };
    const actionInput = input({
      updateAcceptedSpec: vi.fn(async () => {
        calls.push("updateAcceptedSpec");
        return { acceptedEventSpec: updatedSpec };
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
      }),
      resetSpecEdit: vi.fn((markDismissed) => {
        calls.push(`resetSpecEdit:${markDismissed}`);
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await expect(persistCurrentSpecEdit()).resolves.toBe(updatedSpec);

    expect(actionInput.updateAcceptedSpec).toHaveBeenCalledWith("spec-lunch", { attendeeCount: 42 });
    expect(calls).toEqual([
      "updateAcceptedSpec",
      "setProductionWorkspaceCleared:false",
      "setFocusedProductionSpecId:spec-returned",
      "resetSpecEdit:false",
      "refreshDashboard",
      "setNotice:Spezifikation wurde gespeichert."
    ]);
  });

  it("keeps the existing quiet save path silent after refresh", async () => {
    const actionInput = input();
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await persistCurrentSpecEdit({ quiet: true });

    expect(actionInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionInput.setNotice).not.toHaveBeenCalled();
  });

  it("falls back to the edited spec id when the API response has no spec id", async () => {
    const actionInput = input({
      updateAcceptedSpec: vi.fn(async () => ({
        acceptedEventSpec: { eventType: "Lunch ohne ID" }
      }))
    });
    const persistCurrentSpecEdit = buildProductionSpecEditPersistAction(actionInput);

    await persistCurrentSpecEdit();

    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-lunch");
  });
});
