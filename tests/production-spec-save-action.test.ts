import { describe, expect, it, vi } from "vitest";
import {
  buildProductionSpecSaveAction,
  type ProductionSpecSaveActionInput
} from "../backoffice-ui/src/production-spec-save-action.js";

function input(overrides: Partial<ProductionSpecSaveActionInput> = {}): ProductionSpecSaveActionInput {
  return {
    editingSpecId: "spec-edit-1",
    persistCurrentSpecEdit: vi.fn(async () => undefined),
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production spec save action", () => {
  it("quietly exits when no spec is being edited", async () => {
    const actionsInput = input({ editingSpecId: undefined });
    const saveSpecEdit = buildProductionSpecSaveAction(actionsInput);

    await saveSpecEdit();

    expect(actionsInput.persistCurrentSpecEdit).not.toHaveBeenCalled();
    expect(actionsInput.setSubmitting).not.toHaveBeenCalled();
    expect(actionsInput.clearMessages).not.toHaveBeenCalled();
  });

  it("saves the current spec edit and exits submitting state", async () => {
    const calls: string[] = [];
    const actionsInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      persistCurrentSpecEdit: vi.fn(async () => {
        calls.push("persistCurrentSpecEdit");
      })
    });
    const saveSpecEdit = buildProductionSpecSaveAction(actionsInput);

    await saveSpecEdit();

    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "persistCurrentSpecEdit",
      "setSubmitting:false"
    ]);
  });

  it("surfaces save failures and still exits submitting state", async () => {
    const actionsInput = input({
      persistCurrentSpecEdit: vi.fn(async () => {
        throw new Error("Speichern abgelehnt");
      })
    });
    const saveSpecEdit = buildProductionSpecSaveAction(actionsInput);

    await saveSpecEdit();

    expect(actionsInput.setError).toHaveBeenCalledWith("Speichern abgelehnt");
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
