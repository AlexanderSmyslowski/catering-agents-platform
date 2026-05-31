import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type OfferDraftPromoteActionInput = {
  promoteOfferDraft: (draftId: string, variantId?: string) => Promise<Record<string, unknown>>;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildOfferDraftPromoteAction({
  promoteOfferDraft,
  setSubmitting,
  clearMessages,
  refreshDashboard,
  setNotice,
  setError
}: OfferDraftPromoteActionInput) {
  return async function handlePromoteDraft(draftId: string, variantId?: string) {
    setSubmitting(true);
    clearMessages();
    try {
      await promoteOfferDraft(draftId, variantId);
      await refreshDashboard();
      setNotice("Angebotsvariante wurde als operative Spezifikation übernommen.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Angebotsvariante konnte nicht übernommen werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
