import { describe, expect, it, vi } from "vitest";
import {
  buildProductionDocumentSubmitActions,
  type ProductionDocumentSubmitActionInput
} from "../backoffice-ui/src/production-document-submit-action.js";
import { PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES } from "../backoffice-ui/src/production-document-upload-limit.js";

function file(name = "kundenangebot.pdf") {
  return new File(["Lunch fuer 40 Personen"], name, { type: "application/pdf" });
}

function input(overrides: Partial<ProductionDocumentSubmitActionInput> = {}): ProductionDocumentSubmitActionInput {
  return {
    createAcceptedSpecFromDocument: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-upload-1" } })),
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
    expect(actionsInput.setSubmitting).not.toHaveBeenCalled();
  });

  it("processes the selected document and completes document progress", async () => {
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
      createAcceptedSpecFromDocument: vi.fn(async () => {
        calls.push("createAcceptedSpecFromDocument");
        return { acceptedEventSpec: { specId: "spec-upload-1" } };
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

    expect(actionsInput.createAcceptedSpecFromDocument).toHaveBeenCalledWith(selectedFile, "pdf_upload");
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "setProductionWorkspaceCleared:false",
      "clearMessages",
      "startIncomingProductionFile:angebot.pdf:pdf_upload",
      "startDocumentProgress:angebot.pdf",
      "setNotice:Dokument angebot.pdf wird analysiert...",
      "createAcceptedSpecFromDocument",
      "setFocusedProductionSpecId:spec-upload-1",
      "completeIncomingProductionFile",
      "completeDocumentProgress",
      "refreshDashboard",
      "setNotice:Dokument angebot.pdf wurde übernommen und analysiert.",
      "setSubmitting:false"
    ]);
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
      createAcceptedSpecFromDocument: vi.fn(async () => {
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
      "setNotice:Dokument falsches-angebot.txt wird analysiert...",
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
      createAcceptedSpecFromDocument: vi.fn(async () => {
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
      "setNotice:Dokument zu-gross.pdf wird analysiert...",
      "clearMessages",
      "setError:Die Datei ist zu groß. Maximal erlaubt sind 25 MB."
    ]);
  });
});
