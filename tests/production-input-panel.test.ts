import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ProductionInputPanel,
  type ProductionManualInputActions,
  type ProductionManualInputValues,
  type ProductionSourceInputActions,
  type ProductionSourceInputValues
} from "../backoffice-ui/src/production-input-panel.js";

const noop = () => undefined;
const noopAsync = async () => undefined;

const manualInput: ProductionManualInputValues = {
  eventType: "",
  eventDate: "",
  attendeeCount: "",
  serviceForm: "",
  menuItems: "",
  customerName: "",
  venueName: "",
  notes: ""
};

const manualInputActions: ProductionManualInputActions = {
  setEventType: noop,
  setEventDate: noop,
  setAttendeeCount: noop,
  setServiceForm: noop,
  setMenuItems: noop,
  setCustomerName: noop,
  setVenueName: noop,
  setNotes: noop,
  submitManualSpec: noopAsync
};

const sourceInputActions: ProductionSourceInputActions = {
  uploadInputRef: { current: null },
  setDragActive: noop,
  setIntakeChannel: noop,
  setIntakeText: noop,
  openFilePicker: noop,
  clearWorkspace: noop,
  archiveCurrentIntake: noopAsync,
  handleDrop: noop,
  handleFileSelection: noop,
  submitDocument: noopAsync,
  submitText: noopAsync
};

function buildSourceInput(overrides?: Partial<ProductionSourceInputValues>): ProductionSourceInputValues {
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

function renderPanel(sourceInput: ProductionSourceInputValues): string {
  return renderToStaticMarkup(
    createElement(ProductionInputPanel, {
      submitting: false,
      sourceInput,
      sourceInputActions,
      manualInput,
      manualInputActions
    })
  );
}

describe("production input panel", () => {
  it("keeps workspace actions contextual for rehearsal cleanup", () => {
    const markup = renderPanel(
      buildSourceInput({
        canClearWorkspace: true,
        canArchiveCurrentIntake: true,
        clearWorkspaceContextLabel: "Lunch · 30 Teilnehmer · 2026-06-18",
        archiveCurrentIntakeContextLabel: "Intake-Anfrage request-123",
        clearWorkspaceTitle: "Lokalen Arbeitsbereich leeren: Lunch · 30 Teilnehmer · 2026-06-18",
        archiveCurrentIntakeTitle:
          "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage request-123"
      })
    );

    expect(markup).toContain("Arbeitsbereich lokal leeren");
    expect(markup).toContain("für Lunch · 30 Teilnehmer · 2026-06-18");
    expect(markup).toContain("Fehlupload archivieren");
    expect(markup).toContain("für Intake-Anfrage request-123");
    expect(markup).toContain('title="Lokalen Arbeitsbereich leeren: Lunch · 30 Teilnehmer · 2026-06-18"');
    expect(markup).toContain(
      'title="Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage request-123"'
    );
  });

  it("keeps disabled destructive actions explainable without changing visible copy", () => {
    const markup = renderPanel(buildSourceInput());

    expect(markup).toContain('title="Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren."');
    expect(markup).toContain('title="Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Arbeitsbereich lokal leeren<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Fehlupload archivieren<\/button>/);
  });

  it("keeps the document retry action inactive until a file is available", () => {
    const markup = renderPanel(buildSourceInput());

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Erneut mit ausgewähltem Typ verarbeiten<\/button>/);
  });

  it("keeps the document retry action available for a retained failed file", () => {
    const markup = renderPanel(
      buildSourceInput({
        intakeFile: { name: "problemangebot.pdf" } as File
      })
    );

    expect(markup).toContain("Ausgewählt: problemangebot.pdf");
    expect(markup).toMatch(/<button(?:(?!disabled).)*>Erneut mit ausgewähltem Typ verarbeiten<\/button>/);
  });
});
