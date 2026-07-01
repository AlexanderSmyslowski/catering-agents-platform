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
import type { ProductionAnalysisResult } from "../backoffice-ui/src/production-analysis-result-state.js";

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

function renderPanel(sourceInput: ProductionSourceInputValues, analysisResult?: ProductionAnalysisResult): string {
  return renderToStaticMarkup(
    createElement(ProductionInputPanel, {
      submitting: false,
      sourceInput,
      sourceInputActions,
      manualInput,
      manualInputActions,
      analysisResult
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

  it("surfaces recognised production data in the completed analysis state", () => {
    const markup = renderPanel(
      buildSourceInput({
        documentPhase: "done",
        activeDocumentName: "angebot.pdf",
        documentProgress: 100
      }),
      {
        title: "Empfang · 45 Teilnehmer · 2026-06-14",
        statusLine: "Status: vollständig · Rückfragen: offen 11 · beantwortet 0",
        planLine: "Plan: offen · Einkaufsliste: noch keine Liste",
        menuItems: ["Vitello tonnato", "Tortilla-Tarte"],
        questionPreviewItems: [
          "Welche Komponenten werden fertig zugekauft?",
          "Gilt der Gesamtpreis nur für Speisen?",
          "Welche Convenience-Stufe ist gewünscht?"
        ],
        questionPreviewOverflowCount: 2,
        assumptionPreviewItems: [
          "Tortilla-Tarte wird als vegetarische Komponente behandelt.",
          "Tartelettes werden als Zukauf angenommen."
        ],
        assumptionPreviewOverflowCount: 1,
        artifactItems: [
          { label: "Kalkulationsübersicht", value: "Preisrahmen offen", status: "open" },
          { label: "Mengenkalkulation je Gericht", value: "entsteht mit Berechnung", status: "open" },
          { label: "Rezeptkarten / Produktionsschritte", value: "noch nicht verknüpft", status: "open" },
          { label: "Einkaufsliste nach Metro-Logik", value: "noch nicht erstellt", status: "open" },
          { label: "Mise-en-Place / Abschlussprüfung", value: "entsteht mit Berechnung", status: "open" }
        ],
        checklistItems: [
          { label: "Anlass", value: "Empfang", status: "ok" },
          { label: "Preisrahmen", value: "offen", status: "open" }
        ],
        nextStepTitle: "Rückfragen klären"
      }
    );

    expect(markup).toContain("Analyse abgeschlossen");
    expect(markup).toContain("angebot.pdf");
    expect(markup).toContain("Erkannte Produktionsdaten");
    expect(markup).toContain("Empfang · 45 Teilnehmer · 2026-06-14");
    expect(markup).toContain("Rückfragen: offen 11 · beantwortet 0");
    expect(markup).toContain("Plan: offen · Einkaufsliste: noch keine Liste");
    expect(markup).toContain("Verständnis des Angebots");
    expect(markup).toContain("Vitello tonnato");
    expect(markup).toContain("Tortilla-Tarte");
    expect(markup).toContain("Zwingende Rückfragen");
    expect(markup).toContain("Welche Komponenten werden fertig zugekauft?");
    expect(markup).toContain("+ 2 weitere Rückfragen im Rückfragenbereich.");
    expect(markup).toContain("Annahmen");
    expect(markup).toContain("Tortilla-Tarte wird als vegetarische Komponente behandelt.");
    expect(markup).toContain("Tartelettes werden als Zukauf angenommen.");
    expect(markup).toContain("+ 1 weitere Annahme im Rückfragenbereich.");
    expect(markup).toContain("Produktionsmappe");
    expect(markup).toContain("Kalkulationsübersicht");
    expect(markup).toContain("Mengenkalkulation je Gericht");
    expect(markup).toContain("Rezeptkarten / Produktionsschritte");
    expect(markup).toContain("Einkaufsliste nach Metro-Logik");
    expect(markup).toContain("Mise-en-Place / Abschlussprüfung");
    expect(markup).toContain("entsteht mit Berechnung");
    expect(markup).toContain("noch nicht verknüpft");
    expect(markup).toContain("noch nicht erstellt");
    expect(markup).toContain("Pflichtprüfung");
    expect(markup).toContain("Preisrahmen");
    expect(markup).toContain("Nächster Produktionsschritt: Rückfragen klären");
    expect(markup).toContain("Eingabe ändern oder weitere Anfrage laden");
    expect(markup).toContain("Datei, Text oder manuelle Spezifikation");
    expect(markup.indexOf("Erkannte Produktionsdaten")).toBeLessThan(markup.indexOf("Kundenanfrage übernehmen"));
    expect(markup.indexOf("Erkannte Produktionsdaten")).toBeLessThan(markup.indexOf("Datei hier ablegen"));
    expect(markup.indexOf("Nächster Produktionsschritt")).toBeLessThan(
      markup.indexOf("Eingabe ändern oder weitere Anfrage laden")
    );
    expect(markup).toContain('<details class="production-input-followup"><summary>');
    expect(markup).not.toContain("<span>100%</span>");
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
