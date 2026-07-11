import { ingredientGroupHints } from "../taxonomies/defaults.js";
import { metroGroupSortIndex } from "../taxonomies/metro-groups.js";
import type { ProductionBatch, ProductionPlan, PurchaseItem, PurchaseList } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import { mergeRecipeSourceMetadata } from "../export-source-metadata.js";

export type PurchaseCoverageStatus = "passed" | "blocked";

export interface PurchaseCoverageIngredientRef {
  batchId: string;
  componentId: string;
  recipeId: string;
  ingredientId: string;
  name: string;
}

export interface CoveredPurchaseIngredient extends PurchaseCoverageIngredientRef {
  purchaseListId: string;
  purchaseItemIngredientId: string;
  displayName: string;
}

export interface DocumentedProcurementException {
  componentId: string;
  ingredientId: string;
  displayName: string;
  purchaseListId: string;
}

export interface PurchaseCoverageCheck {
  status: PurchaseCoverageStatus;
  coveredIngredients: CoveredPurchaseIngredient[];
  missingIngredients: PurchaseCoverageIngredientRef[];
  documentedProcurementExceptions: DocumentedProcurementException[];
}

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

function normalizePurchaseArticleName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

function purchaseAggregateKey(item: PurchaseItem): string {
  // Ingredient IDs belong to recipes; the visible article identity belongs to purchasing.
  return JSON.stringify([
    normalizePurchaseArticleName(item.displayName),
    item.normalizedUnit,
    item.group
  ]);
}

function aggregatePurchaseItem(
  aggregate: Map<string, PurchaseItem>,
  item: PurchaseItem
) {
  const key = purchaseAggregateKey(item);
  const existing = aggregate.get(key);
  const normalizedQty = item.normalizedQty + (existing?.normalizedQty ?? 0);

  aggregate.set(key, {
    ingredientId: existing?.ingredientId ?? item.ingredientId,
    displayName: existing?.displayName ?? item.displayName,
    normalizedQty: Number(normalizedQty.toFixed(2)),
    normalizedUnit: item.normalizedUnit,
    purchaseQty: purchaseQtyFor(normalizedQty, item.normalizedUnit),
    purchaseUnit: purchaseUnitFor(item.normalizedUnit),
    group: item.group,
    supplierHint: existing?.supplierHint ?? item.supplierHint,
    sourceRecipes: [...new Set([...(existing?.sourceRecipes ?? []), ...item.sourceRecipes])],
    sourceRecipeMetadata: mergeRecipeSourceMetadata(
      existing?.sourceRecipeMetadata,
      item.sourceRecipeMetadata
    ),
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
      aggregatePurchaseItem(aggregate, {
        ingredientId: ingredient.ingredientId,
        displayName: ingredient.name,
        normalizedQty: ingredient.quantity.amount,
        normalizedUnit: ingredient.quantity.unit,
        purchaseQty: purchaseQtyFor(ingredient.quantity.amount, ingredient.quantity.unit),
        purchaseUnit: purchaseUnitFor(ingredient.quantity.unit),
        group: ingredient.group,
        supplierHint: ingredient.group === "getraenke_als_zutat" ? "Metro Drinks" : "Metro Fresh",
        sourceRecipes: [batch.recipeId],
        sourceRecipeMetadata: batch.recipeSource ? [batch.recipeSource] : [],
        mappingConfidence: 0.95
      });
    }
  }

  for (const item of additionalItems) {
    aggregatePurchaseItem(aggregate, item);
  }

  const items = [...aggregate.values()].sort(
    (left, right) =>
      metroGroupSortIndex(left.group) - metroGroupSortIndex(right.group) ||
      left.group.localeCompare(right.group) ||
      left.displayName.localeCompare(right.displayName)
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

function normalizeCoverageKey(value: string): string {
  return normalizePurchaseArticleName(value);
}

function purchaseItemCoversIngredient(item: PurchaseItem, ingredient: PurchaseCoverageIngredientRef): boolean {
  return (
    item.ingredientId === ingredient.ingredientId ||
    normalizeCoverageKey(item.displayName) === normalizeCoverageKey(ingredient.name)
  );
}

function productionIngredientRef(
  batch: ProductionBatch,
  ingredient: ProductionBatch["ingredients"][number]
): PurchaseCoverageIngredientRef {
  return {
    batchId: batch.batchId,
    componentId: batch.componentId,
    recipeId: batch.recipeId,
    ingredientId: ingredient.ingredientId,
    name: ingredient.name
  };
}

function documentedProcurementExceptions(purchaseList: PurchaseList): DocumentedProcurementException[] {
  return purchaseList.items.flatMap((item) =>
    item.sourceRecipes.flatMap((sourceRecipe) => {
      const match = sourceRecipe.match(/^procurement:(.+)$/);
      if (!match) {
        return [];
      }

      return [
        {
          componentId: match[1],
          ingredientId: item.ingredientId,
          displayName: item.displayName,
          purchaseListId: purchaseList.purchaseListId
        }
      ];
    })
  );
}

export function checkPurchaseCoverage(
  productionPlan: ProductionPlan,
  purchaseList: PurchaseList
): PurchaseCoverageCheck {
  const coveredIngredients: CoveredPurchaseIngredient[] = [];
  const missingIngredients: PurchaseCoverageIngredientRef[] = [];

  for (const batch of productionPlan.productionBatches) {
    for (const ingredient of batch.ingredients) {
      const ingredientRef = productionIngredientRef(batch, ingredient);
      const coveringItem = purchaseList.items.find((item) =>
        purchaseItemCoversIngredient(item, ingredientRef)
      );

      if (!coveringItem) {
        missingIngredients.push(ingredientRef);
        continue;
      }

      coveredIngredients.push({
        ...ingredientRef,
        purchaseListId: purchaseList.purchaseListId,
        purchaseItemIngredientId: coveringItem.ingredientId,
        displayName: coveringItem.displayName
      });
    }
  }

  return {
    status: missingIngredients.length === 0 ? "passed" : "blocked",
    coveredIngredients,
    missingIngredients,
    documentedProcurementExceptions: documentedProcurementExceptions(purchaseList)
  };
}
