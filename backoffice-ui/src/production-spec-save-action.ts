import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionSpecSaveActionInput = {
  editingSpecId?: string;
  persistCurrentSpecEdit: () => Promise<unknown>;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  setError: (message: string) => void;
};

export function buildProductionSpecSaveAction({
  editingSpecId,
  persistCurrentSpecEdit,
  setSubmitting,
  clearMessages,
  setError
}: ProductionSpecSaveActionInput) {
  return async function handleSaveSpecEdit() {
    if (!editingSpecId) {
      return;
    }

    setSubmitting(true);
    clearMessages();
    try {
      await persistCurrentSpecEdit();
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Spezifikation konnte nicht gespeichert werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
