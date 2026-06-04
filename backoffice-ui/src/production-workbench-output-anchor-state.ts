export type ProductionWorkbenchOutputAnchorState = {
  title: string;
  description: string;
  grouping: string;
};

export function buildProductionWorkbenchOutputAnchorState(input: {
  productionObjectCount: number;
}): ProductionWorkbenchOutputAnchorState {
  if (input.productionObjectCount > 0) {
    return {
      title: "Produktionsobjekte und Downloads prüfen",
      description:
        "Nach den strukturierten Antworten liegen oder entstehen hier Produktionsplan, Rezepte/Objektübersicht, Einkaufsliste und Downloads. Der Bereich nutzt nur vorhandene Pläne, Einkaufslisten und Exportlinks.",
      grouping:
        "Vorhandene Pläne, Einkaufslisten und Exportlinks sind getrennt gruppiert und bleiben read-only prüfbar."
    };
  }

  return {
    title: "Produktionsplan berechnen",
    description:
      "Noch keine Produktionsobjekte bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
    grouping: "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden."
  };
}
