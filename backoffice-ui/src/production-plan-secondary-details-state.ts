import {
  translateMenuCategory,
  translateProductionMode
} from "./production-language.js";

export type ProductionPlanSecondaryRecipeSelectionState = {
  key: string;
  componentLabel: string;
  selectionReasonLabel: string;
  componentDetailLabel?: string;
  scoreLabel?: string;
  searchTrace: string[];
};

export type ProductionPlanSecondaryKitchenSheetState = {
  key: string;
  title: string;
  instructions: string[];
};

export type ProductionPlanSecondaryDetailsState = {
  showArchivedPlansSection: boolean;
  recipeSelections: ProductionPlanSecondaryRecipeSelectionState[];
  showKitchenSheetsSection: boolean;
  kitchenSheets: ProductionPlanSecondaryKitchenSheetState[];
};

function formatPercent(value?: unknown): string | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return `${Math.round(numeric * 100)} %`;
}

export function buildProductionPlanSecondaryDetailsState(input: {
  selectedPlan?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  showArchivedPlans: boolean;
}): ProductionPlanSecondaryDetailsState | undefined {
  if (!input.selectedPlan) {
    return undefined;
  }

  const recipeSelections = Array.isArray(input.selectedPlan.recipeSelections)
    ? input.selectedPlan.recipeSelections.map((selection, index) => {
        const selectionRecord = selection as Record<string, unknown>;
        const componentId = String(selectionRecord.componentId ?? "");
        const component = input.selectedPlanComponentsById.get(componentId);
        const componentLabel = String(component?.label ?? (componentId || "-"));
        const qualityScore = formatPercent(selectionRecord.qualityScore);
        const fitScore = formatPercent(selectionRecord.fitScore);

        return {
          key: `${componentId || "selection"}-${index}`,
          componentLabel,
          selectionReasonLabel: String(selectionRecord.selectionReason ?? "-"),
          componentDetailLabel: component
            ? `Kategorie: ${translateMenuCategory(String(component.menuCategory ?? ""))} · Herstellungsart: ${translateProductionMode(
                String((component.productionDecision as Record<string, unknown> | undefined)?.mode ?? "")
              )}`
            : undefined,
          scoreLabel:
            qualityScore || fitScore
              ? `${qualityScore ? `Qualität ${qualityScore}` : "Qualität offen"}${fitScore ? ` · Passung ${fitScore}` : ""}`
              : undefined,
          searchTrace: Array.isArray(selectionRecord.searchTrace)
            ? selectionRecord.searchTrace.map((entry) => String(entry))
            : []
        };
      })
    : [];

  const kitchenSheets = Array.isArray(input.selectedPlan.kitchenSheets)
    ? input.selectedPlan.kitchenSheets.map((sheet, sheetIndex) => {
        const sheetRecord = sheet as Record<string, unknown>;
        return {
          key: `${String(sheetRecord.title ?? "Arbeitsblatt")}-${sheetIndex}`,
          title: String(sheetRecord.title ?? "Arbeitsblatt"),
          instructions: Array.isArray(sheetRecord.instructions)
            ? sheetRecord.instructions.map((entry) => String(entry))
            : []
        };
      })
    : [];

  return {
    showArchivedPlansSection: input.showArchivedPlans && input.archivedPlans.length > 0,
    recipeSelections,
    showKitchenSheetsSection: kitchenSheets.length > 0,
    kitchenSheets
  };
}
