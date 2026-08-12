import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type OfferTextSubmitActionInput = {
  createOfferCase: (input?: Record<string, never>) => Promise<{ case: { caseId: string } }>;
  createOfferFromText: (caseId: string, text: string, requestId: string) => Promise<Record<string, unknown>>;
  getOrCreateOfferRequestId: (text: string) => string;
  completeOfferRequestId: (requestId: string) => void;
  activeOfferCaseId?: string;
  setActiveOfferCaseId: (caseId: string) => void;
  offerText: string;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  setSelectedDraftId: (draftId: string) => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildOfferTextSubmitAction({
  createOfferCase,
  createOfferFromText,
  getOrCreateOfferRequestId,
  completeOfferRequestId,
  activeOfferCaseId,
  setActiveOfferCaseId,
  offerText,
  setSubmitting,
  clearMessages,
  setSelectedDraftId,
  refreshDashboard,
  setNotice,
  setError
}: OfferTextSubmitActionInput) {
  return async function handleOfferSubmit() {
    if (!offerText.trim()) {
      setError("Bitte Beschreibung eingeben");
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      const requestId = getOrCreateOfferRequestId(offerText);
      const caseId = activeOfferCaseId ?? (await createOfferCase({})).case.caseId;
      if (!activeOfferCaseId) {
        setActiveOfferCaseId(caseId);
      }
      const response = await createOfferFromText(caseId, offerText, requestId);
      const createdDraftId = typeof response.draftId === "string" ? response.draftId : undefined;
      if (createdDraftId) {
        setSelectedDraftId(createdDraftId);
      }
      await refreshDashboard();
      completeOfferRequestId(requestId);
      setNotice("Angebotsentwurf wurde erstellt.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Angebotsentwurf konnte nicht erstellt werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
