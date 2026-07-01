import { extractAcceptedSpecId } from "./production-api-response-ids.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionTextIntakeSubmitInput = {
  createAcceptedSpecFromText: (text: string) => Promise<Record<string, unknown>>;
  intakeText: string;
  setSubmitting: (submitting: boolean) => void;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  clearMessages: () => void;
  setFocusedProductionSpecId: (specId: string) => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildProductionTextIntakeSubmitAction({
  createAcceptedSpecFromText,
  intakeText,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  setFocusedProductionSpecId,
  refreshDashboard,
  setNotice,
  setError
}: ProductionTextIntakeSubmitInput) {
  return async function handleIntakeSubmit() {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromText(intakeText);
      const specId = extractAcceptedSpecId(response);
      if (specId) {
        setFocusedProductionSpecId(specId);
      }
      await refreshDashboard();
      setNotice(
        "Freitext ist zur Prüfung übernommen. Erkannte Produktionsgrundlage prüfen, Rückfragen klären und danach Berechnung starten; keine automatische Produktionsfreigabe."
      );
    } catch (submitError) {
      setError(
        formatSubmitErrorMessage(submitError, "Erfassungstext konnte nicht normalisiert werden.")
      );
    } finally {
      setSubmitting(false);
    }
  };
}
