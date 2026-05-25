export type ProductionRouteFocusSpec = Record<string, unknown>;

export type ProductionNextStep = {
  title: string;
  description: string;
};

export function selectFocusedProductionSpec(input: {
  acceptedSpecs: ProductionRouteFocusSpec[];
  filteredSpecs: ProductionRouteFocusSpec[];
  focusedProductionSpecId?: string;
  productionWorkspaceCleared: boolean;
  route: string;
  searchText: string;
}): ProductionRouteFocusSpec | undefined {
  if (input.productionWorkspaceCleared) {
    return undefined;
  }

  const productionSearchActive = input.route === "production" && input.searchText.trim().length > 0;
  const preferred = input.focusedProductionSpecId
    ? input.filteredSpecs.find((spec) => String(spec.specId) === input.focusedProductionSpecId)
    : undefined;

  if (productionSearchActive) {
    return preferred ?? input.filteredSpecs[input.filteredSpecs.length - 1];
  }

  return preferred ?? input.filteredSpecs[input.filteredSpecs.length - 1] ?? input.acceptedSpecs[input.acceptedSpecs.length - 1];
}

export function selectCurrentProductionItems<T extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  items: T[];
  productionWorkspaceCleared: boolean;
}): T[] {
  if (input.productionWorkspaceCleared) {
    return [];
  }

  if (!input.currentProductionSpecId) {
    return input.items;
  }

  return input.items.filter((item) => String(item.eventSpecId ?? "") === input.currentProductionSpecId);
}

export function selectArchivedProductionItems<T extends Record<string, unknown>>(input: {
  currentProductionSpecId: string;
  items: T[];
  productionWorkspaceCleared: boolean;
}): T[] {
  if (!input.currentProductionSpecId || input.productionWorkspaceCleared) {
    return [];
  }

  return input.items.filter((item) => String(item.eventSpecId ?? "") !== input.currentProductionSpecId);
}

export function selectProductionNextStep(input: {
  hasFocusedProductionSpec: boolean;
  questionCount: number;
  hasSelectedPlan: boolean;
  purchaseListCount: number;
}): ProductionNextStep {
  if (!input.hasFocusedProductionSpec) {
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
      description: "Die vorhandene Spezifikation kann nun in vorhandene Produktionsobjekte überführt werden."
    };
  }
  if (input.purchaseListCount === 0) {
    return {
      title: "Einkaufsliste noch offen",
      description: "Produktionsplan ist vorhanden; Einkaufsliste und Einkaufslisten-Export fehlen noch."
    };
  }
  return {
    title: "Produktionsobjekte und Downloads prüfen",
    description: "Plan, Einkaufsliste und Exporte sind als prüfbare Ergebniszonen verfügbar."
  };
}

export function formatActiveProductionContextLabel(input: {
  focusedProductionSpecLabel?: string;
  selectedPlan?: Record<string, unknown>;
  productionWorkspaceCleared: boolean;
}): string {
  if (input.focusedProductionSpecLabel) {
    return input.focusedProductionSpecLabel;
  }

  if (input.selectedPlan) {
    return `Plan-Kontext geladen: ${String(input.selectedPlan.planId ?? "-")} · Spezifikation noch nicht im Fokus`;
  }

  return input.productionWorkspaceCleared ? "Kein aktiver Vorgang" : "Noch kein aktiver Vorgang";
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
