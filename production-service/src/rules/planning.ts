import {
  aggregatePurchaseList,
  mergeReadiness,
  procurementGroupFor,
  SCHEMA_VERSION,
  toProductionBatch,
  validateAcceptedEventSpec,
  validateProductionPlan,
  validatePurchaseList,
  type AcceptedEventSpec,
  type PurchaseItem,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";
import { RecipeDiscoveryService } from "../recipe-discovery/service.js";

function stationFor(label: string): string {
  if (/salat|dessert/i.test(label)) {
    return "cold-kitchen";
  }

  if (/kaffee|tee/i.test(label)) {
    return "beverage-station";
  }

  return "hot-kitchen";
}

function prepWindowFor(spec: AcceptedEventSpec): string {
  return spec.event.date
    ? `${spec.event.date} T-1`
    : "Zeitfenster offen, Produktionsvorlauf bitte manuell prüfen";
}

function gnPlanFor(servings: number): { container: string; count: number }[] {
  return [
    {
      container: servings > 40 ? "GN 1/1" : "GN 1/2",
      count: Math.max(1, Math.ceil(servings / 20))
    }
  ];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function procurementItemsForComponent(
  component: AcceptedEventSpec["menuPlan"][number],
  servings: number
): PurchaseItem[] {
  const productionMode = component.productionDecision?.mode;
  const purchasedElements = component.productionDecision?.purchasedElements ?? [];

  if (productionMode === "hybrid") {
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

  if (productionMode === "convenience_purchase") {
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

export async function buildProductionArtifacts(
  eventSpecInput: AcceptedEventSpec,
  discoveryService: RecipeDiscoveryService
): Promise<{ productionPlan: ProductionPlan; purchaseList: PurchaseList }> {
  const eventSpec = validateAcceptedEventSpec(eventSpecInput);
  const productionBatches: ProductionPlan["productionBatches"] = [];
  const procurementItems: PurchaseItem[] = [];
  const kitchenSheets: ProductionPlan["kitchenSheets"] = [];
  const timeline: ProductionPlan["timeline"] = [];
  const recipeSelections: ProductionPlan["recipeSelections"] = [];
  const unresolvedItems: string[] = [...(eventSpec.missingFields ?? [])];

  for (const component of eventSpec.menuPlan) {
    const servings = component.servings ?? eventSpec.attendees.expected ?? 0;
    const productionMode = component.productionDecision?.mode;
    const purchasedElements = component.productionDecision?.purchasedElements ?? [];

    if (!component.menuCategory) {
      recipeSelections.push({
        componentId: component.componentId,
        selectionReason: "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.",
        autoUsedInternetRecipe: false
      });
      unresolvedItems.push(`Klassifikation für ${component.label} fehlt.`);
      continue;
    }

    if (!productionMode) {
      recipeSelections.push({
        componentId: component.componentId,
        selectionReason:
          "Herstellungsentscheidung fehlt. Bitte Eigenproduktion, Hybrid, Convenience-Zukauf oder Fertigprodukt festlegen.",
        autoUsedInternetRecipe: false
      });
      unresolvedItems.push(`Herstellungsentscheidung für ${component.label} fehlt.`);
      continue;
    }

    if ((productionMode === "hybrid" || productionMode === "convenience_purchase") && purchasedElements.length === 0) {
      recipeSelections.push({
        componentId: component.componentId,
        selectionReason:
          "Hybrid-/Convenience-Entscheidung ist gesetzt, aber die zugekauften Bestandteile sind noch nicht benannt.",
        autoUsedInternetRecipe: false
      });
      unresolvedItems.push(`Zugekaufte Bestandteile für ${component.label} fehlen.`);
      continue;
    }

    if (productionMode === "convenience_purchase" || productionMode === "external_finished") {
      procurementItems.push(...procurementItemsForComponent(component, servings));
      recipeSelections.push({
        componentId: component.componentId,
        selectionReason:
          productionMode === "convenience_purchase"
            ? "Komponente ist als Convenience-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen."
            : "Komponente ist als Fertigprodukt markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.",
        autoUsedInternetRecipe: false
      });
      continue;
    }

    procurementItems.push(...procurementItemsForComponent(component, servings));

    const resolution = component.recipeOverrideId
      ? await discoveryService.resolveRecipeOverride(component.recipeOverrideId, component)
      : await discoveryService.resolveRecipe(component, eventSpec);
    recipeSelections.push(resolution.selection);
    unresolvedItems.push(...resolution.unresolvedItems);

    if (!resolution.recipe || servings <= 0) {
      continue;
    }

    const draftBatch = toProductionBatch(resolution.recipe, component.componentId, servings);
    const batchId = `batch-${eventSpec.specId}-${component.componentId}`;
    const batch = {
      batchId,
      ...draftBatch,
      station: stationFor(component.label),
      prepWindow: prepWindowFor(eventSpec),
      gnPlan: gnPlanFor(servings)
    };

    productionBatches.push(batch);
    kitchenSheets.push({
      title: `${component.label} - ${resolution.recipe.name}`,
      instructions: batch.steps.map((step) => `${step.index}. ${step.instruction}`)
    });
    timeline.push({
      label: `${component.label} vorbereiten`,
      at: batch.prepWindow
    });
  }

  const readiness = mergeReadiness(eventSpec.readiness, unresolvedItems);
  const productionPlan = validateProductionPlan({
    schemaVersion: SCHEMA_VERSION,
    planId: `plan-${eventSpec.specId}`,
    eventSpecId: eventSpec.specId,
    readiness,
    productionBatches,
    timeline,
    kitchenSheets,
    recipeSelections,
    unresolvedItems: [...new Set(unresolvedItems)]
  });

  const purchaseList = validatePurchaseList(
    aggregatePurchaseList(eventSpec.specId, productionBatches, procurementItems)
  );

  return {
    productionPlan,
    purchaseList
  };
}
