import { ingredientGroupHints } from "../taxonomies/defaults.js";
import { SCHEMA_VERSION } from "../types.js";
function purchaseUnitFor(unit) {
    if (unit === "g") {
        return "kg";
    }
    return unit;
}
function purchaseQtyFor(amount, unit) {
    if (unit === "g") {
        return Number((amount / 1000).toFixed(2));
    }
    return Number(amount.toFixed(2));
}
function aggregatePurchaseItem(aggregate, item) {
    const key = `${item.ingredientId}:${item.normalizedUnit}`;
    const existing = aggregate.get(key);
    const normalizedQty = item.normalizedQty + (existing?.normalizedQty ?? 0);
    aggregate.set(key, {
        ingredientId: item.ingredientId,
        displayName: item.displayName,
        normalizedQty: Number(normalizedQty.toFixed(2)),
        normalizedUnit: item.normalizedUnit,
        purchaseQty: purchaseQtyFor(normalizedQty, item.normalizedUnit),
        purchaseUnit: purchaseUnitFor(item.normalizedUnit),
        group: item.group,
        supplierHint: item.supplierHint ?? existing?.supplierHint,
        sourceRecipes: [...new Set([...(existing?.sourceRecipes ?? []), ...item.sourceRecipes])],
        mappingConfidence: Math.max(item.mappingConfidence, existing?.mappingConfidence ?? 0)
    });
}
export function procurementGroupFor(value) {
    const normalized = value.toLowerCase();
    const directMatch = Object.entries(ingredientGroupHints).find(([keyword]) => normalized.includes(keyword));
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
export function aggregatePurchaseList(eventSpecId, batches, additionalItems = []) {
    const aggregate = new Map();
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
                supplierHint: ingredient.group === "beverages" ? "Metro Drinks" : "Metro Fresh",
                sourceRecipes: [batch.recipeId],
                mappingConfidence: 0.95
            });
        }
    }
    for (const item of additionalItems) {
        aggregatePurchaseItem(aggregate, item);
    }
    const items = [...aggregate.values()].sort((left, right) => left.group.localeCompare(right.group) || left.displayName.localeCompare(right.displayName));
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
function normalizeCoverageKey(value) {
    return value.trim().toLowerCase();
}
function purchaseItemCoversIngredient(item, ingredient) {
    return (item.ingredientId === ingredient.ingredientId ||
        normalizeCoverageKey(item.displayName) === normalizeCoverageKey(ingredient.name));
}
function productionIngredientRef(batch, ingredient) {
    return {
        batchId: batch.batchId,
        componentId: batch.componentId,
        recipeId: batch.recipeId,
        ingredientId: ingredient.ingredientId,
        name: ingredient.name
    };
}
function documentedProcurementExceptions(purchaseList) {
    return purchaseList.items.flatMap((item) => item.sourceRecipes.flatMap((sourceRecipe) => {
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
    }));
}
export function checkPurchaseCoverage(productionPlan, purchaseList) {
    const coveredIngredients = [];
    const missingIngredients = [];
    for (const batch of productionPlan.productionBatches) {
        for (const ingredient of batch.ingredients) {
            const ingredientRef = productionIngredientRef(batch, ingredient);
            const coveringItem = purchaseList.items.find((item) => purchaseItemCoversIngredient(item, ingredientRef));
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
