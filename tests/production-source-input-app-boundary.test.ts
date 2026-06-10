import { describe, expect, it, vi } from "vitest";
import {
  buildProductionSourceInputAppBoundary,
  type ProductionSourceInputAppBoundaryInput
} from "../backoffice-ui/src/production-source-input-app-boundary.js";
import { PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES } from "../backoffice-ui/src/production-document-upload-limit.js";

function input(
  overrides: Partial<ProductionSourceInputAppBoundaryInput> = {}
): ProductionSourceInputAppBoundaryInput {
  return {
    dragActive: false,
    intakeFile: null,
    intakeChannel: "pdf_upload",
    documentPhase: "idle",
    documentProgress: 0,
    intakeText: "",
    canClearWorkspace: false,
    canArchiveCurrentIntake: false,
    uploadInputRef: { current: null },
    setDragActive: vi.fn(),
    setIntakeChannel: vi.fn(),
    setIntakeText: vi.fn(),
    setIntakeFile: vi.fn(),
    processIncomingProductionFile: vi.fn(),
    clearWorkspace: vi.fn(),
    archiveCurrentIntake: vi.fn(),
    submitDocument: vi.fn(),
    submitText: vi.fn(),
    ...overrides
  };
}

describe("production source input app boundary", () => {
  it("builds the source input bundle with generated file actions", () => {
    const uploadInputRef = { current: { click: vi.fn() } as unknown as HTMLInputElement };
    const setDragActive = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const bundle = buildProductionSourceInputAppBoundary(
      input({
        dragActive: true,
        intakeChannel: "email",
        documentPhase: "analysing",
        activeDocumentName: "auftrag.eml",
        documentProgress: 25,
        intakeText: "Lunch fuer 20 Personen",
        canClearWorkspace: true,
        canArchiveCurrentIntake: true,
        clearWorkspaceContextLabel: "Plan-Kontext plan-1",
        archiveCurrentIntakeContextLabel: "Intake-Anfrage request-1",
        uploadInputRef,
        setDragActive,
        setIntakeFile,
        processIncomingProductionFile
      })
    );

    expect(bundle.productionSourceInput).toMatchObject({
      dragActive: true,
      intakeChannel: "email",
      documentPhase: "analysing",
      activeDocumentName: "auftrag.eml",
      documentProgress: 25,
      intakeText: "Lunch fuer 20 Personen",
      clearWorkspaceTitle: "Lokalen Arbeitsbereich leeren: Plan-Kontext plan-1",
      archiveCurrentIntakeTitle:
        "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage request-1"
    });

    bundle.productionSourceInputActions.openFilePicker();

    expect(uploadInputRef.current.click).toHaveBeenCalledOnce();
  });

  it("routes drop and file-selection actions through the existing upload action builder", () => {
    const droppedFile = new File(["pdf"], "angebot.pdf", { type: "application/pdf" });
    const selectedFile = new File(["mail"], "auftrag.eml", { type: "message/rfc822" });
    const setDragActive = vi.fn();
    const setIntakeFile = vi.fn();
    const processIncomingProductionFile = vi.fn();
    const bundle = buildProductionSourceInputAppBoundary(
      input({
        setDragActive,
        setIntakeFile,
        processIncomingProductionFile
      })
    );
    const preventDefault = vi.fn();
    const target = { files: [selectedFile], value: "C:\\fakepath\\auftrag.eml" };

    bundle.productionSourceInputActions.handleDrop({
      preventDefault,
      dataTransfer: { files: [droppedFile] }
    } as never);
    bundle.productionSourceInputActions.handleFileSelection({ target } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(setDragActive).toHaveBeenCalledWith(false);
    expect(setIntakeFile).toHaveBeenNthCalledWith(1, droppedFile);
    expect(processIncomingProductionFile).toHaveBeenNthCalledWith(1, droppedFile, "pdf_upload");
    expect(setIntakeFile).toHaveBeenNthCalledWith(2, selectedFile);
    expect(processIncomingProductionFile).toHaveBeenNthCalledWith(2, selectedFile, "email");
    expect(target.value).toBe("");
  });

  it("rejects oversized file selections without starting document processing", () => {
    const oversizedFile = {
      name: "kundenanfrage.pdf",
      type: "application/pdf",
      size: PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES + 1
    } as File;
    const calls: string[] = [];
    const bundle = buildProductionSourceInputAppBoundary(
      input({
        setDragActive: vi.fn((active) => {
          calls.push(`setDragActive:${active}`);
        }),
        setIntakeFile: vi.fn((file) => {
          calls.push(`setIntakeFile:${file?.name ?? "none"}`);
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
      })
    );
    const target = { files: [oversizedFile], value: "C:\\fakepath\\kundenanfrage.pdf" };

    bundle.productionSourceInputActions.handleFileSelection({ target } as never);

    expect(calls).toEqual([
      "setDragActive:false",
      "setIntakeFile:none",
      "resetDocumentProgress",
      "clearMessages",
      "setError:Die Datei ist zu groß. Maximal erlaubt sind 25 MB."
    ]);
    expect(target.value).toBe("");
  });
});
