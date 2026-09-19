import {
  procurementGroupFor,
  validPurchasedQuantities,
  type AcceptedEventSpec,
  type PurchaseItem
} from "@catering/shared-core";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "item";
}

function componentSlug(component: MenuPlanComponent): string {
  const componentIdSlug = slugify(component.componentId);
  return componentIdSlug === "item" ? slugify(component.label) : componentIdSlug;
}

export function procurementItemsForComponent(
  component: MenuPlanComponent,
  servings: number
): PurchaseItem[] {
  const productionMode = component.productionDecision?.mode;
  const purchasedElements = component.productionDecision?.purchasedElements ?? [];
  const quantities = component.productionDecision?.purchasedQuantities;
  if (quantities !== undefined && !validPurchasedQuantities(component.productionDecision)) {
    throw new Error("Zukaufmengen müssen alle zugekauften Bestandteile eindeutig abdecken.");
  }
  const quantityFor = (element: string) => quantities?.find(item => item.element === element);
  const totalFor = (element: string) => {
    const total = (quantityFor(element)?.amountPerPerson ?? 1) * servings;
    if (!Number.isFinite(total)) throw new Error("Die abgeleitete Zukaufmenge muss endlich sein.");
    return total;
  };

  if (productionMode === "hybrid" || productionMode === "convenience_purchase" ||
    (productionMode === "external_finished" && quantities !== undefined)) {
    const baseSlug = componentSlug(component);
    return purchasedElements.map((element, index) => ({
      ingredientId: `proc-${baseSlug}-${slugify(element)}-${index + 1}`,
      displayName: `${element} für ${component.label}`,
      normalizedQty: totalFor(element),
      normalizedUnit: quantityFor(element)?.unit ?? "portion",
      purchaseQty: totalFor(element),
      purchaseUnit: quantityFor(element)?.unit ?? "portion",
      group: procurementGroupFor(element),
      supplierHint: "Metro Convenience",
      sourceRecipes: [`procurement:${component.componentId}`],
      mappingConfidence: 0.7
    }));
  }

  if (productionMode === "external_finished") {
    const baseSlug = componentSlug(component);
    return [
      {
        ingredientId: `proc-${baseSlug}-finished`,
        displayName: component.label,
        normalizedQty: servings,
        normalizedUnit: "portion",
        purchaseQty: servings,
        purchaseUnit: "portion",
        group: procurementGroupFor(component.label),
        supplierHint: "Metro / externer Lieferant",
        sourceRecipes: [`procurement:${component.componentId}`],
        mappingConfidence: 0.65
      }
    ];
  }

  return [];
}

export function isBakerPurchaseLabel(label: string): boolean {
  const normalized = label.replace(/\s+/g, " ").trim();
  return /^(?:klassisch\s+)?(?:brot\s*(?:&|und|-)?\s*baguette|baguette|br[öo]tchen|broetchen|brotkorb|brot)$/i.test(
    normalized
  );
}

export function bakerPurchasedElements(label: string): string[] {
  const normalized = label.toLowerCase();
  if (/baguette/.test(normalized) && /brot/.test(normalized)) {
    return ["Baguette", "Brot"];
  }
  if (/baguette/.test(normalized)) {
    return ["Baguette"];
  }
  if (/br[öo]tchen|broetchen/.test(normalized)) {
    return ["Brötchen"];
  }
  if (/brotkorb/.test(normalized)) {
    return ["Brotkorb"];
  }
  return ["Brot"];
}

export function bakerPurchaseComponent(component: MenuPlanComponent): MenuPlanComponent | undefined {
  if (!isBakerPurchaseLabel(component.label)) {
    return undefined;
  }

  return {
    ...component,
    menuCategory: component.menuCategory ?? "classic",
    productionDecision: {
      mode: "convenience_purchase",
      purchasedElements: bakerPurchasedElements(component.label),
      notes: component.productionDecision?.notes
    }
  };
}

export function bakerPurchaseConstraintConflictReason(
  component: MenuPlanComponent,
  productionConstraints?: string[]
): string | undefined {
  if (!Array.isArray(productionConstraints) || !productionConstraints.includes("gluten_free")) {
    return undefined;
  }

  return `Harte Intake-Restriktion gluten_free blockiert den Bäcker-Zukauf für ${component.label}.`;
}
