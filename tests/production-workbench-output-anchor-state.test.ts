import { describe, expect, it } from "vitest";
import { buildProductionWorkbenchOutputAnchorState } from "../backoffice-ui/src/production-workbench-output-anchor-state.js";

describe("production workbench output anchor state", () => {
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
        { label: "Verständnis & Rückfragen", status: "keine offenen Rückfragen sichtbar" },
        { label: "Mengen & Produktionsplan", status: "1 Plan-Artefakt vorhanden" },
        { label: "Rezeptkarten & Mise-en-Place", status: "im Plan und Export fachlich prüfen" },
        { label: "Einkaufsliste nach Warengruppen", status: "noch offen" },
        { label: "Export & Abschlussprüfung", status: "nach Plan und Einkaufsliste offen" }
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
        { label: "Verständnis & Rückfragen", status: "2 Rückfragen sichtbar" },
        { label: "Mengen & Produktionsplan", status: "2 Plan-Artefakte vorhanden" },
        { label: "Rezeptkarten & Mise-en-Place", status: "im Plan und Export fachlich prüfen" },
        { label: "Einkaufsliste nach Warengruppen", status: "1 Einkaufsliste vorhanden" },
        { label: "Export & Abschlussprüfung", status: "Exportlinks prüfen; Freigabe offen" }
      ]
    });
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
        { label: "Verständnis & Rückfragen", status: "1 Rückfrage sichtbar" },
        { label: "Mengen & Produktionsplan", status: "noch nicht berechnet" },
        { label: "Rezeptkarten & Mise-en-Place", status: "nach Produktionsplan offen" },
        { label: "Einkaufsliste nach Warengruppen", status: "noch offen" },
        { label: "Export & Abschlussprüfung", status: "nach Plan und Einkaufsliste offen" }
      ]
    });
  });
});
