import type { IntakeDocumentChannel, ProductionDraft } from "./api.js";
import {
  completeProductionDraftStateAfterDocumentSuccess,
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
  createProductionDraftFromDocument: (file: File) => Promise<{ draft: ProductionDraft }>;
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
  submitSelectedIntakeDocument: () => Promise<void>;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => Promise<void>;
};

export function buildProductionDocumentSubmitActions({
  createAcceptedSpecFromDocument,
  createProductionDraftFromDocument,
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
  async function processFile(
    file: File,
    channel: IntakeDocumentChannel,
    target: "production_draft" | "accepted_spec"
  ) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    startIncomingProductionFile(file, channel);
    startDocumentProgress(file);
    setNotice(target === "production_draft"
      ? `KI erstellt einen prüfbaren Entwurf aus ${file.name} ...`
      : `Dokument ${file.name} wird analysiert...`);

    try {
      if (target === "production_draft") {
        await createProductionDraftFromDocument(file);
        await completeProductionDraftStateAfterDocumentSuccess(file, {
          completeIncomingProductionFile,
          completeDocumentProgress,
          refreshDashboard,
          setNotice
        });
      } else {
        const response = await createAcceptedSpecFromDocument(file, channel);
        await completeProductionStateAfterDocumentSuccess(file, response, {
          setFocusedProductionSpecId,
          completeIncomingProductionFile,
          completeDocumentProgress,
          refreshDashboard,
          setNotice
        });
      }
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
      clearMessages();
      setError(formatSubmitErrorMessage(
        submitError,
        target === "production_draft"
          ? "KI-Entwurf konnte nicht erstellt werden."
          : "Dokument konnte nicht normalisiert werden."
      ));
    } finally {
      setSubmitting(false);
    }
  }

  async function processIncomingProductionFile(file: File, channel: IntakeDocumentChannel) {
    await processFile(file, channel, "production_draft");
  }

  async function submitSelectedDocument() {
    if (!intakeFile) {
      setError("Bitte wähle zuerst ein Dokument aus.");
      return;
    }

    await processIncomingProductionFile(intakeFile, intakeChannel);
  }

  async function submitSelectedIntakeDocument() {
    if (!intakeFile) {
      setError("Bitte wähle zuerst ein Dokument aus.");
      return;
    }

    await processFile(intakeFile, intakeChannel, "accepted_spec");
  }

  return {
    submitSelectedDocument,
    submitSelectedIntakeDocument,
    processIncomingProductionFile
  };
}
