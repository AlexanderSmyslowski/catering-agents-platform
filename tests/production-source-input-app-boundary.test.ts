import { describe, expect, it, vi } from "vitest";
import {
  buildProductionSourceInputAppBoundary,
  type ProductionSourceInputAppBoundaryInput
} from "../backoffice-ui/src/production-source-input-app-boundary.js";

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
});
