import { extractLabeledCustomerName } from "../../shared-core/src/intake-signals.js";
import type { WorkspaceRefreshOptions } from "./api.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type OfferTextSubmitActionInput = {
  createOfferCase: (input?: { customerName?: string }) => Promise<{ case: { caseId: string } }>;
  createOfferFromText: (caseId: string, text: string, requestId: string) => Promise<Record<string, unknown>>;
  getOrCreateOfferRequestId: (text: string) => string;
  completeOfferRequestId: (requestId: string) => void;
  activeOfferCaseId?: string;
  setActiveOfferCaseId: (caseId: string) => void;
  offerText: string;
  customerName?: string;
  setOfferText?: (text: string) => void;
  clearCustomerName?: () => void;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  setSelectedDraftId: (draftId: string) => void;
  refreshDashboard: (options?: WorkspaceRefreshOptions) => Promise<void>;
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
  customerName,
  setOfferText,
  clearCustomerName,
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
      const enteredName = !activeOfferCaseId ? customerName?.normalize("NFKC").replace(/\s+/gu, " ").trim() : undefined;
      if (enteredName && enteredName.length > 320) throw new Error("Kundenname darf höchstens 320 Zeichen enthalten.");
      const requestText = enteredName ? `Kunde: ${enteredName}\n\n${offerText}` : offerText;
      // Keep the explicit operator annotation in the request text so retries,
      // Intake provenance and the production snapshot carry the same identity.
      if (enteredName) {
        setOfferText?.(requestText);
        clearCustomerName?.();
      }
      const requestId = getOrCreateOfferRequestId(requestText);
      const requestCustomer = extractLabeledCustomerName(requestText);
      const caseId = activeOfferCaseId ?? (await createOfferCase(requestCustomer ? { customerName: requestCustomer } : {})).case.caseId;
      if (!activeOfferCaseId) {
        setActiveOfferCaseId(caseId);
      }
      const response = await createOfferFromText(caseId, requestText, requestId);
      const createdDraftId = typeof response.draftId === "string" ? response.draftId : undefined;
      if (createdDraftId) {
        setSelectedDraftId(createdDraftId);
      }
      await refreshDashboard({ focusedOfferCaseId: caseId });
      completeOfferRequestId(requestId);
      setNotice("Angebotsentwurf wurde erstellt.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Angebotsentwurf konnte nicht erstellt werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
