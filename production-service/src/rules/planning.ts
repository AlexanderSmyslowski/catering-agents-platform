import {
  aggregatePurchaseList,
  mergeReadiness,
  SCHEMA_VERSION,
  toProductionBatch,
  validateAcceptedEventSpec,
  validateProductionPlan,
  validatePurchaseList,
  type AcceptedEventSpec,
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

export async function buildProductionArtifacts(
  eventSpecInput: AcceptedEventSpec,
  discoveryService: RecipeDiscoveryService
): Promise<{ productionPlan: ProductionPlan; purchaseList: PurchaseList }> {
  const eventSpec = validateAcceptedEventSpec(eventSpecInput);
  const productionBatches: ProductionPlan["productionBatches"] = [];
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
      recipeSelections.push({
        componentId: component.componentId,
        selectionReason:
          productionMode === "convenience_purchase"
            ? "Komponente ist als Convenience-Zukauf markiert und wird nicht über Rezeptlogik aufgelöst."
            : "Komponente ist als Fertigprodukt markiert und wird nicht über Rezeptlogik aufgelöst.",
        autoUsedInternetRecipe: false
      });
      unresolvedItems.push(`Beschaffungsmenge für ${component.label} manuell prüfen.`);
      continue;
    }

    const resolution = await discoveryService.resolveRecipe(component, eventSpec);
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
    aggregatePurchaseList(eventSpec.specId, productionBatches)
  );

  return {
    productionPlan,
    purchaseList
  };
}
