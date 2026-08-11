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
  uploadSourceDocument: (file: File) => Promise<{ documentId: string }>;
  createProductionCase: (input?: Record<string, never>) => Promise<{ case: { caseId: string } }>;
  createProductionDraftFromDocument: (
    caseId: string,
    documentId: string
  ) => Promise<{ draft: ProductionDraft }>;
  createOfferCase: (input?: Record<string, never>) => Promise<{ case: { caseId: string } }>;
  createOfferDraftFromRequest: (
    caseId: string,
    eventRequest: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
};

export type StagedProductionDocument = {
  file: File;
  documentId: string;
  caseId?: string;
};

export type ProductionDocumentSubmitCallbacks =
  ProductionDocumentSuccessActions &
  ProductionDocumentFailureResetActions & {
    setSubmitting: (submitting: boolean) => void;
    setActiveProductionCaseId: (caseId: string) => void;
    setActiveOfferCaseId: (caseId: string) => void;
    setSelectedDraftId: (draftId: string) => void;
    getStagedProductionDocument?: () => StagedProductionDocument | undefined;
    setStagedProductionDocument?: (stage: StagedProductionDocument) => void;
    clearStagedProductionDocument?: () => void;
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
    activeProductionCaseId?: string;
    activeOfferCaseId?: string;
  };

export type ProductionDocumentSubmitActions = {
  submitSelectedDocument: () => Promise<void>;
  submitSelectedIntakeDocument: () => Promise<void>;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => Promise<void>;
};

export function buildProductionDocumentSubmitActions({
  createAcceptedSpecFromDocument,
  uploadSourceDocument,
  createProductionCase,
  createProductionDraftFromDocument,
  activeProductionCaseId,
  setActiveProductionCaseId,
  createOfferCase,
  createOfferDraftFromRequest,
  activeOfferCaseId,
  setActiveOfferCaseId,
  setSelectedDraftId,
  getStagedProductionDocument,
  setStagedProductionDocument,
  clearStagedProductionDocument,
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
        const existingStage = getStagedProductionDocument?.();
        const reusableStage = existingStage?.file === file ? existingStage : undefined;
        let documentId = reusableStage?.documentId;
        let caseId = reusableStage?.caseId;

        if (!documentId) {
          documentId = (await uploadSourceDocument(file)).documentId;
          setStagedProductionDocument?.({ file, documentId });
        }
        if (!caseId) {
          caseId = activeProductionCaseId ?? (await createProductionCase({})).case.caseId;
          if (!activeProductionCaseId) {
            setActiveProductionCaseId(caseId);
          }
          setStagedProductionDocument?.({ file, documentId, caseId });
        }
        await createProductionDraftFromDocument(caseId, documentId);
        clearStagedProductionDocument?.();
        await completeProductionDraftStateAfterDocumentSuccess(file, {
          completeIncomingProductionFile,
          completeDocumentProgress,
          refreshDashboard,
          setNotice
        });
      } else {
        const response = await createAcceptedSpecFromDocument(file, channel);
        const eventRequest = response.eventRequest;
        if (!eventRequest || typeof eventRequest !== "object" || Array.isArray(eventRequest)) {
          throw new Error("Das Dokument enthält keine gültige Angebotsanfrage.");
        }
        const caseId = activeOfferCaseId ?? (await createOfferCase({})).case.caseId;
        if (!activeOfferCaseId) {
          setActiveOfferCaseId(caseId);
        }
        const draft = await createOfferDraftFromRequest(
          caseId,
          eventRequest as Record<string, unknown>
        );
        if (typeof draft.draftId !== "string" || !draft.draftId) {
          throw new Error("Der Angebotsentwurf enthält keine gültige ID.");
        }
        setSelectedDraftId(draft.draftId);
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
