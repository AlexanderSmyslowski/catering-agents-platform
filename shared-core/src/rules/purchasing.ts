import type { ProductionBatch, PurchaseItem, PurchaseList } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";

function purchaseUnitFor(unit: string): string {
  if (unit === "g") {
    return "kg";
  }

  return unit;
}

function purchaseQtyFor(amount: number, unit: string): number {
  if (unit === "g") {
    return Number((amount / 1000).toFixed(2));
  }

  return Number(amount.toFixed(2));
}

export function aggregatePurchaseList(
  eventSpecId: string,
  batches: ProductionBatch[]
): PurchaseList {
  const aggregate = new Map<string, PurchaseItem>();

  for (const batch of batches) {
    for (const ingredient of batch.ingredients) {
      const key = `${ingredient.ingredientId}:${ingredient.quantity.unit}`;
      const existing = aggregate.get(key);
      const normalizedQty = ingredient.quantity.amount + (existing?.normalizedQty ?? 0);

      aggregate.set(key, {
        ingredientId: ingredient.ingredientId,
        displayName: ingredient.name,
        normalizedQty: Number(normalizedQty.toFixed(2)),
        normalizedUnit: ingredient.quantity.unit,
        purchaseQty: purchaseQtyFor(normalizedQty, ingredient.quantity.unit),
        purchaseUnit: purchaseUnitFor(ingredient.quantity.unit),
        group: ingredient.group,
        supplierHint: ingredient.group === "beverages" ? "Metro Drinks" : "Metro Fresh",
        sourceRecipes: [...new Set([...(existing?.sourceRecipes ?? []), batch.recipeId])],
        mappingConfidence: 0.95
      });
    }
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

