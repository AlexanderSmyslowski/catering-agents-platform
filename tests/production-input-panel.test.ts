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
  overrides: {
    focusedProductionSpec?: Record<string, unknown>;
    productionQuestions?: string[];
    productionAssumptions?: string[];
  } = {}
): string {
  return renderToStaticMarkup(
    createElement(ProductionInputPanel, {
      submitting: false,
      sourceInput,
      sourceInputActions,
      manualInput,
      manualInputActions,
      ...overrides
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
    expect(markup).toContain("Weitere Eingaben oder Korrektur");
    expect(markup).toContain('class="secondary-workspace production-secondary-inputs" open=""');
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

  it("shows the recognized production data directly after document analysis", () => {
    const markup = renderPanel(
      buildSourceInput({
        documentPhase: "done",
        activeDocumentName: "Angebot_Koepff.pdf",
        documentProgress: 100
      }),
      {
        focusedProductionSpec: {
          event: { type: "conference", date: "2026-09-03" },
          attendees: { expected: 90 },
          servicePlan: { serviceForm: "buffet" },
          readiness: { status: "partial" },
          menuPlan: [
            {
              componentId: "lunch",
              label: "Lunchbuffet",
              menuCategory: "classic",
              productionDecision: { mode: "scratch" }
            },
            {
              componentId: "coffee",
              label: "Kaffeestation"
            }
          ]
        },
        productionQuestions: [
          "Lunchbuffet: Herstellungsentscheidung fehlt.",
          "Kaffeestation: Kategorie fehlt."
        ],
        productionAssumptions: ["Serviceform als Buffet abgeleitet."]
      }
    );

    expect(markup).toContain("Analyse abgeschlossen für Angebot_Koepff.pdf.");
    expect(markup).toContain(
      "Erkannte Daten und Rückfragen wurden aktualisiert; Berechnung und Artefakte folgen erst nach Freigabe."
    );
    expect(markup).toContain("Erkannte Produktionsdaten");
    expect(markup).toContain("Eventtyp: Konferenz · Datum: 2026-09-03");
    expect(markup).toContain("Teilnehmerzahl: 90 · Serviceform: Buffet");
    expect(markup).toContain("Gerichte und Komponenten:");
    expect(markup).toContain("Lunchbuffet");
    expect(markup).toContain("Kaffeestation");
    expect(markup).toContain("Offen vor Produktion:");
    expect(markup).toContain("Lunchbuffet: Herstellungsentscheidung fehlt.");
    expect(markup).toContain("Annahmen:");
    expect(markup).toContain("Stand der Produktionsartefakte:");
    expect(markup).toContain("Erkannt: Eckdaten, Gerichte/Komponenten, Rückfragen und Annahmen.");
    expect(markup).toContain("Noch nicht berechnet: Mengen, Rezeptkarten, Einkaufsliste und Produktionsmappe.");
    expect(markup).toContain("Nächster Schritt: Rückfragen beantworten, dann Berechnung starten.");
    expect(markup).toContain('class="secondary-workspace production-secondary-inputs"');
    expect(markup).not.toContain('class="secondary-workspace production-secondary-inputs" open=""');
  });
});
