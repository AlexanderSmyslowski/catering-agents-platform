import { extractAcceptedSpecId } from "./production-api-response-ids.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionManualSpecSubmitInput = {
  createAcceptedSpecFromManualForm: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  buildCurrentManualSpecInput: () => Record<string, unknown>;
  setSubmitting: (submitting: boolean) => void;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  clearMessages: () => void;
  setFocusedProductionSpecId: (specId: string) => void;
  resetManualSpecDraft: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildProductionManualSpecSubmitAction({
  createAcceptedSpecFromManualForm,
  buildCurrentManualSpecInput,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  setFocusedProductionSpecId,
  resetManualSpecDraft,
  refreshDashboard,
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
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      resetManualSpecDraft();
      await refreshDashboard();
      setNotice("Manuelle Spezifikation wurde angelegt.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Manuelle Spezifikation konnte nicht erstellt werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
