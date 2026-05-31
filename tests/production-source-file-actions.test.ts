import { describe, expect, it, vi } from "vitest";
import { buildProductionSourceFileUploadActions } from "../backoffice-ui/src/production-source-file-actions.js";

describe("production source file actions", () => {
  it("opens the hidden production file input when available", () => {
    const click = vi.fn();
    const actions = buildProductionSourceFileUploadActions({
      uploadInputRef: { current: { click } as unknown as HTMLInputElement },
      setDragActive: vi.fn(),
      setIntakeFile: vi.fn(),
      processIncomingProductionFile: vi.fn()
    });

    actions.openProductionFilePicker();

    expect(click).toHaveBeenCalledOnce();
  });

  it("starts a production document upload from a dropped file", () => {
    const file = new File(["angebot"], "angebot.pdf", { type: "application/pdf" });
    const preventDefault = vi.fn();
    const setDragActive = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const actions = buildProductionSourceFileUploadActions({
      uploadInputRef: { current: null },
      setDragActive,
      setIntakeFile,
      processIncomingProductionFile
    });

    actions.handleProductionDrop({
      preventDefault,
      dataTransfer: { files: [file] }
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragActive).toHaveBeenCalledWith(false);
    expect(setIntakeFile).toHaveBeenCalledWith(file);
    expect(processIncomingProductionFile).toHaveBeenCalledWith(file, "pdf_upload");
  });

  it("keeps empty drops inert after preventing browser navigation", () => {
    const preventDefault = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const actions = buildProductionSourceFileUploadActions({
      uploadInputRef: { current: null },
      setDragActive: vi.fn(),
      setIntakeFile,
      processIncomingProductionFile
    });

    actions.handleProductionDrop({
      preventDefault,
      dataTransfer: { files: [] }
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setIntakeFile).not.toHaveBeenCalled();
    expect(processIncomingProductionFile).not.toHaveBeenCalled();
  });

  it("starts upload from selected input files and resets the input value", () => {
    const file = new File(["mail"], "angebot.eml", { type: "message/rfc822" });
    const target = { files: [file], value: "C:\\fakepath\\angebot.eml" };
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const actions = buildProductionSourceFileUploadActions({
      uploadInputRef: { current: null },
      setDragActive: vi.fn(),
      setIntakeFile,
      processIncomingProductionFile
    });

    actions.handleProductionFileSelection({ target } as never);

    expect(setIntakeFile).toHaveBeenCalledWith(file);
    expect(processIncomingProductionFile).toHaveBeenCalledWith(file, "email");
    expect(target.value).toBe("");
  });

  it("keeps empty file selections inert and preserves the input value", () => {
    const target = { files: [], value: "unchanged" };
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const actions = buildProductionSourceFileUploadActions({
      uploadInputRef: { current: null },
      setDragActive: vi.fn(),
      setIntakeFile,
      processIncomingProductionFile
    });

    actions.handleProductionFileSelection({ target } as never);

    expect(setIntakeFile).not.toHaveBeenCalled();
    expect(processIncomingProductionFile).not.toHaveBeenCalled();
    expect(target.value).toBe("unchanged");
  });
});
