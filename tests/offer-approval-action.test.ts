import { describe, expect, it } from "vitest";
import { buildOfferApprovalAction } from "../backoffice-ui/src/offer-approval-action.js";

describe("offer approval action", () => {
  it("requires approval before a production handoff is created", async () => {
    const calls: string[] = [];
    const action = buildOfferApprovalAction({
      decideOfferDraft: async () => {
        calls.push("decision");
        return { approvedOffer: { approvedOfferId: "offer-1" } };
      },
      createProductionHandoff: async () => {
        calls.push("handoff");
        return { handoff: { handoffId: "handoff-1" } };
      },
      setSubmitting: () => undefined,
      clearMessages: () => undefined,
      refreshDashboard: async () => undefined,
      setNotice: () => undefined,
      setError: () => undefined
    });

    await action.approve("draft-1", "variant-1");
    expect(calls).toEqual(["decision"]);
    await action.createHandoff("offer-1");
    expect(calls).toEqual(["decision", "handoff"]);
  });
});
