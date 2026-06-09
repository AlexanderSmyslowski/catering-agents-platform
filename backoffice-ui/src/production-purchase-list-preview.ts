import { formatRecipeSourceEvidenceLabel } from "../../shared-core/src/export-source-metadata.js";
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

function readFirstSourceMetadata(itemRecord: Record<string, unknown>): RecipeSourceExportMetadata | undefined {
  const sourceRecipeMetadata = itemRecord.sourceRecipeMetadata;
  if (!Array.isArray(sourceRecipeMetadata)) {
    return undefined;
  }

  return asRecord(sourceRecipeMetadata[0]) as RecipeSourceExportMetadata | undefined;
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
    const fallbackRecipeId = Array.isArray(itemRecord.sourceRecipes)
      ? String(itemRecord.sourceRecipes[0] ?? "")
      : "";

    return [{
      articleName,
      quantity,
      unit,
      sourceLabel: formatRecipeSourceEvidenceLabel(
        readFirstSourceMetadata(itemRecord),
        fallbackRecipeId
      )
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
