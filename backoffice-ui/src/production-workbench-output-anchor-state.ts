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
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan, Einkaufsliste und Exporte liegen bereit. Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks bleiben getrennt sichtbar; ältere Vorgänge bleiben eingeklappt."
    };
  }

  return {
    title: "Produktionsplan berechnen",
    description:
      "Noch kein Produktionsplan bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
    grouping: "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden."
  };
}
