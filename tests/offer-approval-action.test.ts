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
      createProductionCaseFromHandoff: async (handoffId: string) => {
        calls.push(`production-case:${handoffId}`);
        return { case: { caseId: "production-case-1" } };
      },
      setActiveProductionCaseId: (caseId: string) => calls.push(`active-case:${caseId}`),
      clearActiveOfferCaseId: () => calls.push("clear-offer-case"),
      createProductionDraftFromHandoff: async (caseId: string, handoffId: string) => {
        calls.push(`production:${caseId}:${handoffId}`);
        return { draft: { draftId: "production-draft-1" } };
      },
      setApprovalBinding: (binding: {
        offerDraftId: string;
        offerDraftRevision: number;
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
      createProductionDraftFromHandoff: (caseId: string, handoffId: string) => Promise<{ draft: { draftId: string } }>;
      clearActiveOfferCaseId: () => void;
      setApprovalBinding: (binding: {
        offerDraftId: string;
        offerDraftRevision: number;
        approvedOfferId: string;
        handoffId?: string;
        productionDraftId?: string;
      }) => void;
      openProductionEntry: (draftId: string) => void;
    });

    await action.approve("draft-1", 2, "variant-1");
    expect(calls).toEqual([
      "decision",
      'binding:{"offerDraftId":"draft-1","offerDraftRevision":2,"approvedOfferId":"offer-1"}'
    ]);
    await action.createHandoff("draft-1", 2, "offer-1");
    expect(calls).toEqual([
      "decision",
      'binding:{"offerDraftId":"draft-1","offerDraftRevision":2,"approvedOfferId":"offer-1"}',
      "handoff",
      "production-case:handoff-1",
      "active-case:production-case-1",
      "production:production-case-1:handoff-1",
      'binding:{"offerDraftId":"draft-1","offerDraftRevision":2,"approvedOfferId":"offer-1","handoffId":"handoff-1","productionDraftId":"production-draft-1"}',
      "clear-offer-case",
      "open:production-draft-1"
    ]);
  });

  it("keeps the active offer case when the handoff flow fails and can be retried", async () => {
    const calls: string[] = [];
    const action = buildOfferApprovalAction({
      decideOfferDraft: async () => ({ approvedOffer: { approvedOfferId: "offer-1" } }),
      createProductionHandoff: async () => ({ handoff: { handoffId: "handoff-1" } }),
      createProductionCaseFromHandoff: async () => ({ case: { caseId: "production-case-1" } }),
      createProductionDraftFromHandoff: async () => {
        throw new Error("Produktion vorübergehend nicht erreichbar");
      },
      setActiveProductionCaseId: () => undefined,
      clearActiveOfferCaseId: () => calls.push("clear-offer-case"),
      setSubmitting: () => undefined,
      clearMessages: () => undefined,
      refreshDashboard: async () => undefined,
      setNotice: () => undefined,
      setError: (message: string) => calls.push(`error:${message}`),
      openProductionEntry: () => undefined
    } as Parameters<typeof buildOfferApprovalAction>[0] & { clearActiveOfferCaseId: () => void });

    await action.createHandoff("draft-1", 1, "offer-1");

    expect(calls).toEqual(["error:Produktion vorübergehend nicht erreichbar"]);
  });
});
