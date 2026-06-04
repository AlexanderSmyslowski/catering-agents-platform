import { describe, expect, it } from "vitest";
import { buildProductionWorkbenchOutputAnchorState } from "../backoffice-ui/src/production-workbench-output-anchor-state.js";

describe("production workbench output anchor state", () => {
  it("points to reviewing production artifacts when plans already exist", () => {
    expect(
      buildProductionWorkbenchOutputAnchorState({
        productionObjectCount: 2
      })
    ).toEqual({
      title: "Produktionsobjekte und Downloads prüfen",
      description:
        "Nach den strukturierten Antworten liegen oder entstehen hier Produktionsplan, Rezepte/Objektübersicht, Einkaufsliste und Downloads. Der Bereich nutzt nur vorhandene Pläne, Einkaufslisten und Exportlinks.",
      grouping:
        "Vorhandene Pläne, Einkaufslisten und Exportlinks sind getrennt gruppiert und bleiben read-only prüfbar."
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
        "Noch keine Produktionsobjekte bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
      grouping: "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden."
    });
  });
});
