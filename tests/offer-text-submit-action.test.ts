import { describe, expect, it, vi } from "vitest";
import {
  buildOfferTextSubmitAction,
  type OfferTextSubmitActionInput
} from "../backoffice-ui/src/offer-text-submit-action.js";

function input(overrides: Partial<OfferTextSubmitActionInput> = {}): OfferTextSubmitActionInput {
  return {
    createOfferCase: vi.fn(async () => ({ case: { caseId: "offer-case-1" } })),
    createOfferFromText: vi.fn(async () => ({ draftId: "draft-offer-1" })),
    getOrCreateOfferRequestId: vi.fn(() => "request-offer-1"),
    completeOfferRequestId: vi.fn(),
    activeOfferCaseId: undefined,
    setActiveOfferCaseId: vi.fn(),
    offerText: "Business Lunch fuer 35 Personen.",
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    setSelectedDraftId: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("offer text submit action", () => {
  it.each(["", " \n\t "])(
    "rejects blank offer text before creating a case or calling the offer API",
    async (offerText) => {
      const actionInput = input({ offerText });
      const submitOfferText = buildOfferTextSubmitAction(actionInput);

      await submitOfferText();

      expect(actionInput.createOfferCase).not.toHaveBeenCalled();
      expect(actionInput.getOrCreateOfferRequestId).not.toHaveBeenCalled();
      expect(actionInput.createOfferFromText).not.toHaveBeenCalled();
      expect(actionInput.refreshDashboard).not.toHaveBeenCalled();
      expect(actionInput.setError).toHaveBeenCalledWith("Bitte Beschreibung eingeben");
      expect(actionInput.setSubmitting).not.toHaveBeenCalled();
    }
  );

  it("creates an offer draft and focuses the returned draft id", async () => {
    const calls: string[] = [];
    const actionInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      createOfferCase: vi.fn(async () => {
        calls.push("createOfferCase");
        return { case: { caseId: "offer-case-1" } };
      }),
      setActiveOfferCaseId: vi.fn((caseId) => {
        calls.push(`setActiveOfferCaseId:${caseId}`);
      }),
      createOfferFromText: vi.fn(async (caseId, text, requestId) => {
        calls.push(`createOfferFromText:${caseId}:${text}:${requestId}`);
        return { draftId: "draft-offer-1" };
      }),
      setSelectedDraftId: vi.fn((draftId) => {
        calls.push(`setSelectedDraftId:${draftId}`);
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const submitOfferText = buildOfferTextSubmitAction(actionInput);

    await submitOfferText();

    expect(actionInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "createOfferCase",
      "setActiveOfferCaseId:offer-case-1",
      "createOfferFromText:offer-case-1:Business Lunch fuer 35 Personen.:request-offer-1",
      "setSelectedDraftId:draft-offer-1",
      "refreshDashboard",
      "setNotice:Angebotsentwurf wurde erstellt.",
      "setSubmitting:false"
    ]);
  });

  it("continues inside the active offer case", async () => {
    const actionInput = input({ activeOfferCaseId: "offer-case-existing" });
    const submitOfferText = buildOfferTextSubmitAction(actionInput);

    await submitOfferText();

    expect(actionInput.createOfferCase).not.toHaveBeenCalled();
    expect(actionInput.setActiveOfferCaseId).not.toHaveBeenCalled();
    expect(actionInput.createOfferFromText).toHaveBeenCalledWith(
      "offer-case-existing",
      "Business Lunch fuer 35 Personen.",
      "request-offer-1"
    );
  });

  it("keeps the successful path usable when the offer response has no draft id", async () => {
    const actionInput = input({
      createOfferFromText: vi.fn(async () => ({}))
    });
    const submitOfferText = buildOfferTextSubmitAction(actionInput);

    await submitOfferText();

    expect(actionInput.setSelectedDraftId).not.toHaveBeenCalled();
    expect(actionInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionInput.setNotice).toHaveBeenCalledWith("Angebotsentwurf wurde erstellt.");
  });

  it("surfaces offer creation failures and always exits submitting state", async () => {
    const actionInput = input({
      createOfferFromText: vi.fn(async () => {
        throw new Error("Anfrage zu kurz");
      })
    });
    const submitOfferText = buildOfferTextSubmitAction(actionInput);

    await submitOfferText();

    expect(actionInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionInput.setNotice).not.toHaveBeenCalled();
    expect(actionInput.setError).toHaveBeenCalledWith("Anfrage zu kurz");
    expect(actionInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("reuses one staged request id when a lost response is retried in the same case", async () => {
    const createOfferFromText = vi.fn(async (..._args: string[]) => {
      if (createOfferFromText.mock.calls.length === 1) {
        throw new Error("Antwort nach Server-Schreibvorgang verloren");
      }
      return { draftId: "draft-stable-request" };
    });
    const getOrCreateOfferRequestId = vi.fn(() => "request-staged-offer");
    const completeOfferRequestId = vi.fn();
    const actionInput = {
      ...input({ activeOfferCaseId: "offer-case-existing" }),
      createOfferFromText,
      getOrCreateOfferRequestId,
      completeOfferRequestId
    } as OfferTextSubmitActionInput & {
      createOfferFromText: (caseId: string, text: string, requestId: string) => Promise<Record<string, unknown>>;
      getOrCreateOfferRequestId: (text: string) => string;
      completeOfferRequestId: (requestId: string) => void;
    };
    const submitOfferText = (buildOfferTextSubmitAction as (
      value: typeof actionInput
    ) => () => Promise<void>)(actionInput);

    await submitOfferText();
    await submitOfferText();

    expect(getOrCreateOfferRequestId).toHaveBeenCalledTimes(2);
    expect(createOfferFromText).toHaveBeenNthCalledWith(
      1,
      "offer-case-existing",
      "Business Lunch fuer 35 Personen.",
      "request-staged-offer"
    );
    expect(createOfferFromText).toHaveBeenNthCalledWith(
      2,
      "offer-case-existing",
      "Business Lunch fuer 35 Personen.",
      "request-staged-offer"
    );
    expect(completeOfferRequestId).toHaveBeenCalledOnce();
    expect(completeOfferRequestId).toHaveBeenCalledWith("request-staged-offer");
  });
});
