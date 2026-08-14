import { formatSubmitErrorMessage } from "./submit-error-message.js";
import { productionDraftIdForHandoff } from "./production-entry-focus.js";
import type { ApprovedOffer, ProductionHandoff } from "@catering/shared-core";

export type OfferApprovalBinding = {
  offerDraftId: string;
  offerDraftRevision: number;
  approvedOfferId: string;
  handoffId?: string;
  productionDraftId?: string;
};

/** Project the complete persisted approval/handoff records into the browser
 * action contract. The source draft remains the authority after a reload. */
export function buildOfferApprovalBinding(
  approvedOffer?: Pick<ApprovedOffer, "approvedOfferId" | "sourceDraft">,
  handoff?: Pick<ProductionHandoff, "handoffId" | "source" | "approvedOfferId">
): OfferApprovalBinding | undefined {
  const source = approvedOffer?.sourceDraft ?? handoff?.source;
  const approvedOfferId = approvedOffer?.approvedOfferId ?? handoff?.approvedOfferId;
  if (!source || !approvedOfferId || !source.draftId || !Number.isInteger(source.revision) || source.revision < 1) {
    return undefined;
  }
  if (approvedOffer && handoff && (
    approvedOffer.approvedOfferId !== handoff.approvedOfferId ||
    approvedOffer.sourceDraft.draftId !== handoff.source.draftId ||
    approvedOffer.sourceDraft.revision !== handoff.source.revision
  )) {
    return undefined;
  }
  return {
    offerDraftId: source.draftId,
    offerDraftRevision: source.revision,
    approvedOfferId,
    ...(handoff?.handoffId ? { handoffId: handoff.handoffId } : {}),
    ...(handoff?.handoffId ? { productionDraftId: productionDraftIdForHandoff(handoff.handoffId) } : {})
  };
}

export type OfferApprovalActionInput = {
  decideOfferDraft: (draftId: string, revision: number, variantId: string) => Promise<{ approvedOffer?: { approvedOfferId: string } }>;
  createProductionHandoff: (approvedOfferId: string) => Promise<{ handoff?: { handoffId: string } }>;
  createProductionCaseFromHandoff: (handoffId: string) => Promise<{ case: { caseId: string } }>;
  createProductionDraftFromHandoff: (caseId: string, handoffId: string) => Promise<{ draft?: { draftId: string } }>;
  setActiveProductionCaseId: (caseId: string) => void;
  clearActiveOfferCaseId: () => void;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
  setApprovalBinding?: (binding: OfferApprovalBinding) => void;
  openProductionEntry: (draftId: string) => void;
};

export function buildOfferApprovalAction(input: OfferApprovalActionInput) {
  const run = async (work: () => Promise<void>, fallback: string) => {
    input.setSubmitting(true); input.clearMessages();
    try { await work(); await input.refreshDashboard(); }
    catch (error) { input.setError(formatSubmitErrorMessage(error, fallback)); }
    finally { input.setSubmitting(false); }
  };
  return {
    approve: async (draftId: string, revision: number, variantId: string) => run(async () => {
      const result = await input.decideOfferDraft(draftId, revision, variantId);
      if (!result.approvedOffer?.approvedOfferId) throw new Error("Freigegebenes Angebot fehlt.");
      input.setApprovalBinding?.({
        offerDraftId: draftId,
        offerDraftRevision: revision,
        approvedOfferId: result.approvedOffer.approvedOfferId
      });
      input.setNotice("Angebotsvariante wurde freigegeben.");
    }, "Angebotsvariante konnte nicht freigegeben werden."),
    createHandoff: async (offerDraftId: string, offerDraftRevision: number, approvedOfferId: string) => run(async () => {
      const result = await input.createProductionHandoff(approvedOfferId);
      if (!result.handoff?.handoffId) throw new Error("Produktionsübergabe fehlt.");
      const productionCase = await input.createProductionCaseFromHandoff(result.handoff.handoffId);
      input.setActiveProductionCaseId(productionCase.case.caseId);
      const productionResult = await input.createProductionDraftFromHandoff(
        productionCase.case.caseId,
        result.handoff.handoffId
      );
      if (!productionResult.draft?.draftId) throw new Error("Produktionsentwurf fehlt.");
      input.setApprovalBinding?.({
        offerDraftId,
        offerDraftRevision,
        approvedOfferId,
        handoffId: result.handoff.handoffId,
        productionDraftId: productionResult.draft.draftId
      });
      input.clearActiveOfferCaseId();
      input.setNotice("Freigegebenes Angebot wurde an die Produktion übergeben.");
      input.openProductionEntry(productionResult.draft.draftId);
    }, "Produktionsübergabe konnte nicht erstellt werden.")
  };
}
