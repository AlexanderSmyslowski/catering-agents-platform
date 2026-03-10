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
    : "Schedule missing, prep window requires review";
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
      label: `Prepare ${component.label}`,
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

