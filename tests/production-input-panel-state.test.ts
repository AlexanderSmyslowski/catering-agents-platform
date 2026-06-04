import { describe, expect, it } from "vitest";
import { buildProductionInputPanelState } from "../backoffice-ui/src/production-input-panel-state.js";
import type { ProductionSourceInputValues } from "../backoffice-ui/src/production-input-panel.js";

function sourceInput(
  overrides: Partial<ProductionSourceInputValues> = {}
): ProductionSourceInputValues {
  return {
    dragActive: false,
    intakeFile: null,
    intakeChannel: "pdf_upload",
    documentPhase: "idle",
    documentProgress: 0,
    intakeText: "",
    canClearWorkspace: false,
    canArchiveCurrentIntake: false,
    clearWorkspaceTitle: "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.",
    archiveCurrentIntakeTitle: "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.",
    ...overrides
  };
}

describe("production input panel state", () => {
  it("keeps destructive and retry actions disabled when no active workspace or file exists", () => {
    expect(
      buildProductionInputPanelState({
        submitting: false,
        sourceInput: sourceInput()
      })
    ).toMatchObject({
      clearWorkspaceDisabled: true,
      archiveCurrentIntakeDisabled: true,
      submitDocumentDisabled: true,
      selectedFileName: undefined,
      showAnalysingProgress: false,
      showCompletedProgress: false,
      documentEtaLabel: "weniger als 1 Sekunde"
    });
  });

  it("keeps a retained file retryable and surfaces analysing progress with the eta label", () => {
    expect(
      buildProductionInputPanelState({
        submitting: false,
        sourceInput: sourceInput({
          intakeFile: { name: "angebot.pdf" } as File,
          documentPhase: "analysing",
          activeDocumentName: "angebot.pdf",
          documentEtaSeconds: 7,
          canClearWorkspace: true,
          canArchiveCurrentIntake: true
        })
      })
    ).toMatchObject({
      clearWorkspaceDisabled: false,
      archiveCurrentIntakeDisabled: false,
      submitDocumentDisabled: false,
      selectedFileName: "angebot.pdf",
      showAnalysingProgress: true,
      showCompletedProgress: false,
      documentEtaLabel: "7 Sekunden"
    });
  });

  it("shows the completed progress state only after a named document finished", () => {
    expect(
      buildProductionInputPanelState({
        submitting: false,
        sourceInput: sourceInput({
          documentPhase: "done",
          activeDocumentName: "angebot.eml"
        })
      })
    ).toMatchObject({
      showAnalysingProgress: false,
      showCompletedProgress: true
    });
  });
});
