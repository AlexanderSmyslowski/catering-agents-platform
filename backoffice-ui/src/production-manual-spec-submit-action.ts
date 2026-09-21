import { extractAcceptedSpecId } from "./production-api-response-ids.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionManualSpecSubmitInput = {
  createAcceptedSpecFromManualForm: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  createProductionCase: (input?: Record<string, never>) => Promise<{ case: { caseId: string } }>;
  createProductionDraftFromAcceptedEventSpec: (
    caseId: string,
    spec: Record<string, unknown>
  ) => Promise<{ draft: { draftId: string } }>;
  buildCurrentManualSpecInput: () => Record<string, unknown>;
  setSubmitting: (submitting: boolean) => void;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  clearMessages: () => void;
  setFocusedProductionSpecId: (specId: string) => void;
  setActiveProductionCaseId: (caseId: string) => void;
  setActiveProductionCaseSpecId: (specId: string) => void;
  resetManualSpecDraft: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildProductionManualSpecSubmitAction({
  createAcceptedSpecFromManualForm,
  createProductionCase,
  createProductionDraftFromAcceptedEventSpec,
  buildCurrentManualSpecInput,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  setFocusedProductionSpecId,
  setActiveProductionCaseId,
  setActiveProductionCaseSpecId,
  resetManualSpecDraft,
  setNotice,
  setError
}: ProductionManualSpecSubmitInput) {
  return async function handleManualSpecSubmit() {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromManualForm(buildCurrentManualSpecInput());
      const specId = extractAcceptedSpecId(response);
      if (!specId) throw new Error("Manuelle Spezifikation enthält keine gültige ID.");
      const productionCase = await createProductionCase({});
      await createProductionDraftFromAcceptedEventSpec(productionCase.case.caseId, { specId });
      setActiveProductionCaseId(productionCase.case.caseId);
      setActiveProductionCaseSpecId(specId);
      setFocusedProductionSpecId(specId);
      resetManualSpecDraft();
      setNotice("Manuelle Spezifikation wurde angelegt.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Manuelle Spezifikation konnte nicht erstellt werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
