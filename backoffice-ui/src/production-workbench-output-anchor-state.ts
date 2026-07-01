export type ProductionWorkbenchOutputAnchorState = {
  title: string;
  description: string;
  grouping: string;
  reviewItems: Array<{
    label: string;
    status: string;
  }>;
};

type ProductionDossierMetrics = {
  answeredQuestionCount?: number;
  questionPreview?: string;
  assumptionCount?: number;
  assumptionPreview?: string;
  productionBatchCount?: number;
  kitchenSheetCount?: number;
  recipeSelectionCount?: number;
  purchaseItemCount?: number;
  exportStatusLabel?: string;
};

function formatQuestionStatus(count: number): string {
  return count === 1 ? "1 Rückfrage sichtbar" : `${count} Rückfragen sichtbar`;
}

function formatOpenQuestionBasis(count: number, metrics?: ProductionDossierMetrics): string {
  const preview = metrics?.questionPreview?.trim();
  if (count === 0) {
    return "keine offenen Rückfragen";
  }
  const countLabel = count === 1 ? "1 Rückfrage offen" : `${count} Rückfragen offen`;
  return preview ? `${countLabel} · nächste Rückfrage: ${preview}` : countLabel;
}

function formatAssumptionBasis(metrics?: ProductionDossierMetrics): string {
  const assumptionCount = metrics?.assumptionCount ?? 0;
  const preview = metrics?.assumptionPreview?.trim();
  if (assumptionCount === 0) {
    return "Annahmen fachlich prüfen";
  }
  const countLabel = assumptionCount === 1 ? "1 Annahme sichtbar" : `${assumptionCount} Annahmen sichtbar`;
  return preview ? `${countLabel} · erste Annahme: ${preview}` : countLabel;
}

function formatArtifactBasis(hasPlan: boolean, hasPurchaseList: boolean): string {
  if (hasPlan && hasPurchaseList) {
    return "Plan und Einkaufsliste vorhanden";
  }
  if (hasPlan) {
    return "Plan vorhanden, Einkauf offen";
  }
  return "Plan und Einkauf nach Berechnung offen";
}

function formatWorkingBasisStatus(input: {
  hasSpecFacts: boolean;
  questionCount: number;
  hasPlan: boolean;
  hasPurchaseList: boolean;
  metrics?: ProductionDossierMetrics;
}): string {
  const sourcePart = input.hasSpecFacts
    ? "Eckdaten und Speisen erkannt"
    : input.hasPlan
      ? "Produktionsplan sichtbar"
      : "Spezifikation im Fokus";
  const parts = [
    sourcePart,
    formatOpenQuestionBasis(input.questionCount, input.metrics),
    formatAssumptionBasis(input.metrics),
    formatArtifactBasis(input.hasPlan, input.hasPurchaseList),
    "Freigabe nicht erteilt"
  ];
  return `Arbeitsgrundlage: ${parts.join(" · ")}`;
}

function formatQuestionReviewStatus(count: number, metrics?: ProductionDossierMetrics): string {
  const answeredCount = metrics?.answeredQuestionCount ?? 0;
  const preview = metrics?.questionPreview?.trim();

  if (count > 0 && preview) {
    return `${formatQuestionStatus(count)} · erste: ${preview}`;
  }
  if (count > 0) {
    return formatQuestionStatus(count);
  }
  if (answeredCount > 0) {
    return `${answeredCount} beantwortet · keine offenen Rückfragen sichtbar`;
  }
  return "keine offenen Rückfragen sichtbar";
}

function formatAssumptionStatus(hasPlan: boolean, metrics?: ProductionDossierMetrics): string {
  const assumptionCount = metrics?.assumptionCount ?? 0;
  const preview = metrics?.assumptionPreview?.trim();

  if (assumptionCount > 0 && preview) {
    return `${assumptionCount} Annahme${assumptionCount === 1 ? "" : "n"} · erste: ${preview}`;
  }
  if (assumptionCount > 0) {
    return `${assumptionCount} Annahme${assumptionCount === 1 ? "" : "n"} sichtbar`;
  }
  return hasPlan ? "im Plan fachlich prüfen" : "vor Berechnung offen prüfen";
}

function formatPlanArtifactStatus(count: number): string {
  return count === 1 ? "1 Plan-Artefakt vorhanden" : `${count} Plan-Artefakte vorhanden`;
}

function formatBatchStatus(planCount: number, metrics?: ProductionDossierMetrics): string {
  const batchCount = metrics?.productionBatchCount ?? 0;
  if (batchCount > 0) {
    return `${batchCount} Mengenkalkulation${batchCount === 1 ? "" : "en"} im Plan`;
  }
  return planCount > 0 ? formatPlanArtifactStatus(planCount) : "noch nicht berechnet";
}

function formatRecipeStatus(hasPlan: boolean, metrics?: ProductionDossierMetrics): string {
  const kitchenSheetCount = metrics?.kitchenSheetCount ?? 0;
  const recipeSelectionCount = metrics?.recipeSelectionCount ?? 0;
  if (kitchenSheetCount > 0) {
    return `${kitchenSheetCount} Rezept-/Küchenkarten sichtbar`;
  }
  if (recipeSelectionCount > 0) {
    return `${recipeSelectionCount} Rezeptbezüge im Plan`;
  }
  return hasPlan ? "Plan auf Rezeptbezug prüfen" : "nach Produktionsplan offen";
}

