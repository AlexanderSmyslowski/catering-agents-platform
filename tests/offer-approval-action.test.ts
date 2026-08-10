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
      createProductionDraftFromHandoff: async (handoffId: string) => {
        calls.push(`production:${handoffId}`);
        return { draft: { draftId: "production-draft-1" } };
      },
      setHandoffId: (handoffId: string) => calls.push(`handoffId:${handoffId}`),
      openProductionEntry: (draftId: string) => calls.push(`open:${draftId}`),
      setSubmitting: () => undefined,
      clearMessages: () => undefined,
      refreshDashboard: async () => undefined,
      setNotice: () => undefined,
      setError: () => undefined
    } as Parameters<typeof buildOfferApprovalAction>[0] & {
      createProductionDraftFromHandoff: (handoffId: string) => Promise<{ draft: { draftId: string } }>;
      setHandoffId: (handoffId: string) => void;
      openProductionEntry: (draftId: string) => void;
    });

    await action.approve("draft-1", "variant-1");
    expect(calls).toEqual(["decision"]);
    await action.createHandoff("offer-1");
    expect(calls).toEqual([
      "decision",
      "handoff",
      "handoffId:handoff-1",
      "production:handoff-1",
      "open:production-draft-1"
    ]);
  });
});
