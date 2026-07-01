import {
  recipeSourceOriginLabel,
  recipeSourceReferenceLabel
} from "../../shared-core/src/export-source-metadata.js";
import type { RecipeSourceExportMetadata } from "../../shared-core/src/types.js";

export type PurchaseListPreviewItem = {
  articleName: string;
  quantity: string;
  unit: string;
  sourceLabel: string;
};

export type PurchaseListQualityWarning = {
  code: "instruction_like_purchase_item";
  itemCount: number;
  examples: string[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function readPurchaseListItems(purchaseList: Record<string, unknown>): unknown[] {
  if (Array.isArray(purchaseList.items)) {
    return purchaseList.items;
  }

  if (Array.isArray(purchaseList.positions)) {
    return purchaseList.positions;
  }

  if (Array.isArray(purchaseList.entries)) {
    return purchaseList.entries;
  }

  return [];
}

function readSourceMetadata(itemRecord: Record<string, unknown>): RecipeSourceExportMetadata[] {
  const sourceRecipeMetadata = itemRecord.sourceRecipeMetadata;
  if (!Array.isArray(sourceRecipeMetadata)) {
    return [];
  }

  return sourceRecipeMetadata.flatMap((source) => {
    const record = asRecord(source);
    return record ? [record as unknown as RecipeSourceExportMetadata] : [];
  });
}

function readSourceRecipeIds(itemRecord: Record<string, unknown>): string[] {
  const sourceRecipes = itemRecord.sourceRecipes;
  if (!Array.isArray(sourceRecipes)) {
    return [];
  }

  return sourceRecipes
    .map((recipeId) => String(recipeId).trim())
    .filter(Boolean);
}

function compactLabelParts(parts: Array<string | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

function formatPreviewSourceMetadataLabel(source: RecipeSourceExportMetadata): string {
  const referenceLabel = recipeSourceReferenceLabel(source);
  const shouldShowReference =
    source.originType !== "internal_db" && referenceLabel !== "Quelle offen";

  return compactLabelParts([
    source.recipeName,
    recipeSourceOriginLabel(source),
    shouldShowReference ? referenceLabel : undefined
  ]).join(" · ");
}

function formatSourceLabel(itemRecord: Record<string, unknown>): string {
  const sourceMetadata = readSourceMetadata(itemRecord);
  const metadataRecipeIds = new Set(sourceMetadata.map((source) => source.recipeId).filter(Boolean));
  const labels = [
    ...sourceMetadata.map((source) => formatPreviewSourceMetadataLabel(source)),
    ...readSourceRecipeIds(itemRecord)
      .filter((recipeId) => !metadataRecipeIds.has(recipeId))
      .map(() => "Quelle offen")
  ];
  const uniqueLabels = [...new Set(labels)];

  return uniqueLabels.length > 0 ? uniqueLabels.join("; ") : "Quelle offen";
}

function looksLikeRecipeInstruction(value: string): boolean {
  const normalized = value.trim();
  const instructionStartPattern =
    /^(?:\d+[.)]\s*)?(?:add|bake|boil|braise|chop|combine|cook|fry|garnish|grill|heat|knead|marinate|mix|prepare|roast|season|serve|shape|slice|simmer|stir|whisk)\b/i;
  const instructionPhrasePattern =
    /\b(?:and|with)\b.*\b(?:bake|boil|braise|cook|fry|grill|mix|roast|serve|shape|simmer)\b/i;

  return instructionStartPattern.test(normalized) || instructionPhrasePattern.test(normalized);
}

export function getPurchaseListPreviewItems(
  purchaseList: Record<string, unknown>
): PurchaseListPreviewItem[] {
  const rawItems = readPurchaseListItems(purchaseList);

  return rawItems.slice(0, 5).flatMap((item) => {
    const itemRecord = asRecord(item);
    if (!itemRecord) {
      return [];
    }

    const quantityRecord = asRecord(itemRecord.quantity);
    const articleName =
      readStringOrNumber(itemRecord, ["displayName", "articleName", "name", "label", "ingredientName"]) ??
      "Artikel";
    const quantity =
      readStringOrNumber(itemRecord, ["purchaseQty", "normalizedQty", "qty", "amount"]) ??
      readStringOrNumber(quantityRecord, ["amount"]) ??
      "-";
    const unit =
      readStringOrNumber(itemRecord, ["purchaseUnit", "normalizedUnit", "unit"]) ??
      readStringOrNumber(quantityRecord, ["unit"]) ??
      "-";

    return [{
      articleName,
      quantity,
      unit,
      sourceLabel: formatSourceLabel(itemRecord)
    }];
  });
}

export function getPurchaseListQualityWarnings(
  purchaseList: Record<string, unknown>
): PurchaseListQualityWarning[] {
  const instructionLikeItems = readPurchaseListItems(purchaseList).flatMap((item) => {
    const itemRecord = asRecord(item);
    const articleName =
      readStringOrNumber(itemRecord, ["displayName", "articleName", "name", "label", "ingredientName"]) ?? "";

    return articleName && looksLikeRecipeInstruction(articleName) ? [articleName] : [];
  });

  if (instructionLikeItems.length === 0) {
    return [];
  }

  return [
    {
      code: "instruction_like_purchase_item",
      itemCount: instructionLikeItems.length,
      examples: [...new Set(instructionLikeItems)].slice(0, 3)
    }
  ];
}
