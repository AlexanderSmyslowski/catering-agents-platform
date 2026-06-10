import { describe, expect, it, vi } from "vitest";
import { buildProductionWindowFileActions } from "../backoffice-ui/src/production-window-file-actions.js";
import { PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES } from "../backoffice-ui/src/production-document-upload-limit.js";

describe("production window file actions", () => {
  it("activates the production drop affordance only for file drags", () => {
    const preventDefault = vi.fn();
    const setDragActive = vi.fn();
    const actions = buildProductionWindowFileActions({
      setDragActive,
      setIntakeFile: vi.fn(),
      processIncomingProductionFile: vi.fn()
    });

    actions.handleWindowDragOver({
      preventDefault,
      dataTransfer: {
        types: {
          includes: (type: string) => type === "Files"
        }
      }
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragActive).toHaveBeenCalledWith(true);

    actions.handleWindowDragOver({
      preventDefault,
      dataTransfer: {
        types: {
          includes: () => false
        }
      }
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragActive).toHaveBeenCalledOnce();
  });

  it("starts a production document upload from a window drop", () => {
    const file = new File(["angebot"], "angebot.pdf", { type: "application/pdf" });
    const preventDefault = vi.fn();
    const setDragActive = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const actions = buildProductionWindowFileActions({
      setDragActive,
      setIntakeFile,
      processIncomingProductionFile
    });

    actions.handleWindowDrop({
      preventDefault,
      dataTransfer: { files: [file] }
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragActive).toHaveBeenCalledWith(false);
    expect(setIntakeFile).toHaveBeenCalledWith(file);
    expect(processIncomingProductionFile).toHaveBeenCalledWith(file, "pdf_upload");
  });

  it("rejects oversized window drops before processing starts", () => {
    const file = {
      name: "kundenanfrage.pdf",
      type: "application/pdf",
      size: PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES + 1
    } as File;
    const preventDefault = vi.fn();
    const setDragActive = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const resetDocumentProgress = vi.fn();
    const clearMessages = vi.fn();
    const setError = vi.fn();
    const actions = buildProductionWindowFileActions({
      setDragActive,
      setIntakeFile,
      resetDocumentProgress,
      clearMessages,
      setError,
      processIncomingProductionFile
    });

    actions.handleWindowDrop({
      preventDefault,
      dataTransfer: { files: [file] }
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragActive).toHaveBeenCalledWith(false);
    expect(setIntakeFile).toHaveBeenCalledWith(null);
    expect(resetDocumentProgress).toHaveBeenCalledOnce();
    expect(clearMessages).toHaveBeenCalledOnce();
    expect(setError).toHaveBeenCalledWith("Die Datei ist zu groß. Maximal erlaubt sind 25 MB.");
    expect(processIncomingProductionFile).not.toHaveBeenCalled();
  });

  it("keeps empty window drops inert", () => {
    const preventDefault = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const actions = buildProductionWindowFileActions({
      setDragActive: vi.fn(),
      setIntakeFile,
      processIncomingProductionFile
    });

    actions.handleWindowDrop({
      preventDefault,
      dataTransfer: { files: [] }
    } as never);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(setIntakeFile).not.toHaveBeenCalled();
    expect(processIncomingProductionFile).not.toHaveBeenCalled();
  });

  it("clears the drag affordance when the pointer leaves the window", () => {
    const setDragActive = vi.fn();
    const actions = buildProductionWindowFileActions({
      setDragActive,
      setIntakeFile: vi.fn(),
      processIncomingProductionFile: vi.fn()
    });

    actions.handleWindowDragLeave({ relatedTarget: null } as never);
    actions.handleWindowDragLeave({ relatedTarget: new EventTarget() } as never);

    expect(setDragActive).toHaveBeenCalledOnce();
    expect(setDragActive).toHaveBeenCalledWith(false);
  });
});
