import { describe, expect, it } from "vitest";
import { buildProductionWorkbenchOutputAnchorState } from "../backoffice-ui/src/production-workbench-output-anchor-state.js";

describe("production workbench output anchor state", () => {
  it("keeps plan-only copy from claiming purchase list or export readiness", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 1,
        purchaseListCount: 0
      })
    ).toEqual({
      title: "Produktionsplan prüfen",
      description:
        "Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.",
      grouping:
        "Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen; Beschaffung bleibt offen."
    });
  });

  it("points to reviewing production work when plan and purchase list exist", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 2,
        purchaseListCount: 1
      })
    ).toEqual({
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks bleiben getrennt sichtbar; ältere Vorgänge bleiben eingeklappt."
    });
  });

  it("points to calculating a production plan when no artifacts exist yet", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 0,
        purchaseListCount: 0
      })
    ).toEqual({
      title: "Produktionsplan berechnen",
      description:
        "Noch kein Produktionsplan bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
      grouping: "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden."
    });
  });
});
