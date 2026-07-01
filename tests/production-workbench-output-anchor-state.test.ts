import { describe, expect, it } from "vitest";
import { buildProductionWorkbenchOutputAnchorState } from "../backoffice-ui/src/production-workbench-output-anchor-state.js";

describe("production workbench output anchor state", () => {
  it("treats recognized spec facts as production data before plan calculation", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        specFactCount: 6,
        questionCount: 0,
        productionObjectCount: 0,
        purchaseListCount: 0
      })
    ).toEqual({
      title: "Produktionsdaten prüfen",
      description:
        "Erkannte Eckdaten und Speisen liegen vor. Bitte Angaben prüfen und danach die Berechnung starten.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks entstehen erst nach der Berechnung; Rückfragen bleiben sichtbar.",
      reviewItems: [
        { label: "Verständnis des Angebots", status: "Eckdaten sichtbar" },
        { label: "Rückfragen", status: "keine offenen Rückfragen sichtbar" },
        { label: "Annahmen & Festlegungen", status: "vor Berechnung offen prüfen" },
        { label: "Kalkulationsübersicht", status: "nach Berechnung offen" },
        { label: "Mengenkalkulation je Gericht", status: "noch nicht berechnet" },
        { label: "Rezeptkarten", status: "nach Produktionsplan offen" },
        { label: "Metro-Einkaufsliste", status: "noch offen" },
        { label: "Mise-en-Place", status: "nach Produktionsplan offen" },
        { label: "Abschlussprüfung & Exporte", status: "nach Plan und Einkaufsliste offen" }
      ]
    });
  });

  it("keeps plan-only copy from claiming purchase list or export readiness", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        questionCount: 0,
        productionObjectCount: 1,
        purchaseListCount: 0
      })
    ).toEqual({
      title: "Produktionsplan prüfen",
      description:
        "Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.",
      grouping:
        "Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen; Beschaffung bleibt offen.",
      reviewItems: [
        { label: "Verständnis des Angebots", status: "Spezifikation sichtbar" },
        { label: "Rückfragen", status: "keine offenen Rückfragen sichtbar" },
        { label: "Annahmen & Festlegungen", status: "im Plan fachlich prüfen" },
        { label: "Kalkulationsübersicht", status: "im Produktionsplan prüfen" },
        { label: "Mengenkalkulation je Gericht", status: "1 Plan-Artefakt vorhanden" },
        { label: "Rezeptkarten", status: "Plan auf Rezeptbezug prüfen" },
        { label: "Metro-Einkaufsliste", status: "noch offen" },
        { label: "Mise-en-Place", status: "Plan auf Mise-en-Place prüfen" },
        { label: "Abschlussprüfung & Exporte", status: "nach Plan und Einkaufsliste offen" }
      ]
    });
  });

  it("points to reviewing production work when plan and purchase list exist", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        questionCount: 2,
        productionObjectCount: 2,
        purchaseListCount: 1
      })
    ).toEqual({
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks bleiben getrennt sichtbar; ältere Vorgänge bleiben eingeklappt.",
      reviewItems: [
        { label: "Verständnis des Angebots", status: "Spezifikation sichtbar, Klärpunkte offen" },
        { label: "Rückfragen", status: "2 Rückfragen sichtbar" },
        { label: "Annahmen & Festlegungen", status: "im Plan fachlich prüfen" },
        { label: "Kalkulationsübersicht", status: "im Produktionsplan prüfen" },
        { label: "Mengenkalkulation je Gericht", status: "2 Plan-Artefakte vorhanden" },
        { label: "Rezeptkarten", status: "Plan auf Rezeptbezug prüfen" },
        { label: "Metro-Einkaufsliste", status: "1 Einkaufsliste vorhanden" },
        { label: "Mise-en-Place", status: "Plan auf Mise-en-Place prüfen" },
        { label: "Abschlussprüfung & Exporte", status: "Exportlinks prüfen; Freigabe offen" }
      ]
    });
  });

  it("uses available dossier metrics for concrete production-map statuses", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        specFactCount: 4,
        questionCount: 2,
        dossierMetrics: {
          answeredQuestionCount: 1,
          questionPreview: "Welche Komponenten sind fertig zugekauft?",
          assumptionCount: 1,
          assumptionPreview: "Brot als Bäcker-Zukauf führen.",
          productionBatchCount: 3,
          kitchenSheetCount: 4,
          recipeSelectionCount: 3,
          purchaseItemCount: 18
        },
        productionObjectCount: 1,
        purchaseListCount: 1
      }).reviewItems
    ).toEqual([
      { label: "Verständnis des Angebots", status: "Eckdaten sichtbar, Klärpunkte offen" },
      {
        label: "Rückfragen",
        status: "2 Rückfragen sichtbar · erste: Welche Komponenten sind fertig zugekauft?"
      },
      { label: "Annahmen & Festlegungen", status: "1 Annahme · erste: Brot als Bäcker-Zukauf führen." },
      { label: "Kalkulationsübersicht", status: "im Produktionsplan prüfen" },
      { label: "Mengenkalkulation je Gericht", status: "3 Mengenkalkulationen im Plan" },
      { label: "Rezeptkarten", status: "4 Rezept-/Küchenkarten sichtbar" },
      { label: "Metro-Einkaufsliste", status: "1 Einkaufsliste · 18 Positionen" },
      { label: "Mise-en-Place", status: "über Rezept-/Küchenkarten prüfen" },
      { label: "Abschlussprüfung & Exporte", status: "Exportlinks prüfen; Freigabe offen" }
    ]);
  });

  it("points to calculating a production plan when no artifacts exist yet", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        questionCount: 1,
        productionObjectCount: 0,
        purchaseListCount: 0
      })
    ).toEqual({
      title: "Produktionsplan berechnen",
      description:
        "Noch kein Produktionsplan bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
      grouping: "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.",
      reviewItems: [
        { label: "Verständnis des Angebots", status: "Spezifikation sichtbar, Klärpunkte offen" },
        { label: "Rückfragen", status: "1 Rückfrage sichtbar" },
        { label: "Annahmen & Festlegungen", status: "vor Berechnung offen prüfen" },
        { label: "Kalkulationsübersicht", status: "nach Berechnung offen" },
        { label: "Mengenkalkulation je Gericht", status: "noch nicht berechnet" },
        { label: "Rezeptkarten", status: "nach Produktionsplan offen" },
        { label: "Metro-Einkaufsliste", status: "noch offen" },
        { label: "Mise-en-Place", status: "nach Produktionsplan offen" },
        { label: "Abschlussprüfung & Exporte", status: "nach Plan und Einkaufsliste offen" }
      ]
    });
  });
});
