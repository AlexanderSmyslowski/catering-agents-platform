import { describe, expect, it, vi } from "vitest";
import {
  startProductionDocumentUpload,
  type ProductionDocumentUploadStartActions
} from "../backoffice-ui/src/production-document-upload-start.js";

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
});
