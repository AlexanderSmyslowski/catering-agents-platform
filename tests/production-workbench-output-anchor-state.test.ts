import { describe, expect, it } from "vitest";
import { buildProductionWorkbenchOutputAnchorState } from "../backoffice-ui/src/production-workbench-output-anchor-state.js";

describe("production workbench output anchor state", () => {
  it("points to reviewing production artifacts when plans already exist", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 2
      })
    ).toEqual({
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan, Einkaufsliste und Exporte liegen bereit. Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks bleiben getrennt sichtbar; ältere Vorgänge bleiben eingeklappt."
    });
  });

  it("points to calculating a production plan when no artifacts exist yet", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 0
      })
    ).toEqual({
      title: "Produktionsplan berechnen",
      description:
        "Noch kein Produktionsplan bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
      grouping: "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden."
    });
  });
});
