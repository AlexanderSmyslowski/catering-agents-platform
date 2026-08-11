import { describe, expect, it, vi } from "vitest";
import {
  buildProductionDocumentSubmitActions,
  type ProductionDocumentSubmitActionInput
} from "../backoffice-ui/src/production-document-submit-action.js";
import { PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES } from "../backoffice-ui/src/production-document-upload-limit.js";
import type { ProductionDraft } from "../backoffice-ui/src/api.js";

function file(name = "kundenangebot.pdf") {
  return new File(["Lunch fuer 40 Personen"], name, { type: "application/pdf" });
}

function draft(): ProductionDraft {
  return {
    draftId: "production-draft-upload-1",
    status: "pending_review",
    reviewCards: [],
    createdAt: "2026-07-10T10:00:00.000Z"
  };
}

function input(overrides: Partial<ProductionDocumentSubmitActionInput> = {}): ProductionDocumentSubmitActionInput {
  return {
    createAcceptedSpecFromDocument: vi.fn(async () => ({
      eventRequest: {
        requestId: "request-upload-1",
        channel: "pdf_upload",
        receivedAt: "2026-07-10T10:00:00.000Z",
        rawText: "Lunch fuer 40 Personen",
        signals: {},
        ambiguities: []
      },
      acceptedEventSpec: { specId: "spec-upload-1" }
    })),
    uploadSourceDocument: vi.fn(async () => ({ documentId: "source-document-1" })),
    createProductionCase: vi.fn(async () => ({ case: { caseId: "production-case-1" } })),
    createProductionDraftFromDocument: vi.fn(async () => ({ draft: draft() })),
    activeProductionCaseId: undefined,
    setActiveProductionCaseId: vi.fn(),
    createOfferCase: vi.fn(async () => ({ case: { caseId: "offer-case-1" } })),
    createOfferDraftFromRequest: vi.fn(async () => ({ draftId: "offer-draft-upload-1" })),
    activeOfferCaseId: undefined,
    setActiveOfferCaseId: vi.fn(),
    setSelectedDraftId: vi.fn(),
    intakeFile: file(),
    intakeChannel: "pdf_upload",
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    clearMessages: vi.fn(),
    startIncomingProductionFile: vi.fn(),
    startDocumentProgress: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    completeIncomingProductionFile: vi.fn(),
    completeDocumentProgress: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    failIncomingProductionFile: vi.fn(),
    failDocumentProgress: vi.fn(),
    clearFocusedProductionSpecId: vi.fn(),
    clearSelectedPlanId: vi.fn(),
    resetPlanProgress: vi.fn(),
    resetIntakeRequestDetail: vi.fn(),
    resetSpecEdit: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production document submit action", () => {
  it("asks for a file before submitting the selected document", async () => {
    const actionsInput = input({ intakeFile: undefined });
    const { submitSelectedDocument } = buildProductionDocumentSubmitActions(actionsInput);

    await submitSelectedDocument();

    expect(actionsInput.setError).toHaveBeenCalledWith("Bitte wähle zuerst ein Dokument aus.");
    expect(actionsInput.createAcceptedSpecFromDocument).not.toHaveBeenCalled();
    expect(actionsInput.uploadSourceDocument).not.toHaveBeenCalled();
    expect(actionsInput.createProductionCase).not.toHaveBeenCalled();
    expect(actionsInput.createProductionDraftFromDocument).not.toHaveBeenCalled();
    expect(actionsInput.setSubmitting).not.toHaveBeenCalled();
  });

  it("creates a review draft without focusing product data", async () => {
    const selectedFile = file("angebot.pdf");
    const calls: string[] = [];
    const actionsInput = input({
      intakeFile: selectedFile,
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      startIncomingProductionFile: vi.fn((receivedFile, channel) => {
        calls.push(`startIncomingProductionFile:${receivedFile.name}:${channel}`);
      }),
      startDocumentProgress: vi.fn((receivedFile) => {
        calls.push(`startDocumentProgress:${receivedFile.name}`);
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      }),
      uploadSourceDocument: vi.fn(async () => {
        calls.push("uploadSourceDocument");
        return { documentId: "source-document-1" };
      }),
      createProductionCase: vi.fn(async () => {
        calls.push("createProductionCase");
        return { case: { caseId: "production-case-1" } };
      }),
      setActiveProductionCaseId: vi.fn((caseId) => {
        calls.push(`setActiveProductionCaseId:${caseId}`);
      }),
      createProductionDraftFromDocument: vi.fn(async (caseId, documentId) => {
        calls.push(`createProductionDraftFromDocument:${caseId}:${documentId}`);
        return { draft: draft() };
      }),
      setFocusedProductionSpecId: vi.fn((specId) => {
        calls.push(`setFocusedProductionSpecId:${specId}`);
      }),
      completeIncomingProductionFile: vi.fn(() => {
        calls.push("completeIncomingProductionFile");
      }),
      completeDocumentProgress: vi.fn(() => {
        calls.push("completeDocumentProgress");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      })
    });
    const { submitSelectedDocument } = buildProductionDocumentSubmitActions(actionsInput);

    await submitSelectedDocument();

    expect(actionsInput.uploadSourceDocument).toHaveBeenCalledWith(selectedFile);
    expect(actionsInput.createProductionCase).toHaveBeenCalledWith({});
    expect(actionsInput.createProductionDraftFromDocument).toHaveBeenCalledWith(
      "production-case-1",
      "source-document-1"
    );
    expect(actionsInput.createAcceptedSpecFromDocument).not.toHaveBeenCalled();
    expect(actionsInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "setProductionWorkspaceCleared:false",
      "clearMessages",
      "startIncomingProductionFile:angebot.pdf:pdf_upload",
      "startDocumentProgress:angebot.pdf",
      "setNotice:KI erstellt einen prüfbaren Entwurf aus angebot.pdf ...",
      "uploadSourceDocument",
      "createProductionCase",
      "setActiveProductionCaseId:production-case-1",
      "createProductionDraftFromDocument:production-case-1:source-document-1",
      "completeIncomingProductionFile",
      "completeDocumentProgress",
      "refreshDashboard",
      "setNotice:KI-Entwurf für angebot.pdf ist bereit zur Prüfung.",
      "setSubmitting:false"
    ]);
  });

  it("reuses an active production case for later source documents", async () => {
    const actionsInput = input({ activeProductionCaseId: "production-case-existing" });
    const { submitSelectedDocument } = buildProductionDocumentSubmitActions(actionsInput);

    await submitSelectedDocument();

    expect(actionsInput.createProductionCase).not.toHaveBeenCalled();
    expect(actionsInput.setActiveProductionCaseId).not.toHaveBeenCalled();
    expect(actionsInput.createProductionDraftFromDocument).toHaveBeenCalledWith(
      "production-case-existing",
      "source-document-1"
    );
  });

  it("retries draft creation with the staged document and case instead of uploading again", async () => {
    const selectedFile = file("retry-angebot.pdf");
    let staged:
      | { file: File; documentId: string; caseId?: string }
      | undefined;
    let draftAttempts = 0;
    const stageCallbacks: Partial<ProductionDocumentSubmitActionInput> = {
      getStagedProductionDocument: () => staged,
      setStagedProductionDocument: (next) => {
        staged = next;
      },
      clearStagedProductionDocument: () => {
        staged = undefined;
      }
    };
    const actionsInput = input({
      ...stageCallbacks,
      intakeFile: selectedFile,
      createProductionDraftFromDocument: vi.fn(async () => {
        draftAttempts += 1;
        if (draftAttempts === 1) {
          throw new Error("Provider vorübergehend nicht erreichbar");
        }
        return { draft: draft() };
      })
    });
    const { submitSelectedDocument } = buildProductionDocumentSubmitActions(actionsInput);

    await submitSelectedDocument();
    await submitSelectedDocument();

    expect(actionsInput.uploadSourceDocument).toHaveBeenCalledTimes(1);
    expect(actionsInput.createProductionCase).toHaveBeenCalledTimes(1);
    expect(actionsInput.createProductionDraftFromDocument).toHaveBeenNthCalledWith(
      1,
      "production-case-1",
      "source-document-1"
    );
    expect(actionsInput.createProductionDraftFromDocument).toHaveBeenNthCalledWith(
      2,
      "production-case-1",
      "source-document-1"
    );
    expect(staged).toBeUndefined();
  });

  it("keeps a committed production draft successful when only dashboard refresh fails", async () => {
    const actionsInput = input({
      refreshDashboard: vi.fn(async () => {
        throw new Error("Dashboard vorübergehend nicht erreichbar");
      })
    });
    const { submitSelectedDocument } = buildProductionDocumentSubmitActions(actionsInput);

    await submitSelectedDocument();

    expect(actionsInput.createProductionDraftFromDocument).toHaveBeenCalledTimes(1);
    expect(actionsInput.completeIncomingProductionFile).toHaveBeenCalledTimes(1);
    expect(actionsInput.completeDocumentProgress).toHaveBeenCalledTimes(1);
    expect(actionsInput.failIncomingProductionFile).not.toHaveBeenCalled();
    expect(actionsInput.failDocumentProgress).not.toHaveBeenCalled();
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(actionsInput.setNotice).toHaveBeenLastCalledWith(
      "KI-Entwurf für kundenangebot.pdf ist bereit zur Prüfung. Die Arbeitsfläche konnte nicht neu geladen werden; bitte lade die Seite neu."
    );
  });

  it("creates a case-bound offer draft after normalizing an uploaded offer", async () => {
    const selectedFile = file("angebot.pdf");
    const calls: string[] = [];
    const createOfferCase = vi.fn(async () => {
      calls.push("createOfferCase");
      return { case: { caseId: "offer-case-1" } };
    });
    const setActiveOfferCaseId = vi.fn((caseId: string) => {
      calls.push(`setActiveOfferCaseId:${caseId}`);
    });
    const createOfferDraftFromRequest = vi.fn(async (
      caseId: string,
      eventRequest: Record<string, unknown>
    ) => {
      calls.push(`createOfferDraftFromRequest:${caseId}:${String(eventRequest.requestId)}`);
      return { draftId: "offer-draft-upload-1" };
    });
    const setSelectedDraftId = vi.fn((draftId: string) => {
      calls.push(`setSelectedDraftId:${draftId}`);
    });
    const actionsInput = input({
      intakeFile: selectedFile,
      createAcceptedSpecFromDocument: vi.fn(async () => {
        calls.push("createAcceptedSpecFromDocument");
        return {
          eventRequest: {
            requestId: "request-upload-1",
            channel: "pdf_upload",
            receivedAt: "2026-07-10T10:00:00.000Z",
            rawText: "Lunch fuer 40 Personen",
            signals: {},
            ambiguities: []
          },
          acceptedEventSpec: { specId: "spec-upload-1" }
        };
      }),
      createOfferCase,
      activeOfferCaseId: undefined,
      setActiveOfferCaseId,
      createOfferDraftFromRequest,
      setSelectedDraftId
    });
    const { submitSelectedIntakeDocument } = buildProductionDocumentSubmitActions(actionsInput);

    await submitSelectedIntakeDocument();

    expect(actionsInput.createAcceptedSpecFromDocument).toHaveBeenCalledWith(selectedFile, "pdf_upload");
    expect(createOfferCase).toHaveBeenCalledWith({});
    expect(createOfferDraftFromRequest).toHaveBeenCalledWith(
      "offer-case-1",
      expect.objectContaining({ requestId: "request-upload-1" })
    );
    expect(setSelectedDraftId).toHaveBeenCalledWith("offer-draft-upload-1");
    expect(actionsInput.createProductionDraftFromDocument).not.toHaveBeenCalled();
    expect(actionsInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-upload-1");
    expect(calls).toEqual([
      "createAcceptedSpecFromDocument",
      "createOfferCase",
      "setActiveOfferCaseId:offer-case-1",
      "createOfferDraftFromRequest:offer-case-1:request-upload-1",
      "setSelectedDraftId:offer-draft-upload-1"
    ]);
  });

  it("reuses the active offer case for a later uploaded offer", async () => {
    const createOfferCase = vi.fn(async () => ({ case: { caseId: "offer-case-new" } }));
    const createOfferDraftFromRequest = vi.fn(async () => ({ draftId: "offer-draft-upload-2" }));
    const actionsInput = input({
      createAcceptedSpecFromDocument: vi.fn(async () => ({
        eventRequest: {
          requestId: "request-upload-2",
          channel: "pdf_upload",
          receivedAt: "2026-07-10T11:00:00.000Z",
          rawText: "Empfang fuer 80 Personen",
          signals: {},
          ambiguities: []
        },
        acceptedEventSpec: { specId: "spec-upload-2" }
      })),
      createOfferCase,
      activeOfferCaseId: "offer-case-existing",
      setActiveOfferCaseId: vi.fn(),
      createOfferDraftFromRequest,
      setSelectedDraftId: vi.fn()
    });
    const { submitSelectedIntakeDocument } = buildProductionDocumentSubmitActions(actionsInput);

    await submitSelectedIntakeDocument();

    expect(createOfferCase).not.toHaveBeenCalled();
    expect(createOfferDraftFromRequest).toHaveBeenCalledWith(
      "offer-case-existing",
      expect.objectContaining({ requestId: "request-upload-2" })
    );
  });

  it("resets stale production state after a failed document upload", async () => {
    const failedFile = file("falsches-angebot.txt");
    const calls: string[] = [];
    const actionsInput = input({
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      }),
      setError: vi.fn((message) => {
        calls.push(`setError:${message}`);
      }),
      createProductionDraftFromDocument: vi.fn(async () => {
        throw new Error("Dokument leer");
      })
    });
    const { processIncomingProductionFile } = buildProductionDocumentSubmitActions(actionsInput);

    await processIncomingProductionFile(failedFile, "email");

    expect(actionsInput.failIncomingProductionFile).toHaveBeenCalledWith(failedFile);
    expect(actionsInput.failDocumentProgress).toHaveBeenCalledTimes(1);
    expect(actionsInput.setProductionWorkspaceCleared).toHaveBeenLastCalledWith(true);
    expect(actionsInput.clearFocusedProductionSpecId).toHaveBeenCalledTimes(1);
    expect(actionsInput.clearSelectedPlanId).toHaveBeenCalledTimes(1);
    expect(actionsInput.resetPlanProgress).toHaveBeenCalledTimes(1);
    expect(actionsInput.resetIntakeRequestDetail).toHaveBeenCalledTimes(1);
    expect(actionsInput.resetSpecEdit).toHaveBeenCalledWith(false);
    expect(actionsInput.setError).toHaveBeenCalledWith("Dokument leer");
    expect(calls).toEqual([
      "clearMessages",
      "setNotice:KI erstellt einen prüfbaren Entwurf aus falsches-angebot.txt ...",
      "clearMessages",
      "setError:Dokument leer"
    ]);
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("normalizes oversized upload errors and clears the analysing notice", async () => {
    const oversizedFile = file("zu-gross.pdf");
    const calls: string[] = [];
    const actionsInput = input({
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      }),
      setError: vi.fn((message) => {
        calls.push(`setError:${message}`);
      }),
      createProductionDraftFromDocument: vi.fn(async () => {
        throw new Error(`Datei ist zu gross. Maximal erlaubt sind ${PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES} Bytes.`);
      })
    });
    const { processIncomingProductionFile } = buildProductionDocumentSubmitActions(actionsInput);

    await processIncomingProductionFile(oversizedFile, "pdf_upload");

    expect(actionsInput.failDocumentProgress).toHaveBeenCalledTimes(1);
    expect(actionsInput.setError).toHaveBeenCalledWith(
      "Die Datei ist zu groß. Maximal erlaubt sind 25 MB."
    );
    expect(calls).toEqual([
      "clearMessages",
      "setNotice:KI erstellt einen prüfbaren Entwurf aus zu-gross.pdf ...",
      "clearMessages",
      "setError:Die Datei ist zu groß. Maximal erlaubt sind 25 MB."
    ]);
  });
});
