export type ProductionWorkbenchOutputAnchorState = {
  title: string;
  description: string;
  grouping: string;
  reviewItems: Array<{
    label: string;
    status: string;
  }>;
};

function formatQuestionStatus(count: number): string {
  return count === 1 ? "1 Rückfrage sichtbar" : `${count} Rückfragen sichtbar`;
}

function formatPlanArtifactStatus(count: number): string {
  return count === 1 ? "1 Plan-Artefakt vorhanden" : `${count} Plan-Artefakte vorhanden`;
}

export function buildProductionWorkbenchOutputAnchorState(input: {
  questionCount: number;
  productionObjectCount: number;
  purchaseListCount: number;
}): ProductionWorkbenchOutputAnchorState {
  const hasQuestions = input.questionCount > 0;
  const hasPlan = input.productionObjectCount > 0;
  const hasPurchaseList = input.purchaseListCount > 0;
  const reviewItems = [
    {
      label: "Verständnis & Rückfragen",
      status: hasQuestions ? formatQuestionStatus(input.questionCount) : "keine offenen Rückfragen sichtbar"
    },
    {
      label: "Mengen & Produktionsplan",
      status: hasPlan ? formatPlanArtifactStatus(input.productionObjectCount) : "noch nicht berechnet"
    },
    {
      label: "Rezeptkarten & Mise-en-Place",
      status: hasPlan ? "im Plan und Export prüfen" : "nach Produktionsplan offen"
    },
    {
      label: "Einkaufsliste nach Warengruppen",
      status: hasPurchaseList ? `${input.purchaseListCount} Einkaufsliste vorhanden` : "noch offen"
    },
    {
      label: "Export & Abschlussprüfung",
      status: hasPlan && hasPurchaseList ? "Exportlinks im Vorgang prüfen" : "nach Plan und Einkaufsliste offen"
    }
  ];

  if (input.productionObjectCount > 0) {
    if (input.purchaseListCount === 0) {
      return {
        title: "Produktionsplan prüfen",
        description:
          "Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.",
        grouping:
          "Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen; Beschaffung bleibt offen.",
        reviewItems
      };
    }

    return {
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
      grouping:
        "Plan, Einkaufsliste und Exportlinks bleiben getrennt sichtbar; ältere Vorgänge bleiben eingeklappt.",
      reviewItems
    };
  }

  return {
    title: "Produktionsplan berechnen",
    description:
      "Noch kein Produktionsplan bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
    grouping: "Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.",
    reviewItems
  };
}
