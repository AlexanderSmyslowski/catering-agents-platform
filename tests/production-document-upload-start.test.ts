import { describe, expect, it, vi } from "vitest";
import {
  startProductionDocumentUpload,
  type ProductionDocumentUploadStartActions
} from "../backoffice-ui/src/production-document-upload-start.js";
import { PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES } from "../backoffice-ui/src/production-document-upload-limit.js";

describe("production document upload start", () => {
  it("clears drag state, stores the file and starts processing with the inferred channel", () => {
    const calls: string[] = [];
    const file = new File(["Angebot"], "kundenangebot.pdf", { type: "application/pdf" });
    const actions: ProductionDocumentUploadStartActions = {
      setDragActive: vi.fn((active) => {
        calls.push(`setDragActive:${active}`);
      }),
      setIntakeFile: vi.fn((receivedFile) => {
        calls.push(`setIntakeFile:${receivedFile.name}`);
      }),
      processIncomingProductionFile: vi.fn((receivedFile, channel) => {
        calls.push(`processIncomingProductionFile:${receivedFile.name}:${channel}`);
      })
    };

    startProductionDocumentUpload(file, actions);

    expect(actions.setDragActive).toHaveBeenCalledWith(false);
    expect(actions.setIntakeFile).toHaveBeenCalledWith(file);
    expect(actions.processIncomingProductionFile).toHaveBeenCalledWith(file, "pdf_upload");
    expect(calls).toEqual([
      "setDragActive:false",
      "setIntakeFile:kundenangebot.pdf",
      "processIncomingProductionFile:kundenangebot.pdf:pdf_upload"
    ]);
  });

  it("uses the email upload channel for eml files", () => {
    const file = new File(["From: kunde@example.test"], "kundenmail.eml", { type: "message/rfc822" });
    const actions: ProductionDocumentUploadStartActions = {
      setDragActive: vi.fn(),
      setIntakeFile: vi.fn(),
      processIncomingProductionFile: vi.fn()
    };

    startProductionDocumentUpload(file, actions);

    expect(actions.processIncomingProductionFile).toHaveBeenCalledWith(file, "email");
  });

  it("rejects files above the shared intake limit before processing starts", () => {
    const oversizedFile = {
      name: "kundenanfrage.pdf",
      type: "application/pdf",
      size: PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES + 1
    } as File;
    const calls: string[] = [];
    const actions: ProductionDocumentUploadStartActions = {
      setDragActive: vi.fn((active) => {
        calls.push(`setDragActive:${active}`);
      }),
      setIntakeFile: vi.fn((receivedFile) => {
        calls.push(`setIntakeFile:${receivedFile?.name ?? "none"}`);
      }),
      resetDocumentProgress: vi.fn(() => {
        calls.push("resetDocumentProgress");
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      setError: vi.fn((message) => {
        calls.push(`setError:${message}`);
      }),
      processIncomingProductionFile: vi.fn()
    };

    startProductionDocumentUpload(oversizedFile, actions);

    expect(actions.processIncomingProductionFile).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setDragActive:false",
      "setIntakeFile:none",
      "resetDocumentProgress",
      "clearMessages",
      "setError:Die Datei ist zu groß. Maximal erlaubt sind 25 MB."
    ]);
  });

  it("accepts files just below the shared intake limit", () => {
    const acceptedFile = {
      name: "kundenanfrage.pdf",
      type: "application/pdf",
      size: PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES - 1
    } as File;
    const actions: ProductionDocumentUploadStartActions = {
      setDragActive: vi.fn(),
      setIntakeFile: vi.fn(),
      resetDocumentProgress: vi.fn(),
      clearMessages: vi.fn(),
      setError: vi.fn(),
      processIncomingProductionFile: vi.fn()
    };

    startProductionDocumentUpload(acceptedFile, actions);

    expect(actions.setIntakeFile).toHaveBeenCalledWith(acceptedFile);
    expect(actions.processIncomingProductionFile).toHaveBeenCalledWith(acceptedFile, "pdf_upload");
    expect(actions.setError).not.toHaveBeenCalled();
  });
});
