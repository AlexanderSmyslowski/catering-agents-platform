export type ProductionWorkbenchOutputAnchorState = {
  title: string;
  description: string;
  grouping: string;
};

export function buildProductionWorkbenchOutputAnchorState(input: {
  productionObjectCount: number;
  purchaseListCount: number;
  purchaseItemCount?: number;
  planStatusLabel?: string;
}): ProductionWorkbenchOutputAnchorState {
  if (input.productionObjectCount > 0) {
    if (input.planStatusLabel === "unzureichend") {
      return {
        title: "Produktionsplan nacharbeiten",
        description:
          "Produktionsplan ist unzureichend. Bitte offene Punkte, Rezeptquellen und Mengen klären.",
        grouping:
          "Plan, Einkaufsliste und Exportlinks bleiben sichtbar; die Produktion ist noch nicht freigabereif."
      };
    }

    if (input.purchaseListCount === 0) {
      return {
        title: "Produktionsplan prüfen",
        description:
          "Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.",
        grouping:
          "Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen; Beschaffung bleibt offen."
      };
    }

    if (input.purchaseItemCount === 0) {
      return {
        title: "Einkaufspositionen klären",
        description:
          "Einkaufsliste ist vorhanden, enthält aber noch keine Positionen für die Produktion.",
        grouping:
          "Plan und Exportlinks bleiben sichtbar; Beschaffung bleibt bis zu belastbaren Positionen offen."
      };
    }

    return {
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
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
