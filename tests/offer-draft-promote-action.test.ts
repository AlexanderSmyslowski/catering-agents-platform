import { describe, expect, it, vi } from "vitest";
import {
  buildOfferDraftPromoteAction,
  type OfferDraftPromoteActionInput
} from "../backoffice-ui/src/offer-draft-promote-action.js";

function input(overrides: Partial<OfferDraftPromoteActionInput> = {}): OfferDraftPromoteActionInput {
  return {
    promoteOfferDraft: vi.fn(async () => ({})),
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("offer draft promote action", () => {
  it("promotes a selected draft variant and refreshes dashboard state", async () => {
    const calls: string[] = [];
    const actionInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      promoteOfferDraft: vi.fn(async (draftId, variantId) => {
        calls.push(`promoteOfferDraft:${draftId}:${variantId}`);
        return {};
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const promoteDraft = buildOfferDraftPromoteAction(actionInput);

    await promoteDraft("draft-1", "balanced");

    expect(actionInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "promoteOfferDraft:draft-1:balanced",
      "refreshDashboard",
      "setNotice:Angebotsvariante wurde als operative Spezifikation zur Produktionsprüfung übernommen; keine Produktionsfreigabe.",
      "setSubmitting:false"
    ]);
  });

  it("focuses the promoted spec for the production route before refreshing", async () => {
    const calls: string[] = [];
    const actionInput = input({
      promoteOfferDraft: vi.fn(async () => {
        calls.push("promoteOfferDraft");
        return { specId: " spec-promoted " };
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      })
    });
    const promoteDraft = buildOfferDraftPromoteAction(actionInput);

    await promoteDraft("draft-1", "balanced");

    expect(calls).toEqual([
      "promoteOfferDraft",
      "setFocusedProductionSpecId:spec-promoted",
      "refreshDashboard"
    ]);
  });

  it("passes through an omitted variant id for default promotion", async () => {
    const actionInput = input();
    const promoteDraft = buildOfferDraftPromoteAction(actionInput);

    await promoteDraft("draft-1");

    expect(actionInput.promoteOfferDraft).toHaveBeenCalledWith("draft-1", undefined);
    expect(actionInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionInput.setNotice).toHaveBeenCalledWith(
      "Angebotsvariante wurde als operative Spezifikation zur Produktionsprüfung übernommen; keine Produktionsfreigabe."
    );
  });

  it("surfaces promote failures and always exits submitting state", async () => {
    const actionInput = input({
      promoteOfferDraft: vi.fn(async () => {
        throw new Error("Draft nicht gefunden");
      })
    });
    const promoteDraft = buildOfferDraftPromoteAction(actionInput);

    await promoteDraft("draft-missing");

    expect(actionInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionInput.setNotice).not.toHaveBeenCalled();
    expect(actionInput.setError).toHaveBeenCalledWith("Draft nicht gefunden");
    expect(actionInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
