import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type OfferDraftPromoteActionInput = {
  promoteOfferDraft: (draftId: string, variantId?: string) => Promise<Record<string, unknown>>;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  setFocusedProductionSpecId?: (specId: string) => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildOfferDraftPromoteAction({
  promoteOfferDraft,
  setSubmitting,
  clearMessages,
  setFocusedProductionSpecId,
  refreshDashboard,
  setNotice,
  setError
}: OfferDraftPromoteActionInput) {
  return async function handlePromoteDraft(draftId: string, variantId?: string) {
    setSubmitting(true);
    clearMessages();
    try {
      const promotedSpec = await promoteOfferDraft(draftId, variantId);
      const promotedSpecId = String(promotedSpec.specId ?? "").trim();
      if (promotedSpecId) {
        setFocusedProductionSpecId?.(promotedSpecId);
      }
      await refreshDashboard();
      setNotice(
        "Angebotsvariante wurde als operative Spezifikation zur Produktionsprüfung übernommen; keine Produktionsfreigabe."
      );
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Angebotsvariante konnte nicht übernommen werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
