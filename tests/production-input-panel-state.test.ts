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
      submitTextDisabled: true,
      selectedFileName: undefined,
      showAnalysingProgress: false,
      showCompletedProgress: false,
      documentEtaLabel: "weniger als 1 Sekunde",
      uploadResultSummary: undefined
    });
  });

  it("only enables text evaluation for meaningful input", () => {
    expect(
      buildProductionInputPanelState({
        submitting: false,
        sourceInput: sourceInput({ intakeText: " \n\t " })
      }).submitTextDisabled
    ).toBe(true);
    expect(
      buildProductionInputPanelState({
        submitting: false,
        sourceInput: sourceInput({ intakeText: "Lunch fuer 40 Personen." })
      }).submitTextDisabled
    ).toBe(false);
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
      showCompletedProgress: true,
      completedProgressHelperLabel: "Der KI-Entwurf wartet auf deine Prüfung; noch keine Produktionsdaten wurden übernommen."
    });
  });

  it("does not synthesize a product summary before a draft was approved", () => {
    const summary = buildProductionInputPanelState({
      submitting: false,
      sourceInput: sourceInput({
        documentPhase: "done",
        activeDocumentName: "angebot.pdf"
      })
    }).uploadResultSummary;

    expect(summary).toBeUndefined();
  });

  it("builds a compact visible production summary after document analysis", () => {
    const state = buildProductionInputPanelState({
      submitting: false,
      sourceInput: sourceInput({
        documentPhase: "done",
        activeDocumentName: "angebot.pdf"
      }),
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
    });

    expect(state.completedProgressHelperLabel).toBe(
      "Erkannte Daten und Rückfragen wurden aktualisiert; Berechnung und Artefakte folgen erst nach Freigabe."
    );
    expect(state.uploadResultSummary).toEqual({
      eventLabel: "Eventtyp: Konferenz · Datum: 2026-09-03",
      summaryLabel: "Teilnehmerzahl: 90 · Serviceform: Buffet",
      snapshotItems: [
        {
          key: "menu",
          label: "Gerichte",
          value: "2 Komponenten erkannt",
          status: "checked"
        },
        {
          key: "open-items",
          label: "Offen",
          value: "2 offene Punkte",
          status: "open"
        },
        {
          key: "source",
          label: "Quelle",
          value: "keine Warnung",
          status: "checked"
        },
        {
          key: "artifacts",
          label: "Artefakte",
          value: "noch nicht berechnet",
          status: "open"
        }
      ],
      menuItems: [
        {
          key: "lunch",
          label: "Lunchbuffet",
          detailLabel: "Klassisch · Eigenproduktion"
        },
        {
          key: "coffee",
          label: "Kaffeestation",
          detailLabel: "Kategorie offen · Herstellungsart offen"
        }
      ],
      openItems: [
        "Lunchbuffet: Herstellungsentscheidung fehlt.",
        "Kaffeestation: Kategorie fehlt."
      ],
      assumptionItems: ["Serviceform als Buffet abgeleitet."],
      preflightItems: [
        {
          key: "attendees",
          label: "Personenzahl",
          detailLabel: "90 Personen erkannt.",
          status: "checked"
        },
        {
          key: "timing",
          label: "Datum und Zeitfenster",
          detailLabel: "Datum erkannt: 2026-09-03.",
          status: "checked"
        },
        {
          key: "service-form",
          label: "Serviceform",
          detailLabel: "Serviceform erkannt.",
          status: "checked"
        },
        {
          key: "menu",
          label: "Gerichte und Komponenten",
          detailLabel: "2 Komponenten erkannt.",
          status: "checked"
        },
        {
          key: "production-decision",
          label: "Eigenproduktion und Zukauf",
          detailLabel: "Offen: Herstellungsentscheidungen fehlen.",
          status: "open"
        },
        {
          key: "budget",
          label: "Preisrahmen",
          detailLabel: "Prüfen: kein Preisrahmen für wirtschaftliche Plausibilität erkannt.",
          status: "review"
        },
        {
          key: "source",
          label: "Quelle und Lesbarkeit",
          detailLabel: "Keine Dokumentwarnung im aktuellen Intake-Detail.",
          status: "checked"
        },
        {
          key: "calculation-release",
          label: "Berechnung starten",
          detailLabel: "Noch nicht freigegeben: offene Punkte zuerst klären.",
          status: "open"
        }
      ],
      artifactStatusItems: [
        "Erkannt: Eckdaten, Gerichte/Komponenten, Rückfragen und Annahmen.",
        "Noch nicht berechnet: Mengen, Rezeptkarten, Einkaufsliste und Produktionsmappe."
      ],
      sourceCheckItems: [],
      nextStepLabel: "Nächster Schritt: Rückfragen beantworten, dann Berechnung starten."
    });
  });

  it("surfaces document ingestion warnings without exposing raw document text", () => {
    const summary = buildProductionInputPanelState({
      submitting: false,
      sourceInput: sourceInput({
        documentPhase: "done",
        activeDocumentName: "angebot.pdf"
      }),
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
              filename: "angebot.pdf"
            },
            documentIngestion: {
              status: "fallback",
              warnings: ["document_text_extraction_fallback"]
            }
          }
        ]
      }
    }).uploadResultSummary;

    expect(summary?.sourceCheckItems).toEqual([
      "Quelle: angebot.pdf · Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    ]);
    expect(summary?.preflightItems).toContainEqual({
      key: "source",
      label: "Quelle und Lesbarkeit",
      detailLabel: "Prüfen: Dokumentquelle hat Hinweise oder Warnungen.",
      status: "review"
    });
    expect(summary?.nextStepLabel).toBe("Nächster Schritt: Quellenprüfung bestätigen, dann Berechnung starten.");
  });
});
