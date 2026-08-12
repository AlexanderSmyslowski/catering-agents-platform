import { describe, expect, it, vi } from "vitest";
import {
  buildProductionTextIntakeSubmitAction,
  type ProductionTextIntakeSubmitInput
} from "../backoffice-ui/src/production-text-intake-submit-action.js";

function input(overrides: Partial<ProductionTextIntakeSubmitInput> = {}): ProductionTextIntakeSubmitInput {
  return {
    createAcceptedSpecFromText: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-text-1" } })),
    intakeText: "Lunch fuer 40 Personen mit Tomatensuppe.",
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    clearMessages: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production text intake submit action", () => {
  it.each(["", " \n\t "])("rejects blank production intake text before calling the write action", async (intakeText) => {
    const actionsInput = input({ intakeText });
    const submitIntakeText = buildProductionTextIntakeSubmitAction(actionsInput);

    await submitIntakeText();

    expect(actionsInput.createAcceptedSpecFromText).not.toHaveBeenCalled();
    expect(actionsInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionsInput.setNotice).not.toHaveBeenCalled();
    expect(actionsInput.setProductionWorkspaceCleared).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Bitte Beschreibung eingeben");
    expect(actionsInput.setSubmitting).not.toHaveBeenCalled();
  });

  it("normalizes intake text and focuses the returned production spec", async () => {
    const calls: string[] = [];
    const actionsInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      createAcceptedSpecFromText: vi.fn(async (text) => {
        calls.push(`createAcceptedSpecFromText:${text}`);
        return { acceptedEventSpec: { specId: "spec-text-1" } };
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const submitIntakeText = buildProductionTextIntakeSubmitAction(actionsInput);

    await submitIntakeText();

    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "setProductionWorkspaceCleared:false",
      "clearMessages",
      "createAcceptedSpecFromText:Lunch fuer 40 Personen mit Tomatensuppe.",
      "setFocusedProductionSpecId:spec-text-1",
      "refreshDashboard",
      "setNotice:Freitext wurde in eine operative Spezifikation überführt.",
      "setSubmitting:false"
    ]);
  });

  it("keeps the successful path usable when the normalize response has no spec id", async () => {
    const actionsInput = input({
      createAcceptedSpecFromText: vi.fn(async () => ({ acceptedEventSpec: {} }))
    });
    const submitIntakeText = buildProductionTextIntakeSubmitAction(actionsInput);

    await submitIntakeText();

    expect(actionsInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionsInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionsInput.setNotice).toHaveBeenCalledWith("Freitext wurde in eine operative Spezifikation überführt.");
  });

  it("surfaces normalization failures and always exits submitting state", async () => {
    const actionsInput = input({
      createAcceptedSpecFromText: vi.fn(async () => {
        throw new Error("Text zu kurz");
      })
    });
    const submitIntakeText = buildProductionTextIntakeSubmitAction(actionsInput);

    await submitIntakeText();

    expect(actionsInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionsInput.setNotice).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Text zu kurz");
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
