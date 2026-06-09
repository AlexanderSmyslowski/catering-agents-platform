import { formatRecipeSourceEvidenceLabel } from "../../shared-core/src/export-source-metadata.js";
import type { RecipeSourceExportMetadata } from "../../shared-core/src/types.js";
import {
  translateMenuCategory,
  translateProductionMode
} from "./production-language.js";

export type ProductionPlanSecondaryRecipeSelectionState = {
  key: string;
  componentLabel: string;
  selectionReasonLabel: string;
  componentDetailLabel?: string;
  sourceLabel: string;
  scoreLabel?: string;
  searchTrace: string[];
};

export type ProductionPlanSecondaryKitchenSheetState = {
  key: string;
  title: string;
  sourceLabel: string;
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asRecipeSourceExportMetadata(value: unknown): RecipeSourceExportMetadata | undefined {
  const record = asRecord(value);
  return record as RecipeSourceExportMetadata | undefined;
}

function buildRecipeSourceByComponentId(
  selectedPlan: Record<string, unknown>
): Map<string, RecipeSourceExportMetadata> {
  const batches = Array.isArray(selectedPlan.productionBatches)
    ? selectedPlan.productionBatches
    : [];
  const byComponentId = new Map<string, RecipeSourceExportMetadata>();

  for (const batch of batches) {
    const batchRecord = asRecord(batch);
    const componentId = String(batchRecord?.componentId ?? "").trim();
    const recipeSource = asRecipeSourceExportMetadata(batchRecord?.recipeSource);
    if (componentId && recipeSource) {
      byComponentId.set(componentId, recipeSource);
    }
  }

  return byComponentId;
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

  const recipeSourceByComponentId = buildRecipeSourceByComponentId(input.selectedPlan);
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
          sourceLabel: formatRecipeSourceEvidenceLabel(
            recipeSourceByComponentId.get(componentId),
            String(selectionRecord.recipeId ?? "")
          ),
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
          sourceLabel: formatRecipeSourceEvidenceLabel(
            asRecipeSourceExportMetadata(sheetRecord.recipeSource),
            String(sheetRecord.recipeId ?? "")
          ),
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
