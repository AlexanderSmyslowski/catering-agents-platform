import { describe, expect, it, vi } from "vitest";
import { buildProductionWindowFileActions } from "../backoffice-ui/src/production-window-file-actions.js";

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
