import { describe, expect, it, vi } from "vitest";
import {
  buildOfferTextSubmitAction,
  type OfferTextSubmitActionInput
} from "../backoffice-ui/src/offer-text-submit-action.js";

function input(overrides: Partial<OfferTextSubmitActionInput> = {}): OfferTextSubmitActionInput {
  return {
    createOfferFromText: vi.fn(async () => ({ draftId: "draft-offer-1" })),
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
  it("creates an offer draft and focuses the returned draft id", async () => {
    const calls: string[] = [];
    const actionInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      createOfferFromText: vi.fn(async (text) => {
        calls.push(`createOfferFromText:${text}`);
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
      "createOfferFromText:Business Lunch fuer 35 Personen.",
      "setSelectedDraftId:draft-offer-1",
      "refreshDashboard",
      "setNotice:Angebotsentwurf wurde erstellt.",
      "setSubmitting:false"
    ]);
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
});
