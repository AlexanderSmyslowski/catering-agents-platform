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

function renderPanelWithSummary(sourceInput: ProductionSourceInputValues): string {
  return renderToStaticMarkup(
    createElement(ProductionInputPanel, {
      submitting: false,
      sourceInput,
      sourceInputActions,
      manualInput,
      manualInputActions,
      uploadResultSummary: {
        statusLabel: "Anfrage erfasst. Produktionsdaten prüfen.",
        helperLabel: "Noch keine Produktionsfreigabe.",
        facts: [
          { label: "Anlass", value: "Konferenz" },
          { label: "Personen", value: "90 Teilnehmer" }
        ],
        menuItems: ["Lunchbuffet · Klassisch · Hybrid"],
        openItems: ["1 Rückfrage offen", "Produktionsplan noch nicht berechnet."],
        nextStepLabel: "Rückfragen beantworten: Offene Angaben prüfen."
      }
    })
  );
}

describe("production input panel", () => {
  it("uses operator-facing request copy for the file import card", () => {
    const markup = renderPanel(buildSourceInput());

    expect(markup).toContain("Anfrageeingang");
    expect(markup).toContain("Kundenanfrage übernehmen");
    expect(markup).toContain("Maximal 25 MB");
    expect(markup).toContain("Der Inhalt wird als Catering-Anfrage erfasst.");
    expect(markup).toContain("Datei auswählen");
    expect(markup).toContain("Nach der Auswahl erscheint der Dateiname hier");
    expect(markup).not.toContain("Anfrage als Datei übernehmen");
    expect(markup).not.toContain("upload-shortcut-bar");
    expect(markup).toContain("PDF / Anfrage");
    expect(markup).not.toContain("Intake-Pfad");
    expect(markup).not.toContain("Chat-Eingang");
    expect(markup).not.toContain("Angebotsdatei auswählen");
    expect(markup).not.toContain("+ Angebot hinzufügen");
    expect(markup).not.toContain("+ Angebot auswählen");
  });

  it("keeps progress visible only for accepted processing states", () => {
    const rejectedMarkup = renderPanel(
      buildSourceInput({
        intakeFile: { name: "zu-gross.pdf" } as File,
        documentPhase: "idle",
        activeDocumentName: undefined,
        documentProgress: 0
      })
    );
    const analysingMarkup = renderPanel(
      buildSourceInput({
        intakeFile: { name: "anfrage.pdf" } as File,
        documentPhase: "analysing",
        activeDocumentName: "anfrage.pdf",
        documentProgress: 32,
        documentEtaSeconds: 4
      })
    );

    expect(rejectedMarkup).toContain("Ausgewählt: zu-gross.pdf");
    expect(rejectedMarkup).not.toContain("Analyse läuft");
    expect(rejectedMarkup).not.toContain("Datei erfasst");
    expect(analysingMarkup).toContain("Ausgewählt: anfrage.pdf");
    expect(analysingMarkup).toContain("Analyse läuft für anfrage.pdf");
  });

  it("shows operator-facing production data after a completed upload", () => {
    const markup = renderPanelWithSummary(
      buildSourceInput({
        documentPhase: "done",
        activeDocumentName: "Angebot_Köpff_2.pdf",
        documentProgress: 100
      })
    );

    expect(markup).toContain("Anfrage erfasst. Produktionsdaten prüfen.");
    expect(markup).toContain("Datei erfasst: Angebot_Köpff_2.pdf.");
    expect(markup).toContain("Produktionsdaten aus Datei");
    expect(markup).toContain("Konferenz");
    expect(markup).toContain("90 Teilnehmer");
    expect(markup).toContain("Lunchbuffet · Klassisch · Hybrid");
    expect(markup).toContain("Offen vor Produktion");
    expect(markup).toContain("Nächster Schritt:");
    expect(markup).not.toContain("GPT");
  });

  it("keeps workspace actions separated as local demo maintenance", () => {
    const markup = renderPanel(
      buildSourceInput({
        canClearWorkspace: true,
        canArchiveCurrentIntake: true,
        clearWorkspaceContextLabel: "Lunch · 30 Teilnehmer · 2026-06-18",
        archiveCurrentIntakeContextLabel: "Intake-Anfrage im Fokus",
        clearWorkspaceTitle: "Lokalen Arbeitsbereich leeren: Lunch · 30 Teilnehmer · 2026-06-18",
        archiveCurrentIntakeTitle:
          "Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage im Fokus"
      })
    );

    expect(markup).toContain("Demo-/Wartungsaktionen");
    expect(markup).toContain("Diese Aktionen sind nur für lokale Demo- und Korrekturfälle.");
    expect(markup).toContain("Demo-Arbeitsstand zurücksetzen");
    expect(markup).toContain("für Lunch · 30 Teilnehmer · 2026-06-18");
    expect(markup).toContain("Fehlgeschlagenen Demo-Upload ausblenden");
    expect(markup).toContain("für Intake-Anfrage im Fokus");
    expect(markup).toContain('title="Lokalen Arbeitsbereich leeren: Lunch · 30 Teilnehmer · 2026-06-18"');
    expect(markup).toContain(
      'title="Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: Intake-Anfrage im Fokus"'
    );
  });

  it("keeps disabled destructive actions explainable without changing visible copy", () => {
    const markup = renderPanel(buildSourceInput());

    expect(markup).toContain('title="Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren."');
    expect(markup).toContain('title="Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Demo-Arbeitsstand zurücksetzen<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Fehlgeschlagenen Demo-Upload ausblenden<\/button>/);
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
