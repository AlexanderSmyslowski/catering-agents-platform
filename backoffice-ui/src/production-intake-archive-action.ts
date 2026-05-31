import {
  completeProductionIntakeArchiveSuccess,
  type ProductionIntakeArchiveSuccessActions
} from "./production-workspace-reset.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionIntakeArchiveServices = {
  archiveIntakeRequest: (requestId: string, reasonCode: "wrong_upload") => Promise<unknown>;
};

export type ProductionIntakeArchiveCallbacks = ProductionIntakeArchiveSuccessActions & {
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  setError: (message: string) => void;
};

export type ProductionIntakeArchiveActionInput =
  ProductionIntakeArchiveServices &
  ProductionIntakeArchiveCallbacks & {
    currentIntakeRequestId?: string;
  };

export function buildProductionIntakeArchiveAction({
  archiveIntakeRequest,
  currentIntakeRequestId,
  setSubmitting,
  clearMessages,
  resetProductionWorkspaceState,
  refreshDashboard,
  setNotice,
  setError
}: ProductionIntakeArchiveActionInput) {
  return async function handleArchiveCurrentIntake() {
    if (!currentIntakeRequestId) {
      setError("Kein verknüpfter Intake-Kontext zum Archivieren vorhanden.");
      return;
    }

    const archivedRequestId = currentIntakeRequestId;
    setSubmitting(true);
    clearMessages();
    try {
      await archiveIntakeRequest(archivedRequestId, "wrong_upload");
      await completeProductionIntakeArchiveSuccess(archivedRequestId, {
        resetProductionWorkspaceState,
        refreshDashboard,
        setNotice
      });
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Fehlupload konnte nicht archiviert werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
