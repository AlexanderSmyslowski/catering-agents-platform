import { describe, expect, it, vi } from "vitest";
import {
  buildProductionTextIntakeSubmitAction,
  type ProductionTextIntakeSubmitInput
} from "../backoffice-ui/src/production-text-intake-submit-action.js";

function input(overrides: Partial<ProductionTextIntakeSubmitInput> = {}): ProductionTextIntakeSubmitInput {
  return {
    createAcceptedSpecFromText: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-text-1" } })),
    createProductionCase: vi.fn(async () => ({ case: { caseId: "case-text-1" } })),
    createProductionDraftFromAcceptedEventSpec: vi.fn(async () => ({ draft: { draftId: "draft-text-1" } })),
    intakeText: "Lunch fuer 40 Personen mit Tomatensuppe.",
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    clearMessages: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    setActiveProductionCaseId: vi.fn(),
    setActiveProductionCaseSpecId: vi.fn(),
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
      createProductionCase: vi.fn(async () => {
        calls.push("createProductionCase");
        return { case: { caseId: "case-text-1" } };
      }),
      createProductionDraftFromAcceptedEventSpec: vi.fn(async (caseId, spec) => {
        calls.push(`createProductionDraftFromAcceptedEventSpec:${caseId}:${String(spec.specId)}`);
        return { draft: { draftId: "draft-text-1" } };
      }),
      setActiveProductionCaseId: vi.fn((caseId) => {
        calls.push(`setActiveProductionCaseId:${caseId}`);
      }),
      setActiveProductionCaseSpecId: vi.fn((specId) => {
        calls.push(`setActiveProductionCaseSpecId:${specId}`);
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
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
      "createProductionCase",
      "createProductionDraftFromAcceptedEventSpec:case-text-1:spec-text-1",
      "setActiveProductionCaseId:case-text-1",
      "setActiveProductionCaseSpecId:spec-text-1",
      "setFocusedProductionSpecId:spec-text-1",
      "setNotice:Freitext wurde in eine operative Spezifikation überführt.",
      "setSubmitting:false"
    ]);
  });

  it("fails closed when the normalize response has no spec id", async () => {
    const actionsInput = input({
      createAcceptedSpecFromText: vi.fn(async () => ({ acceptedEventSpec: {} }))
    });
    const submitIntakeText = buildProductionTextIntakeSubmitAction(actionsInput);

    await submitIntakeText();

    expect(actionsInput.createProductionCase).not.toHaveBeenCalled();
    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).not.toHaveBeenCalled();
    expect(actionsInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionsInput.setNotice).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Freitext-Spezifikation enthält keine gültige ID.");
  });

  it("does not expose an unpersisted spec when the Production draft import fails", async () => {
    const actionsInput = input({
      createProductionDraftFromAcceptedEventSpec: vi.fn(async () => {
        throw new Error("Produktionsentwurf konnte nicht gespeichert werden");
      })
    });
    const submitIntakeText = buildProductionTextIntakeSubmitAction(actionsInput);

    await submitIntakeText();

    expect(actionsInput.setActiveProductionCaseId).not.toHaveBeenCalled();
    expect(actionsInput.setActiveProductionCaseSpecId).not.toHaveBeenCalled();
    expect(actionsInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionsInput.setNotice).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Produktionsentwurf konnte nicht gespeichert werden");
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
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
