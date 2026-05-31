import {
  procurementGroupFor,
  type AcceptedEventSpec,
  type PurchaseItem
} from "@catering/shared-core";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function procurementItemsForComponent(
  component: MenuPlanComponent,
  servings: number
): PurchaseItem[] {
  const productionMode = component.productionDecision?.mode;
  const purchasedElements = component.productionDecision?.purchasedElements ?? [];

  if (productionMode === "hybrid" || productionMode === "convenience_purchase") {
    return purchasedElements.map((element, index) => ({
      ingredientId: `proc-${slugify(component.componentId)}-${slugify(element)}-${index + 1}`,
      displayName: `${element} für ${component.label}`,
      normalizedQty: servings,
      normalizedUnit: "portion",
      purchaseQty: servings,
      purchaseUnit: "portion",
      group: procurementGroupFor(element),
      supplierHint: "Metro Convenience",
      sourceRecipes: [`procurement:${component.componentId}`],
      mappingConfidence: 0.7
    }));
  }

  if (productionMode === "external_finished") {
    return [
      {
        ingredientId: `proc-${slugify(component.componentId)}-finished`,
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
