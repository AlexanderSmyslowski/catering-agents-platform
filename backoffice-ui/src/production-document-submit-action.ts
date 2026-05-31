import type { IntakeDocumentChannel } from "./api.js";
import {
  completeProductionStateAfterDocumentSuccess,
  type ProductionDocumentSuccessActions
} from "./production-document-success-state.js";
import {
  resetProductionStateAfterDocumentFailure,
  type ProductionDocumentFailureResetActions
} from "./production-document-failure-reset.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionDocumentSubmitServices = {
  createAcceptedSpecFromDocument: (
    file: File,
    channel: IntakeDocumentChannel
  ) => Promise<Record<string, unknown>>;
};

export type ProductionDocumentSubmitCallbacks =
  ProductionDocumentSuccessActions &
  ProductionDocumentFailureResetActions & {
    setSubmitting: (submitting: boolean) => void;
    setProductionWorkspaceCleared: (cleared: boolean) => void;
    clearMessages: () => void;
    startIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => void;
    startDocumentProgress: (file: File) => void;
    setNotice: (message: string) => void;
    setError: (message: string) => void;
  };

export type ProductionDocumentSubmitActionInput =
  ProductionDocumentSubmitServices &
  ProductionDocumentSubmitCallbacks & {
    intakeFile?: File | null;
    intakeChannel: IntakeDocumentChannel;
  };

export type ProductionDocumentSubmitActions = {
  submitSelectedDocument: () => Promise<void>;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => Promise<void>;
};

export function buildProductionDocumentSubmitActions({
  createAcceptedSpecFromDocument,
  intakeFile,
  intakeChannel,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  startIncomingProductionFile,
  startDocumentProgress,
  setFocusedProductionSpecId,
  completeIncomingProductionFile,
  completeDocumentProgress,
  refreshDashboard,
  setNotice,
  failIncomingProductionFile,
  failDocumentProgress,
  clearFocusedProductionSpecId,
  clearSelectedPlanId,
  resetPlanProgress,
  resetIntakeRequestDetail,
  resetSpecEdit,
  setError
}: ProductionDocumentSubmitActionInput): ProductionDocumentSubmitActions {
  async function processIncomingProductionFile(file: File, channel: IntakeDocumentChannel) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    startIncomingProductionFile(file, channel);
    startDocumentProgress(file);
    setNotice(`Dokument ${file.name} wird analysiert...`);

    try {
      const response = await createAcceptedSpecFromDocument(file, channel);
      await completeProductionStateAfterDocumentSuccess(file, response, {
        setFocusedProductionSpecId,
        completeIncomingProductionFile,
        completeDocumentProgress,
        refreshDashboard,
        setNotice
      });
    } catch (submitError) {
      resetProductionStateAfterDocumentFailure(file, {
        failIncomingProductionFile,
        failDocumentProgress,
        setProductionWorkspaceCleared,
        clearFocusedProductionSpecId,
        clearSelectedPlanId,
        resetPlanProgress,
        resetIntakeRequestDetail,
        resetSpecEdit
      });
      setError(formatSubmitErrorMessage(submitError, "Dokument konnte nicht normalisiert werden."));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSelectedDocument() {
    if (!intakeFile) {
      setError("Bitte wähle zuerst ein Dokument aus.");
      return;
    }

    await processIncomingProductionFile(intakeFile, intakeChannel);
  }

  return {
    submitSelectedDocument,
    processIncomingProductionFile
  };
}
