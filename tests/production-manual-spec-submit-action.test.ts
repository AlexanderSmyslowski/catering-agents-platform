import { describe, expect, it, vi } from "vitest";
import {
  buildProductionManualSpecSubmitAction,
  type ProductionManualSpecSubmitInput
} from "../backoffice-ui/src/production-manual-spec-submit-action.js";

function manualInput() {
  return {
    eventType: "lunch",
    eventDate: "2026-06-15",
    attendeeCount: "40",
    menuItems: "Tomatensuppe"
  };
}

function input(overrides: Partial<ProductionManualSpecSubmitInput> = {}): ProductionManualSpecSubmitInput {
  return {
    createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-manual-1" } })),
    createProductionCase: vi.fn(async () => ({ case: { caseId: "case-manual-1" } })),
    createProductionDraftFromAcceptedEventSpec: vi.fn(async () => ({ draft: { draftId: "draft-manual-1" } })),
    buildCurrentManualSpecInput: vi.fn(() => manualInput()),
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    clearMessages: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    setActiveProductionCaseId: vi.fn(),
    setActiveProductionCaseSpecId: vi.fn(),
    resetManualSpecDraft: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production manual spec submit action", () => {
  it("creates a manual production spec and focuses the returned spec", async () => {
    const calls: string[] = [];
    const currentInput = manualInput();
    const actionsInput = input({
      buildCurrentManualSpecInput: vi.fn(() => {
        calls.push("buildCurrentManualSpecInput");
        return currentInput;
      }),
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      createAcceptedSpecFromManualForm: vi.fn(async () => {
        calls.push("createAcceptedSpecFromManualForm");
        return { acceptedEventSpec: { specId: "spec-manual-1" } };
      }),
      createProductionCase: vi.fn(async () => {
        calls.push("createProductionCase");
        return { case: { caseId: "case-manual-1" } };
      }),
      createProductionDraftFromAcceptedEventSpec: vi.fn(async (caseId, spec) => {
        calls.push(`createProductionDraftFromAcceptedEventSpec:${caseId}:${String(spec.specId)}`);
        return { draft: { draftId: "draft-manual-1" } };
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
      resetManualSpecDraft: vi.fn(() => {
        calls.push("resetManualSpecDraft");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const submitManualSpec = buildProductionManualSpecSubmitAction(actionsInput);

    await submitManualSpec();

    expect(actionsInput.createAcceptedSpecFromManualForm).toHaveBeenCalledWith(currentInput);
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "setProductionWorkspaceCleared:false",
      "clearMessages",
      "buildCurrentManualSpecInput",
      "createAcceptedSpecFromManualForm",
      "createProductionCase",
      "createProductionDraftFromAcceptedEventSpec:case-manual-1:spec-manual-1",
      "setActiveProductionCaseId:case-manual-1",
      "setActiveProductionCaseSpecId:spec-manual-1",
      "setFocusedProductionSpecId:spec-manual-1",
      "resetManualSpecDraft",
      "setNotice:Auftrag angelegt. Bitte Angaben und Planung prüfen.",
      "setSubmitting:false"
    ]);
  });

  it("uses server-confirmed metadata rather than unsaved form values for the new case", async () => {
    const actions = input({ createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: {
      specId: "spec-confirmed", customer: { name: "Synthetischer Kunde" }, event: { type: "trade_fair", date: "2026-11-13" }, servicePlan: { eventType: "trade_fair" }, attendees: { expected: 35 }
    } })) });
    await buildProductionManualSpecSubmitAction(actions)();
    expect(actions.createProductionCase).toHaveBeenCalledWith({ customerName: "Synthetischer Kunde", eventTypeLabel: "Messe", eventDate: "2026-11-13", attendeeCount: 35 });
    expect(actions.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith("case-manual-1", { specId: "spec-confirmed" });
  });
  it("preserves partial and absent confirmed metadata without inventing fields", async () => {
    const actions = input({ createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-partial", event: { type: "Eigene Veranstaltung" }, attendees: { expected: 0 } } })) });
    await buildProductionManualSpecSubmitAction(actions)();
    expect(actions.createProductionCase).toHaveBeenCalledWith({ eventTypeLabel: "Eigene Veranstaltung" });
  });

  it.each([["2024-02-29", true], ["2026-02-29", false], ["2026-02-30", false], ["2026-99-99", false], ["1996-02-29", true], ["0096-02-29", true]])("uses only valid calendar dates from the confirmed spec: %s", async (eventDate, valid) => {
    const actions = input({ createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-date", event: { date: eventDate } } })) });
    await buildProductionManualSpecSubmitAction(actions)();
    expect(actions.createProductionCase).toHaveBeenCalledWith(valid ? { eventDate } : {});
  });

  it("fails closed when the response has no spec id", async () => {
    const actionsInput = input({
      createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: {} }))
    });
    const submitManualSpec = buildProductionManualSpecSubmitAction(actionsInput);

    await submitManualSpec();

    expect(actionsInput.createProductionCase).not.toHaveBeenCalled();
    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).not.toHaveBeenCalled();
    expect(actionsInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionsInput.resetManualSpecDraft).not.toHaveBeenCalled();
    expect(actionsInput.setNotice).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Manuelle Spezifikation enthält keine gültige ID.");
  });

  it("does not expose an unpersisted spec when the Production draft import fails", async () => {
    const actionsInput = input({
      createProductionDraftFromAcceptedEventSpec: vi.fn(async () => {
        throw new Error("Produktionsentwurf konnte nicht gespeichert werden");
      })
    });
    const submitManualSpec = buildProductionManualSpecSubmitAction(actionsInput);

    await submitManualSpec();

    expect(actionsInput.setActiveProductionCaseId).not.toHaveBeenCalled();
    expect(actionsInput.setActiveProductionCaseSpecId).not.toHaveBeenCalled();
    expect(actionsInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionsInput.resetManualSpecDraft).not.toHaveBeenCalled();
    expect(actionsInput.setNotice).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Produktionsentwurf konnte nicht gespeichert werden");
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("surfaces manual spec failures and always exits submitting state", async () => {
    const actionsInput = input({
      createAcceptedSpecFromManualForm: vi.fn(async () => {
        throw new Error("Pflichtfeld fehlt");
      })
    });
    const submitManualSpec = buildProductionManualSpecSubmitAction(actionsInput);

    await submitManualSpec();

    expect(actionsInput.resetManualSpecDraft).not.toHaveBeenCalled();
    expect(actionsInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionsInput.setError).toHaveBeenCalledWith("Pflichtfeld fehlt");
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
