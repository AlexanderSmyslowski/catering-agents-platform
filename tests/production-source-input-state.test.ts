import { describe, expect, it } from "vitest";
import {
  buildProductionSourceInputActions,
  buildProductionSourceInputState,
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
      archiveCurrentIntakeContextLabel: "Intake-Anfrage request-1"
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
