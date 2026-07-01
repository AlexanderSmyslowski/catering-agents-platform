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

function renderPanel(
  sourceInput: ProductionSourceInputValues,
  uploadResultSpec?: Record<string, unknown>
): string {
  return renderToStaticMarkup(
    createElement(ProductionInputPanel, {
      submitting: false,
      sourceInput,
      sourceInputActions,
      uploadResultSpec,
      manualInput,
      manualInputActions
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
    expect(markup).toContain("Anfrage als Datei übernehmen");
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
    expect(rejectedMarkup).not.toContain("Analyse abgeschlossen");
    expect(analysingMarkup).toContain("Ausgewählt: anfrage.pdf");
    expect(analysingMarkup).toContain("Analyse läuft für anfrage.pdf");
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

  it("shows the accepted production data directly after a completed upload", () => {
    const markup = renderPanel(
      buildSourceInput({
        documentPhase: "done",
        activeDocumentName: "angebot.pdf",
        documentProgress: 100,
        uploadResultSpec: {
          event: { type: "conference", date: "2026-09-03" },
          attendees: { expected: 90 },
          servicePlan: { serviceForm: "buffet" },
          readiness: { status: "partial" },
          menuPlan: [
            {
              componentId: "tarte",
              label: "Tortilla-Tarte",
              menuCategory: "vegetarian",
              productionDecision: {
                mode: "hybrid",
                purchasedElements: ["Mini-Tarteböden"]
              }
            }
          ],
          uncertainties: [
            {
              field: "event.schedule",
              suggestedQuestion: "Wie lautet das verbindliche Zeitfenster?"
            }
          ],
          assumptions: [
            {
              message: "Serviceform aus dem Anfragetext abgeleitet: Buffet."
            }
          ]
        }
      }),
      {
        event: { type: "meeting", date: "2026-01-01" },
        attendees: { expected: 12 },
        servicePlan: { serviceForm: "coffee_break" },
        readiness: { status: "complete" },
        menuPlan: [{ componentId: "stale", label: "Alter Vorgang" }]
      }
    );

    expect(markup).toContain("Analyse abgeschlossen für angebot.pdf.");
    expect(markup).toContain("Erkannte Produktionsdaten");
    expect(markup).toContain("Verständnis des Angebots");
    expect(markup).toContain("production-input-panel--completed");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toContain("progress-ring--done");
    expect(markup).not.toContain(">100%</span>");
    expect(markup).not.toContain("Drag & Drop");
    expect(markup).not.toContain("Anfrage als Datei übernehmen");
    expect(markup).toContain("Konferenz · Datum: 2026-09-03 · 90 Personen · Buffet");
    expect(markup).not.toContain("Alter Vorgang");
    expect(markup).toContain("Tortilla-Tarte");
    expect(markup).toContain("Kategorie: Vegetarisch · Herstellung: Hybrid · Zukauf: Mini-Tarteböden");
    expect(markup).toContain("Produktionsstand");
    expect(markup).toContain("Mengenkalkulation: wartet auf Berechnung");
    expect(markup).toContain("Rezeptkarten: warten auf Rezeptzuordnung");
    expect(markup).toContain("Einkaufsliste: wartet auf Berechnung");
    expect(markup).toContain("Wie lautet das verbindliche Zeitfenster?");
    expect(markup).toContain("Serviceform aus dem Anfragetext abgeleitet: Buffet.");
    expect(markup).toContain("Nächster Schritt: Rückfragen beantworten, dann Berechnung starten.");
  });
});
