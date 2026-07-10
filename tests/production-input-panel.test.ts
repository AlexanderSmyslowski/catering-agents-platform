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
    hasActiveProductionContext?: boolean;
    productionQuestions?: string[];
    productionAssumptions?: string[];
    intakeRequestDetail?: Parameters<typeof ProductionInputPanel>[0]["intakeRequestDetail"];
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

    expect(markup).toContain("Angebot als KI-Entwurf prüfen");
    expect(markup).toContain("Unterstützt PDF, E-Mail und Textdateien bis 25 MB");
    expect(markup).toContain("Datei auswählen");
    expect(markup).toContain("Nach der Auswahl erstellt die verbundene KI einen prüfpflichtigen Entwurf.");
    expect(markup.match(/Angebot als KI-Entwurf prüfen/g)).toHaveLength(1);
    expect(markup).not.toContain('aria-label="Quellentyp"');
    expect(markup).toContain("Weitere Eingabe ohne Datei");
    expect(markup).toContain("Text auswerten");
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
    expect(analysingMarkup).toContain("KI liest anfrage.pdf und erstellt den Entwurf");
  });

  it("keeps the completed upload surface compact even before recognized data is available", () => {
    const markup = renderPanel(
      buildSourceInput({
        documentPhase: "done",
        activeDocumentName: "Angebot_Koepff.pdf",
        documentProgress: 100
      })
    );

    expect(markup).toContain("Weitere Anfrage übernehmen");
    expect(markup).toContain("Der aktuelle Vorgang bleibt im Arbeitsbereich sichtbar.");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('hidden=""');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("KI-Entwurf erstellt für Angebot_Koepff.pdf.");
    expect(markup).toContain("Der KI-Entwurf wartet auf deine Prüfung; noch keine Produktionsdaten wurden übernommen.");
    expect(markup).not.toContain(
      "Erkannte Daten und Rückfragen wurden aktualisiert; Berechnung und Artefakte folgen erst nach Freigabe."
    );
    expect(markup).toContain("KI-Entwurf prüfen");
    expect(markup).toContain("Noch nichts wurde übernommen oder freigegeben.");
    expect(markup).toContain("Keine Produktionsentwürfe zur Prüfung.");
    expect(markup).not.toContain("Noch keine Produktionsdaten erkannt");
    expect(markup).not.toContain("Erkannte Komponenten und Prüfpunkte anzeigen");
    expect(markup).not.toContain("Datei hier ablegen oder Dateiauswahl öffnen");
    expect(markup).not.toContain("progress-ring--done");
    expect(markup).toContain('class="secondary-workspace production-secondary-inputs"');
    expect(markup).not.toContain('class="secondary-workspace production-secondary-inputs" open=""');
  });

  it("keeps the file import surface visible when production data is already in focus", () => {
    const markup = renderPanel(
      buildSourceInput(),
      {
        focusedProductionSpec: {
          event: { type: "reception", date: "2026-06-14" },
          attendees: { expected: 45 },
          servicePlan: { serviceForm: "buffet" },
          readiness: { status: "partial" },
          menuPlan: [{ componentId: "vitello", label: "Vitello tonnato" }]
        }
      }
    );

    expect(markup).toContain("Angebot als KI-Entwurf prüfen");
    expect(markup).toContain("Datei hier ablegen oder Dateiauswahl öffnen");
    expect(markup).not.toContain("Analyse abgeschlossen");
    expect(markup).toContain('class="secondary-workspace production-secondary-inputs"');
    expect(markup).not.toContain('class="secondary-workspace production-secondary-inputs" open=""');
  });

  it("keeps the file import surface visible when plan artifacts are the active context", () => {
    const markup = renderPanel(
      buildSourceInput(),
      {
        hasActiveProductionContext: true
      }
    );

    expect(markup).toContain("Angebot als KI-Entwurf prüfen");
    expect(markup).toContain("Datei hier ablegen oder Dateiauswahl öffnen");
    expect(markup).toContain('class="secondary-workspace production-secondary-inputs"');
    expect(markup).not.toContain('class="secondary-workspace production-secondary-inputs" open=""');
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

    expect(markup).toContain("Lokale Hilfen");
    expect(markup).toContain("nur für Demo- und Fehlupload-Fälle");
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

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>KI-Entwurf erstellen<\/button>/);
  });

  it("keeps the document retry action available for a retained failed file", () => {
    const markup = renderPanel(
      buildSourceInput({
        intakeFile: { name: "problemangebot.pdf" } as File
      })
    );

    expect(markup).toContain("Ausgewählt: problemangebot.pdf");
    expect(markup).toMatch(/<button(?:(?!disabled).)*>KI-Entwurf erstellen<\/button>/);
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

    expect(markup).toContain("KI-Entwurf erstellt für Angebot_Koepff.pdf.");
    expect(markup).toContain(
      "Erkannte Daten und Rückfragen wurden aktualisiert; Berechnung und Artefakte folgen erst nach Freigabe."
    );
    expect(markup).toContain("Weitere Anfrage übernehmen");
    expect(markup).toContain("Der aktuelle Vorgang bleibt im Arbeitsbereich sichtbar.");
    expect(markup).not.toContain("Datei hier ablegen oder Dateiauswahl öffnen");
    expect(markup).not.toContain("progress-ring--done");
    expect(markup).toContain("KI-Entwurf prüfen");
    expect(markup).toContain("Noch nichts ist berechnet oder freigegeben.");
    expect(markup).toContain("Eventtyp: Konferenz · Datum: 2026-09-03");
    expect(markup).toContain("Teilnehmerzahl: 90 · Serviceform: Buffet");
    expect(markup).toContain("Sofortübersicht Produktionsdaten");
    expect(markup).toContain("2 Komponenten erkannt");
    expect(markup).toContain("2 offene Punkte");
    expect(markup).toContain("noch nicht berechnet");
    expect(markup).toContain("2 Rückfragen beantworten");
    expect(markup).toContain("Beantworte die offenen Punkte direkt im Rückfragenbereich.");
    expect(markup).toContain('href="#production-question-panel"');
    expect(markup).toContain('class="upload-result-review-details"');
    expect(markup).toContain("Erkannte Komponenten und Prüfpunkte anzeigen");
    expect(markup).not.toContain('<details class="upload-result-review-details" open="">');
    expect(markup).toContain("Gerichte und Komponenten:");
    expect(markup).toContain("Lunchbuffet");
    expect(markup).toContain("Kaffeestation");
    expect(markup).toContain("Offen vor Produktion:");
    expect(markup).toContain("Lunchbuffet: Herstellungsentscheidung fehlt.");
    expect(markup).toContain("Vorprüfung vor Berechnung:");
    expect(markup).toContain("Personenzahl");
    expect(markup).toContain("90 Personen erkannt.");
    expect(markup).toContain("Eigenproduktion und Zukauf");
    expect(markup).toContain("Offen: Herstellungsentscheidungen fehlen.");
    expect(markup).toContain("Prüfen: kein Preisrahmen für wirtschaftliche Plausibilität erkannt.");
    expect(markup).toContain("Berechnung starten");
    expect(markup).toContain("Noch nicht freigegeben: offene Punkte zuerst klären.");
    expect(markup).toContain("Annahmen:");
    expect(markup).toContain("Stand der Produktionsartefakte:");
    expect(markup).toContain("Erkannt: Eckdaten, Gerichte/Komponenten, Rückfragen und Annahmen.");
    expect(markup).toContain("Noch nicht berechnet: Mengen, Rezeptkarten, Einkaufsliste und Produktionsmappe.");
    expect(markup).toContain('class="secondary-workspace production-secondary-inputs"');
    expect(markup).not.toContain('class="secondary-workspace production-secondary-inputs" open=""');
  });

  it("shows safe source warnings after uncertain document ingestion", () => {
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
          menuPlan: [{ componentId: "lunch", label: "Lunchbuffet" }]
        },
        intakeRequestDetail: {
          requestId: "request-upload-1",
          rawInputs: [
            {
              kind: "pdf",
              content: "%PDF Rohinhalt darf nicht sichtbar werden",
              documentId: "document-upload-1",
              sourceMetadata: {
                filename: "Angebot_Koepff.pdf"
              },
              documentIngestion: {
                status: "fallback",
                warnings: ["document_text_extraction_fallback"]
              }
            }
          ]
        }
      }
    );

    expect(markup).toContain("Quellenprüfung:");
    expect(markup).toContain(
      "Quelle: Angebot_Koepff.pdf · Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    );
    expect(markup).toContain("Quelle prüfen");
    expect(markup).toContain("Zur Quellenprüfung");
    expect(markup).not.toContain("%PDF Rohinhalt");
  });
});
