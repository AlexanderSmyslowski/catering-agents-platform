import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type OfferApprovalActionInput = {
  decideOfferDraft: (draftId: string, variantId: string) => Promise<{ approvedOffer?: { approvedOfferId: string } }>;
  createProductionHandoff: (approvedOfferId: string) => Promise<{ handoff?: { handoffId: string } }>;
  createProductionDraftFromHandoff: (handoffId: string) => Promise<{ draft?: { draftId: string } }>;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
  setApprovedOfferId?: (approvedOfferId: string) => void;
  setHandoffId?: (handoffId: string) => void;
  setProductionDraftId?: (draftId: string) => void;
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
    approve: async (draftId: string, variantId: string) => run(async () => {
      const result = await input.decideOfferDraft(draftId, variantId);
      if (!result.approvedOffer?.approvedOfferId) throw new Error("Freigegebenes Angebot fehlt.");
      input.setApprovedOfferId?.(result.approvedOffer.approvedOfferId);
      input.setNotice("Angebotsvariante wurde freigegeben.");
    }, "Angebotsvariante konnte nicht freigegeben werden."),
    createHandoff: async (approvedOfferId: string) => run(async () => {
      const result = await input.createProductionHandoff(approvedOfferId);
      if (!result.handoff?.handoffId) throw new Error("Produktionsübergabe fehlt.");
      input.setHandoffId?.(result.handoff.handoffId);
      const productionResult = await input.createProductionDraftFromHandoff(result.handoff.handoffId);
      if (!productionResult.draft?.draftId) throw new Error("Produktionsentwurf fehlt.");
      input.setProductionDraftId?.(productionResult.draft.draftId);
      input.setNotice("Freigegebenes Angebot wurde an die Produktion übergeben.");
      input.openProductionEntry(productionResult.draft.draftId);
    }, "Produktionsübergabe konnte nicht erstellt werden.")
  };
}
