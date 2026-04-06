import { ingredientGroupHints } from "../taxonomies/defaults.js";
import type {
  ProductionBatch,
  PurchaseItem,
  PurchaseList,
  PurchasingUnitProfile
} from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import type { PurchasingUnitProfileLibrary } from "../purchasing-units.js";
import { normalizePurchaseQuantity } from "./unit-transform.js";

function roundPurchaseNumber(value: number): number {
  return Number(value.toFixed(2));
}

function applyPurchasingUnit(
  rawQty: number,
  rawUnit: string,
  profile?: Pick<PurchasingUnitProfile, "id" | "unitLabel" | "unitSize" | "baseUnit" | "sourceType">
): Pick<PurchaseItem, "purchaseQty" | "purchaseUnit" | "appliedPurchasingUnit"> {
  if (!profile || profile.baseUnit !== rawUnit) {
    return {
      purchaseQty: roundPurchaseNumber(rawQty),
      purchaseUnit: rawUnit,
      appliedPurchasingUnit: undefined
    };
  }

  return {
    purchaseQty: Math.max(1, Math.ceil(rawQty / profile.unitSize)),
    purchaseUnit: profile.unitLabel,
    appliedPurchasingUnit: {
      unitLabel: profile.unitLabel,
      unitSize: profile.unitSize,
      baseUnit: profile.baseUnit,
      sourceTypeApplied: profile.sourceType,
      sourceRefId: profile.id,
      missingRule: false
    }
  };
}

function aggregatePurchaseItem(
  aggregate: Map<string, PurchaseItem>,
  item: PurchaseItem
) {
  const transformed = normalizePurchaseQuantity(item.normalizedQty, item.normalizedUnit);
  const key = `${item.ingredientId}:${transformed.normalizedUnit}`;
  const existing = aggregate.get(key);
  const normalizedQty = transformed.normalizedQty + (existing?.normalizedQty ?? 0);
  const appliedPurchasingUnit = item.appliedPurchasingUnit ?? existing?.appliedPurchasingUnit;
  const purchaseQty =
    appliedPurchasingUnit && appliedPurchasingUnit.baseUnit === transformed.normalizedUnit
      ? Math.max(1, Math.ceil(normalizedQty / appliedPurchasingUnit.unitSize))
      : roundPurchaseNumber(normalizedQty);
  const purchaseUnit =
    appliedPurchasingUnit && appliedPurchasingUnit.baseUnit === transformed.normalizedUnit
      ? appliedPurchasingUnit.unitLabel
      : transformed.normalizedUnit;

  aggregate.set(key, {
    ingredientId: item.ingredientId,
    displayName: item.displayName,
    normalizedQty: roundPurchaseNumber(normalizedQty),
    normalizedUnit: transformed.normalizedUnit,
    purchaseQty,
    purchaseUnit,
    appliedPurchasingUnit,
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

export async function aggregatePurchaseList(
  eventSpecId: string,
  batches: ProductionBatch[],
  additionalItems: PurchaseItem[] = [],
  options: {
    purchasingUnits?: PurchasingUnitProfileLibrary;
  } = {}
): Promise<PurchaseList> {
  const aggregate = new Map<string, PurchaseItem>();

  for (const batch of batches) {
    for (const ingredient of batch.ingredients) {
      const transformed = normalizePurchaseQuantity(
        ingredient.quantity.amount,
        ingredient.quantity.unit
      );
      const profile = options.purchasingUnits
        ? await options.purchasingUnits.getActiveIngredientPurchasingUnitProfile(
            ingredient.ingredientId,
            transformed.normalizedUnit
          )
        : undefined;
      const purchaseRule = applyPurchasingUnit(
        transformed.normalizedQty,
        transformed.normalizedUnit,
        profile
      );
      aggregatePurchaseItem(aggregate, {
        ingredientId: ingredient.ingredientId,
        displayName: ingredient.name,
        normalizedQty: transformed.normalizedQty,
        normalizedUnit: transformed.normalizedUnit,
        purchaseQty: purchaseRule.purchaseQty,
        purchaseUnit: purchaseRule.purchaseUnit,
        appliedPurchasingUnit: purchaseRule.appliedPurchasingUnit,
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
