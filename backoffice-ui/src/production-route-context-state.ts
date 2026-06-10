export type ProductionNextStep = {
  title: string;
  description: string;
};

export function formatProductionContextId(...values: unknown[]): string {
  for (const value of values) {
    const id = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
    if (id) {
      return id;
    }
  }
  return "-";
}

export function selectProductionNextStep(input: {
  hasFocusedProductionSpec: boolean;
  questionCount: number;
  hasSelectedPlan: boolean;
  purchaseListCount: number;
}): ProductionNextStep {
  if (!input.hasFocusedProductionSpec && !input.hasSelectedPlan) {
    return {
      title: "Auftrag einfügen oder Datei ablegen",
      description: "Starte mit Angebot, E-Mail, Text oder manuellen Veranstaltungsdaten."
    };
  }
  if (input.questionCount > 0) {
    return {
      title: "Rückfragen beantworten",
      description: "Die Produktion braucht noch strukturierte Antworten, bevor Ergebnisse belastbar sind."
    };
  }
  if (!input.hasSelectedPlan) {
    return {
      title: "Produktionsplan berechnen",
      description: "Aus der Spezifikation kann jetzt ein Produktionsplan mit Einkaufsliste vorbereitet werden."
    };
  }
  if (input.purchaseListCount === 0) {
    return {
      title: "Einkaufsliste noch offen",
      description: "Produktionsplan ist vorhanden; Einkaufsliste und Einkaufslisten-Export fehlen noch."
    };
  }
  return {
    title: "Produktionsarbeit prüfen",
    description:
      "Produktionsplan, Einkaufsliste und Exporte liegen bereit. Bitte Plan, Mengen, Rezeptquellen und Freigabegrenzen prüfen."
  };
}

export function formatActiveProductionContextLabel(input: {
  focusedProductionSpecLabel?: string;
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpecLabel?: string;
  productionWorkspaceCleared: boolean;
}): string {
  if (input.productionWorkspaceCleared) {
    return "Kein aktiver Vorgang";
  }

  if (input.focusedProductionSpecLabel) {
    return input.focusedProductionSpecLabel;
  }

  if (input.selectedPlan) {
    if (input.selectedPlanSpecLabel) {
      return input.selectedPlanSpecLabel;
    }

    const eventSpecId = formatProductionContextId(input.selectedPlan.eventSpecId);
    if (eventSpecId !== "-") {
      return "Produktionsplan aus gespeicherter Spezifikation";
    }

    return "Produktionsplan ohne fokussierte Spezifikation";
  }
  return "Noch kein aktiver Vorgang";
}

export function formatProductionTechnicalContextLabel(input: {
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpecLabel?: string;
  productionWorkspaceCleared: boolean;
}): string | undefined {
  if (input.productionWorkspaceCleared || !input.selectedPlan) {
    return undefined;
  }

  const planId = formatProductionContextId(input.selectedPlan.planId);
  const eventSpecId = formatProductionContextId(input.selectedPlan.eventSpecId);
  const specPart = input.selectedPlanSpecLabel
    ? `Spezifikation ${input.selectedPlanSpecLabel}`
    : eventSpecId !== "-"
      ? `Spezifikation ${eventSpecId}`
      : "Spezifikation nicht im Fokus";
  return `Plan ${planId} · ${specPart}`;
}

export function canClearProductionWorkspace(input: {
  hasFocusedProductionSpec: boolean;
  hasSelectedPlan: boolean;
  hasIntakeFile: boolean;
  hasActiveDocumentName: boolean;
  documentPhase: string;
  planPhase: string;
  hasFocusedProductionSpecId: boolean;
  hasSelectedPlanId: boolean;
}): boolean {
  return (
    input.hasFocusedProductionSpec ||
    input.hasSelectedPlan ||
    input.hasIntakeFile ||
    input.hasActiveDocumentName ||
    input.documentPhase !== "idle" ||
    input.planPhase !== "idle" ||
    input.hasFocusedProductionSpecId ||
    input.hasSelectedPlanId
  );
}

export function canArchiveCurrentIntake(input: {
  currentIntakeRequestId?: string;
  productionWorkspaceCleared: boolean;
}): boolean {
  return Boolean(input.currentIntakeRequestId?.trim()) && !input.productionWorkspaceCleared;
}
