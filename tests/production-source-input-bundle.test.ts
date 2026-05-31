import { describe, expect, it } from "vitest";
import {
  buildProductionSourceInputBundle,
  type ProductionSourceInputBundleInput
} from "../backoffice-ui/src/production-source-input-bundle.js";

function input(
  overrides: Partial<ProductionSourceInputBundleInput> = {}
): ProductionSourceInputBundleInput {
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
    setDragActive: (_active) => undefined,
    setIntakeChannel: (_channel) => undefined,
    setIntakeText: (_value) => undefined,
    openFilePicker: () => undefined,
    clearWorkspace: () => undefined,
    archiveCurrentIntake: async () => undefined,
    handleDrop: () => undefined,
    handleFileSelection: () => undefined,
    submitDocument: async () => undefined,
    submitText: async () => undefined,
    ...overrides
  };
}

describe("production source input bundle", () => {
  it("builds source input state and actions as one App boundary cluster", () => {
    const uploadInputRef = { current: null };
    const openFilePicker = () => undefined;
    const submitText = async () => undefined;
    const bundle = buildProductionSourceInputBundle(
      input({
        dragActive: true,
        intakeChannel: "email",
        documentPhase: "done",
        activeDocumentName: "angebot.eml",
        documentProgress: 100,
        intakeText: "Kaffeepause fuer 20 Personen",
        canClearWorkspace: true,
        canArchiveCurrentIntake: true,
        clearWorkspaceContextLabel: "Plan-Kontext plan-1",
        archiveCurrentIntakeContextLabel: "Intake-Anfrage request-1",
        uploadInputRef,
        openFilePicker,
        submitText
      })
    );

    expect(bundle.productionSourceInput).toMatchObject({
      dragActive: true,
      intakeChannel: "email",
      documentPhase: "done",
      activeDocumentName: "angebot.eml",
      documentProgress: 100,
      intakeText: "Kaffeepause fuer 20 Personen",
      clearWorkspaceTitle: "Lokalen Arbeitsbereich leeren: Plan-Kontext plan-1",
      archiveCurrentIntakeTitle:
        "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage request-1"
    });
    expect(bundle.productionSourceInputActions.uploadInputRef).toBe(uploadInputRef);
    expect(bundle.productionSourceInputActions.openFilePicker).toBe(openFilePicker);
    expect(bundle.productionSourceInputActions.submitText).toBe(submitText);
  });
});
