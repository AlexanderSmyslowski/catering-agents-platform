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
      setApprovalBinding: (binding: {
        offerDraftId: string;
        approvedOfferId: string;
        handoffId?: string;
        productionDraftId?: string;
      }) => calls.push(`binding:${JSON.stringify(binding)}`),
      openProductionEntry: (draftId: string) => calls.push(`open:${draftId}`),
      setSubmitting: () => undefined,
      clearMessages: () => undefined,
      refreshDashboard: async () => undefined,
      setNotice: () => undefined,
      setError: () => undefined
    } as Parameters<typeof buildOfferApprovalAction>[0] & {
      createProductionDraftFromHandoff: (handoffId: string) => Promise<{ draft: { draftId: string } }>;
      setApprovalBinding: (binding: {
        offerDraftId: string;
        approvedOfferId: string;
        handoffId?: string;
        productionDraftId?: string;
      }) => void;
      openProductionEntry: (draftId: string) => void;
    });

    await action.approve("draft-1", "variant-1");
    expect(calls).toEqual([
      "decision",
      'binding:{"offerDraftId":"draft-1","approvedOfferId":"offer-1"}'
    ]);
    await action.createHandoff("draft-1", "offer-1");
    expect(calls).toEqual([
      "decision",
      'binding:{"offerDraftId":"draft-1","approvedOfferId":"offer-1"}',
      "handoff",
      "production:handoff-1",
      'binding:{"offerDraftId":"draft-1","approvedOfferId":"offer-1","handoffId":"handoff-1","productionDraftId":"production-draft-1"}',
      "open:production-draft-1"
    ]);
  });
});
