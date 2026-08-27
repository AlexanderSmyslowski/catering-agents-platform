import { extractAcceptedSpecId } from "./production-api-response-ids.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionTextIntakeSubmitInput = {
  createAcceptedSpecFromText: (text: string) => Promise<Record<string, unknown>>;
  createProductionCase: (input?: Record<string, never>) => Promise<{ case: { caseId: string } }>;
  createProductionDraftFromAcceptedEventSpec: (
    caseId: string,
    spec: Record<string, unknown>
  ) => Promise<{ draft: { draftId: string } }>;
  intakeText: string;
  setSubmitting: (submitting: boolean) => void;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  clearMessages: () => void;
  setFocusedProductionSpecId: (specId: string) => void;
  setActiveProductionCaseId: (caseId: string) => void;
  setActiveProductionCaseSpecId: (specId: string) => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildProductionTextIntakeSubmitAction({
  createAcceptedSpecFromText,
  createProductionCase,
  createProductionDraftFromAcceptedEventSpec,
  intakeText,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  setFocusedProductionSpecId,
  setActiveProductionCaseId,
  setActiveProductionCaseSpecId,
  setNotice,
  setError
}: ProductionTextIntakeSubmitInput) {
  return async function handleIntakeSubmit() {
    if (!intakeText.trim()) {
      setError("Bitte Beschreibung eingeben");
      return;
    }

    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromText(intakeText);
      const specId = extractAcceptedSpecId(response);
      if (!specId) throw new Error("Freitext-Spezifikation enthält keine gültige ID.");
      const productionCase = await createProductionCase({});
      await createProductionDraftFromAcceptedEventSpec(productionCase.case.caseId, { specId });
      setActiveProductionCaseId(productionCase.case.caseId);
      setActiveProductionCaseSpecId(specId);
      setFocusedProductionSpecId(specId);
      setNotice("Freitext wurde in eine operative Spezifikation überführt.");
    } catch (submitError) {
      setError(
        formatSubmitErrorMessage(submitError, "Erfassungstext konnte nicht normalisiert werden.")
      );
    } finally {
      setSubmitting(false);
    }
  };
}
