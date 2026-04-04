import { ingredientGroupHints } from "../taxonomies/defaults.js";
import type { ProductionBatch, PurchaseItem, PurchaseList } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import { normalizePurchaseQuantity } from "./unit-transform.js";

function aggregatePurchaseItem(
  aggregate: Map<string, PurchaseItem>,
  item: PurchaseItem
) {
  const transformed = normalizePurchaseQuantity(item.normalizedQty, item.normalizedUnit);
  const key = `${item.ingredientId}:${transformed.normalizedUnit}`;
  const existing = aggregate.get(key);
  const normalizedQty = transformed.normalizedQty + (existing?.normalizedQty ?? 0);

  aggregate.set(key, {
    ingredientId: item.ingredientId,
    displayName: item.displayName,
    normalizedQty: Number(normalizedQty.toFixed(2)),
    normalizedUnit: transformed.normalizedUnit,
    purchaseQty: Number(normalizedQty.toFixed(2)),
    purchaseUnit: transformed.normalizedUnit,
    group: item.group,
    supplierHint: item.supplierHint ?? existing?.supplierHint,
    sourceRecipes: [...new Set([...(existing?.sourceRecipes ?? []), ...item.sourceRecipes])],
    mappingConfidence: Math.max(item.mappingConfidence, existing?.mappingConfidence ?? 0)
  });
}

export function procurementGroupFor(value: string): string {
  const normalized = value.toLowerCase();
  const directMatch = Object.entries(ingredientGroupHints).find(([keyword]) =>
    normalized.includes(keyword)
  );
  if (directMatch) {
    return directMatch[1];
  }

  if (/(brot|baguette|brötchen|broetchen|teig|blätterteig|blaetterteig|boden|croissant)/i.test(normalized)) {
    return "bakery";
  }
  if (/(dressing|vinaigrette|sauce|saucenbasis|dip)/i.test(normalized)) {
    return "dry_goods";
  }
  if (/(gemüse|gemuese|salat|kraut|kartoffel|nudel)/i.test(normalized)) {
    return "produce";
  }
  if (/(kaffee|tee|wasser|saft|limonade)/i.test(normalized)) {
    return "beverages";
  }

  return "misc";
}

export function aggregatePurchaseList(
  eventSpecId: string,
  batches: ProductionBatch[],
  additionalItems: PurchaseItem[] = []
): PurchaseList {
  const aggregate = new Map<string, PurchaseItem>();

  for (const batch of batches) {
    for (const ingredient of batch.ingredients) {
      const transformed = normalizePurchaseQuantity(
        ingredient.quantity.amount,
        ingredient.quantity.unit
      );
      aggregatePurchaseItem(aggregate, {
        ingredientId: ingredient.ingredientId,
        displayName: ingredient.name,
        normalizedQty: transformed.normalizedQty,
        normalizedUnit: transformed.normalizedUnit,
        purchaseQty: transformed.normalizedQty,
        purchaseUnit: transformed.normalizedUnit,
        group: ingredient.group,
        supplierHint: ingredient.group === "beverages" ? "Metro Drinks" : "Metro Fresh",
        sourceRecipes: [batch.recipeId],
        mappingConfidence: 0.95
      });
    }
  }

  for (const item of additionalItems) {
    aggregatePurchaseItem(aggregate, item);
  }

  const items = [...aggregate.values()].sort((left, right) =>
    left.group.localeCompare(right.group) || left.displayName.localeCompare(right.displayName)
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: `purchase-${eventSpecId}`,
    eventSpecId,
    items,
    groupingMode: "group",
    totals: {
      itemCount: items.length,
      groups: [...new Set(items.map((item) => item.group))]
    }
  };
}
