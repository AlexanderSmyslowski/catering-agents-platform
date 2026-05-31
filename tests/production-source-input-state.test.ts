import { describe, expect, it } from "vitest";
import {
  buildProductionSourceInputActions,
  buildProductionSourceInputState,
  formatArchiveCurrentIntakeContextLabel,
  type ProductionSourceInputActionsInput
} from "../backoffice-ui/src/production-source-input-state.js";

describe("production source input state", () => {
  it("maps the production source input fields without changing references", () => {
    const file = { name: "angebot.pdf" } as File;

    const state = buildProductionSourceInputState({
      dragActive: true,
      intakeFile: file,
      intakeChannel: "pdf_upload",
      documentPhase: "analysing",
      activeDocumentName: "angebot.pdf",
      documentProgress: 42,
      documentEtaSeconds: 7,
      intakeText: "Lunch fuer 30 Personen",
      canClearWorkspace: true,
      canArchiveCurrentIntake: false,
      clearWorkspaceContextLabel: "Lunch · 30 Teilnehmer",
      archiveCurrentIntakeContextLabel: "Intake-Anfrage request-1"
    });

    expect(state).toEqual({
      dragActive: true,
      intakeFile: file,
      intakeChannel: "pdf_upload",
      documentPhase: "analysing",
      activeDocumentName: "angebot.pdf",
      documentProgress: 42,
      documentEtaSeconds: 7,
      intakeText: "Lunch fuer 30 Personen",
      canClearWorkspace: true,
      canArchiveCurrentIntake: false,
      clearWorkspaceContextLabel: "Lunch · 30 Teilnehmer",
      archiveCurrentIntakeContextLabel: "Intake-Anfrage request-1",
      clearWorkspaceTitle: "Lokalen Arbeitsbereich leeren: Lunch · 30 Teilnehmer",
      archiveCurrentIntakeTitle: "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
    });
    expect(state.intakeFile).toBe(file);
  });

  it("keeps optional document metadata undefined and clear/archive booleans independent", () => {
    const state = buildProductionSourceInputState({
      dragActive: false,
      intakeFile: null,
      intakeChannel: "text",
      documentPhase: "idle",
      documentProgress: 0,
      intakeText: "",
      canClearWorkspace: false,
      canArchiveCurrentIntake: true
    });

    expect(state.activeDocumentName).toBeUndefined();
    expect(state.documentEtaSeconds).toBeUndefined();
    expect(state.canClearWorkspace).toBe(false);
    expect(state.canArchiveCurrentIntake).toBe(true);
    expect(state.clearWorkspaceTitle).toBe("Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.");
    expect(state.archiveCurrentIntakeTitle).toBe("Aktiven Intake-Kontext per Soft-Archiv aus dem Fokus nehmen.");
  });

  it("keeps destructive action titles contextual when both actions are available", () => {
    const state = buildProductionSourceInputState({
      dragActive: false,
      intakeFile: null,
      intakeChannel: "pdf_upload",
      documentPhase: "idle",
      documentProgress: 0,
      intakeText: "",
      canClearWorkspace: true,
      canArchiveCurrentIntake: true,
      clearWorkspaceContextLabel: "Plan-Kontext plan-1",
      archiveCurrentIntakeContextLabel: "Intake-Anfrage request-1"
    });

    expect(state.clearWorkspaceTitle).toBe("Lokalen Arbeitsbereich leeren: Plan-Kontext plan-1");
    expect(state.archiveCurrentIntakeTitle).toBe(
      "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage request-1"
    );
  });

  it("formats archive context labels only for real intake request ids", () => {
    expect(
      formatArchiveCurrentIntakeContextLabel({
        currentIntakeRequestId: " request-123 "
      })
    ).toBe("Intake-Anfrage request-123");
    expect(formatArchiveCurrentIntakeContextLabel({ currentIntakeRequestId: "   " })).toBeUndefined();
    expect(formatArchiveCurrentIntakeContextLabel({})).toBeUndefined();
  });

  it("maps source input action references without wrapping callbacks", () => {
    const actions: ProductionSourceInputActionsInput = {
      uploadInputRef: { current: null },
      setDragActive: (_active) => undefined,
      setIntakeChannel: (_channel) => undefined,
      setIntakeText: (_value) => undefined,
      openFilePicker: () => undefined,
      clearWorkspace: () => undefined,
      archiveCurrentIntake: async () => undefined,
      handleDrop: () => undefined,
      handleFileSelection: () => undefined,
      submitDocument: async () => undefined,
      submitText: async () => undefined
    };

    expect(buildProductionSourceInputActions(actions)).toEqual(actions);
  });
});
