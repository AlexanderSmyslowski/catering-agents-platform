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
        purchaseListCount: 1,
        purchaseItemCount: 8,
        planStatusLabel: "vollständig"
      })
    ).toEqual({
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks bleiben getrennt sichtbar; ältere Vorgänge bleiben eingeklappt."
    });
  });

  it("keeps incomplete artifacts out of the production-ready review copy", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 1,
        purchaseListCount: 1,
        purchaseItemCount: 0,
        planStatusLabel: "unzureichend"
      })
    ).toEqual({
      title: "Produktionsplan nacharbeiten",
      description:
        "Produktionsplan ist unzureichend. Bitte offene Punkte, Rezeptquellen und Mengen klären.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks bleiben sichtbar; die Produktion ist noch nicht freigabereif."
    });

    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 1,
        purchaseListCount: 1,
        purchaseItemCount: 0,
        planStatusLabel: "vollständig"
      })
    ).toEqual({
      title: "Einkaufspositionen klären",
      description:
        "Einkaufsliste ist vorhanden, enthält aber noch keine Positionen für die Produktion.",
      grouping:
        "Plan und Exportlinks bleiben sichtbar; Beschaffung bleibt bis zu belastbaren Positionen offen."
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
