import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type OfferTextSubmitActionInput = {
  createOfferFromText: (text: string) => Promise<Record<string, unknown>>;
  offerText: string;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  setSelectedDraftId: (draftId: string) => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildOfferTextSubmitAction({
  createOfferFromText,
  offerText,
  setSubmitting,
  clearMessages,
  setSelectedDraftId,
  refreshDashboard,
  setNotice,
  setError
}: OfferTextSubmitActionInput) {
  return async function handleOfferSubmit() {
    setSubmitting(true);
    clearMessages();
    try {
      const response = await createOfferFromText(offerText);
      const createdDraftId = typeof response.draftId === "string" ? response.draftId : undefined;
      if (createdDraftId) {
        setSelectedDraftId(createdDraftId);
      }
      await refreshDashboard();
      setNotice("Angebotsentwurf wurde erstellt.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Angebotsentwurf konnte nicht erstellt werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
