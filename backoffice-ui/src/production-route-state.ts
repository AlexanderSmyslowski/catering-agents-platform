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

export function countPurchaseListItems(purchaseLists: Array<Record<string, unknown>>): number {
  return purchaseLists.reduce((sum, purchaseList) => {
    const totals = purchaseList.totals as Record<string, unknown> | undefined;
    const itemCount = Number(totals?.itemCount);
    if (Number.isFinite(itemCount)) {
      return sum + itemCount;
    }
    if (Array.isArray(purchaseList.items)) {
      return sum + purchaseList.items.length;
    }
    return sum;
  }, 0);
}

export function formatPurchaseZoneStatusLabel(input: {
  purchaseListCount: number;
  itemCount: number;
}): string {
  return input.purchaseListCount > 0
    ? `${input.purchaseListCount} Liste${input.purchaseListCount === 1 ? "" : "n"} · ${input.itemCount} Positionen`
    : "noch keine Liste";
}

export function formatProductionIntakeOriginLabel(input: {
  intakeRequestDetail?: Record<string, unknown> | null;
  currentIntakeRequestId?: string;
}): string {
  if (input.intakeRequestDetail) {
    const source = input.intakeRequestDetail.source as Record<string, unknown> | undefined;
    return `${String(source?.channel ?? "-")} · ${String(source?.receivedAt ?? "-")} · ${String(
      input.intakeRequestDetail.requestId ?? "-"
    )}`;
  }

  return input.currentIntakeRequestId
    ? `Intake-Anfrage ${input.currentIntakeRequestId}`
    : "kein Intake-Ursprung verknüpft";
}

export function formatProductionHandoffExportLabel(input: {
  hasSelectedPlan: boolean;
  purchaseListCount: number;
}): string {
  return [
    input.hasSelectedPlan ? "Produktionsblatt vorhanden" : "Produktionsblatt offen",
    input.purchaseListCount > 0 ? "Einkaufsliste vorhanden" : "Einkaufsliste offen"
  ].join(" · ");
}

export function formatProductionHandoffContextLabel(input: {
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  purchaseLists: Array<Record<string, unknown>>;
}): string | undefined {
  if (!input.selectedPlan) {
    return undefined;
  }

  return [
    `planId ${String(input.selectedPlan.planId ?? "-")}`,
    `specId ${String(input.selectedPlan.eventSpecId ?? input.selectedPlanSpec?.specId ?? "-")}`,
    input.purchaseLists[0] ? `purchaseListId ${String(input.purchaseLists[0].purchaseListId ?? "-")}` : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}