function formatPurchaseStatus(listCount: number, metrics?: ProductionDossierMetrics): string {
  const purchaseItemCount = metrics?.purchaseItemCount ?? 0;
  if (purchaseItemCount > 0) {
    return `${listCount} Einkaufsliste${listCount === 1 ? "" : "n"} · ${purchaseItemCount} Positionen`;
  }
  return listCount > 0 ? `${listCount} Einkaufsliste vorhanden` : "noch offen";
}

function formatMiseEnPlaceStatus(hasPlan: boolean, metrics?: ProductionDossierMetrics): string {
  const kitchenSheetCount = metrics?.kitchenSheetCount ?? 0;
  if (kitchenSheetCount > 0) {
    return "über Rezept-/Küchenkarten prüfen";
  }
  return hasPlan ? "Plan auf Mise-en-Place prüfen" : "nach Produktionsplan offen";
}

function formatFinalCheckStatus(
  hasPlan: boolean,
  hasPurchaseList: boolean,
  metrics?: ProductionDossierMetrics
): string {
  const exportStatusLabel = metrics?.exportStatusLabel?.trim();
  if (exportStatusLabel) {
    return `${exportStatusLabel} · Freigabe nicht erteilt`;
  }
  return hasPlan && hasPurchaseList ? "Exportlinks prüfen; Freigabe nicht erteilt" : "nach Plan und Einkaufsliste offen";
}

export function buildProductionWorkbenchOutputAnchorState(input: {
  specFactCount?: number;
  questionCount: number;
  dossierMetrics?: ProductionDossierMetrics;
  productionObjectCount: number;
  purchaseListCount: number;
}): ProductionWorkbenchOutputAnchorState {
  const hasSpecFacts = (input.specFactCount ?? 0) > 0;
  const hasQuestions = input.questionCount > 0;
  const hasPlan = input.productionObjectCount > 0;
  const hasPurchaseList = input.purchaseListCount > 0;
  const workingBasisStatus = formatWorkingBasisStatus({
    hasSpecFacts,
    questionCount: input.questionCount,
    hasPlan,
    hasPurchaseList,
    metrics: input.dossierMetrics
  });
  const reviewItems = [
    {
      label: "Verständnis des Angebots",
      status: hasSpecFacts
        ? hasQuestions
          ? "Eckdaten sichtbar, Klärpunkte offen"
          : "Eckdaten sichtbar"
        : hasQuestions
          ? "Spezifikation sichtbar, Klärpunkte offen"
          : "Spezifikation sichtbar"
    },
    {
      label: "Rückfragen",
      status: formatQuestionReviewStatus(input.questionCount, input.dossierMetrics)
    },
    {
      label: "Annahmen & Festlegungen",
      status: formatAssumptionStatus(hasPlan, input.dossierMetrics)
    },
    {
      label: "Kalkulationsübersicht",
      status: hasPlan ? "im Produktionsplan prüfen" : "nach Berechnung offen"
    },
    {
      label: "Mengenkalkulation je Gericht",
      status: formatBatchStatus(input.productionObjectCount, input.dossierMetrics)
    },
    {
      label: "Rezeptkarten",
      status: formatRecipeStatus(hasPlan, input.dossierMetrics)
    },
    {
      label: "Metro-Einkaufsliste",
      status: formatPurchaseStatus(input.purchaseListCount, input.dossierMetrics)
    },
    {
      label: "Mise-en-Place",
      status: formatMiseEnPlaceStatus(hasPlan, input.dossierMetrics)
    },
    {
      label: "Abschlussprüfung & Exporte",
      status: formatFinalCheckStatus(hasPlan, hasPurchaseList, input.dossierMetrics)
    }
  ];

  if (input.productionObjectCount > 0) {
    if (input.purchaseListCount === 0) {
      return {
        title: "Produktionsplan prüfen",
        description:
          "Produktionsplan liegt vor. Einkaufsliste und Einkaufslisten-Export sind noch nicht verfügbar.",
        grouping: workingBasisStatus,
        reviewItems
      };
    }

    return {
      title: "Produktionsarbeit prüfen",
      description:
        "Produktionsplan und Einkaufsliste liegen vor. Bitte Mengen, Rezeptquellen und Freigabegrenzen prüfen.",
      grouping: workingBasisStatus,
      reviewItems
    };
  }

  if (hasSpecFacts) {
    return {
      title: hasQuestions ? "Rückfragen zur Produktionsgrundlage klären" : "Produktionsdaten prüfen",
      description: hasQuestions
        ? "Erkannte Eckdaten und offene Rückfragen liegen vor. Bitte zuerst klären; die Berechnung startet danach."
        : "Erkannte Eckdaten und Speisen liegen vor. Bitte Angaben prüfen und danach die Berechnung starten.",
      grouping: workingBasisStatus,
      reviewItems
    };
  }

  if (hasQuestions) {
    return {
      title: "Rückfragen klären",
      description:
        "Offene Rückfragen zuerst beantworten; Produktionsplan, Einkaufsliste und Export bleiben bis dahin offen.",
      grouping: workingBasisStatus,
      reviewItems
    };
  }

  return {
    title: "Produktionsplan berechnen",
    description:
      "Noch kein Produktionsplan bereit: Zuerst Berechnung starten; Einkaufsliste und Exportlinks bleiben bis dahin offen.",
    grouping: workingBasisStatus,
    reviewItems
  };
}
