import type { RecipeSourceExportMetadata } from "../../shared-core/src/types.js";
import {
  translateMenuCategory,
  translateProductionMode
} from "./production-language.js";
import { formatPreviewRecipeSourceLabel } from "./production-purchase-list-preview.js";

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

export type ProductionPlanSecondaryRecipeSource = RecipeSourceExportMetadata;

export type ProductionPlanSecondaryBatch = {
  componentId?: string;
  recipeSource?: ProductionPlanSecondaryRecipeSource;
};

export type ProductionPlanSecondaryRecipeSelection = {
  componentId?: string;
  recipeId?: string;
  selectionReason?: string;
  qualityScore?: number | string;
  fitScore?: number | string;
  searchTrace?: unknown[];
};

export type ProductionPlanSecondaryKitchenSheet = {
  title?: string;
  recipeId?: string;
  recipeSource?: ProductionPlanSecondaryRecipeSource;
  instructions?: unknown[];
};

export type ProductionPlanSecondaryComponent = {
  label?: string;
  menuCategory?: string;
  productionDecision?: {
    mode?: string;
  };
};

export type ProductionPlanSecondaryPlan = {
  productionBatches?: unknown[];
  recipeSelections?: unknown[];
  kitchenSheets?: unknown[];
};

export type ProductionPlanSecondaryDetailsInput = {
  selectedPlan?: ProductionPlanSecondaryPlan;
  selectedPlanComponentsById: Map<string, ProductionPlanSecondaryComponent>;
  archivedPlans: unknown[];
  showArchivedPlans: boolean;
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

function asOptionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

function asRecipeSourceExportMetadata(value: unknown): RecipeSourceExportMetadata | undefined {
  const record = asRecord(value);
  return record as RecipeSourceExportMetadata | undefined;
}

function formatSearchTraceEntry(entry: unknown, recipeId?: string): string {
  const label = String(entry);
  const normalizedRecipeId = recipeId?.trim();
  return normalizedRecipeId ? label.replace(` (${normalizedRecipeId})`, "") : label;
}

function asProductionPlanSecondaryBatch(value: unknown): ProductionPlanSecondaryBatch {
  const record = asRecord(value);
  return {
    componentId: asOptionalString(record?.componentId),
    recipeSource: asRecipeSourceExportMetadata(record?.recipeSource)
  };
}

function asProductionPlanSecondaryRecipeSelection(value: unknown): ProductionPlanSecondaryRecipeSelection {
  const record = asRecord(value);
  return {
    componentId: asOptionalString(record?.componentId),
    recipeId: asOptionalString(record?.recipeId),
    selectionReason: asOptionalString(record?.selectionReason),
    qualityScore:
      typeof record?.qualityScore === "number" || typeof record?.qualityScore === "string"
        ? record.qualityScore
        : undefined,
    fitScore:
      typeof record?.fitScore === "number" || typeof record?.fitScore === "string"
        ? record.fitScore
        : undefined,
    searchTrace: Array.isArray(record?.searchTrace) ? record.searchTrace : undefined
  };
}

function asProductionPlanSecondaryKitchenSheet(value: unknown): ProductionPlanSecondaryKitchenSheet {
  const record = asRecord(value);
  return {
    title: asOptionalString(record?.title),
    recipeId: asOptionalString(record?.recipeId),
    recipeSource: asRecipeSourceExportMetadata(record?.recipeSource),
    instructions: Array.isArray(record?.instructions) ? record.instructions : undefined
  };
}

function buildRecipeSourceByComponentId(
  selectedPlan: ProductionPlanSecondaryPlan
): Map<string, RecipeSourceExportMetadata> {
  const batches = Array.isArray(selectedPlan.productionBatches)
    ? selectedPlan.productionBatches
    : [];
  const byComponentId = new Map<string, RecipeSourceExportMetadata>();

  for (const batch of batches) {
    const normalizedBatch = asProductionPlanSecondaryBatch(batch);
    const componentId = String(normalizedBatch.componentId ?? "").trim();
    if (componentId && normalizedBatch.recipeSource) {
      byComponentId.set(componentId, normalizedBatch.recipeSource);
    }
  }

  return byComponentId;
}

export function buildProductionPlanSecondaryDetailsState(
  input: ProductionPlanSecondaryDetailsInput
): ProductionPlanSecondaryDetailsState | undefined {
  if (!input.selectedPlan) {
    return undefined;
  }

  const recipeSourceByComponentId = buildRecipeSourceByComponentId(input.selectedPlan);
  const recipeSelections = Array.isArray(input.selectedPlan.recipeSelections)
    ? input.selectedPlan.recipeSelections.map((selection, index) => {
        const normalizedSelection = asProductionPlanSecondaryRecipeSelection(selection);
        const componentId = String(normalizedSelection.componentId ?? "");
        const component = input.selectedPlanComponentsById.get(componentId);
        const componentLabel = String(component?.label ?? (componentId || "-"));
        const qualityScore = formatPercent(normalizedSelection.qualityScore);
        const fitScore = formatPercent(normalizedSelection.fitScore);

        return {
          key: `${componentId || "selection"}-${index}`,
          componentLabel,
          selectionReasonLabel: String(normalizedSelection.selectionReason ?? "-"),
          componentDetailLabel: component
            ? `Kategorie: ${translateMenuCategory(String(component.menuCategory ?? ""))} · Herstellungsart: ${translateProductionMode(
                String(component.productionDecision?.mode ?? "")
              )}`
            : undefined,
          sourceLabel: formatPreviewRecipeSourceLabel(recipeSourceByComponentId.get(componentId)),
          scoreLabel:
            qualityScore || fitScore
              ? `${qualityScore ? `Qualität ${qualityScore}` : "Qualität offen"}${fitScore ? ` · Passung ${fitScore}` : ""}`
              : undefined,
          searchTrace:
            normalizedSelection.searchTrace?.map((entry) =>
              formatSearchTraceEntry(entry, normalizedSelection.recipeId)
            ) ?? []
        };
      })
    : [];

  const kitchenSheets = Array.isArray(input.selectedPlan.kitchenSheets)
    ? input.selectedPlan.kitchenSheets.map((sheet, sheetIndex) => {
        const normalizedSheet = asProductionPlanSecondaryKitchenSheet(sheet);
        return {
          key: `${String(normalizedSheet.title ?? "Arbeitsblatt")}-${sheetIndex}`,
          title: String(normalizedSheet.title ?? "Arbeitsblatt"),
          sourceLabel: formatPreviewRecipeSourceLabel(normalizedSheet.recipeSource),
          instructions: normalizedSheet.instructions?.map((entry) => String(entry)) ?? []
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
