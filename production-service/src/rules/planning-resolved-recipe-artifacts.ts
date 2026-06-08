import {
  toProductionBatch,
  type AcceptedEventSpec,
  type MenuComponent,
  type ProductionPlan,
  type Recipe
} from "@catering/shared-core";
import {
  gnPlanFor,
  prepWindowFor,
  purchasedElementsSummary,
  stationFor
} from "./production-sheet-builders.js";

export type ResolvedRecipePlanningArtifacts = {
  batch: ProductionPlan["productionBatches"][number];
  kitchenSheet: ProductionPlan["kitchenSheets"][number];
  timelineItem: ProductionPlan["timeline"][number];
};

export type ResolvedRecipePlanningArtifactsInput = {
  eventSpec: AcceptedEventSpec;
  component: MenuComponent;
  recipe: Recipe;
  servings: number;
};

export function buildResolvedRecipePlanningArtifacts({
  eventSpec,
  component,
  recipe,
  servings
}: ResolvedRecipePlanningArtifactsInput): ResolvedRecipePlanningArtifacts {
  const draftBatch = toProductionBatch(recipe, component.componentId, servings);
  const batchId = `batch-${eventSpec.specId}-${component.componentId}`;
  const batch = {
    batchId,
    ...draftBatch,
    station: stationFor(component.label),
    prepWindow: prepWindowFor(eventSpec),
    gnPlan: gnPlanFor(servings)
  };
  const procurementNotes = component.productionDecision?.mode === "hybrid"
    ? [`Zukaufteil separat disponieren: ${purchasedElementsSummary(component)}.`]
    : [];

  return {
    batch,
    kitchenSheet: {
      title: `${component.label} - ${recipe.name}`,
      componentId: component.componentId,
      recipeId: recipe.recipeId,
      productionQty: batch.scaledYield,
      station: batch.station,
      prepWindow: batch.prepWindow,
      ingredients: batch.ingredients,
      steps: batch.steps,
      recipeSource: batch.recipeSource,
      allergens: recipe.allergens ?? [],
      dietTags: recipe.dietTags ?? [],
      gnPlan: batch.gnPlan,
      ...(procurementNotes.length > 0 ? { procurementNotes } : {}),
      instructions: [
        ...batch.steps.map((step) => `${step.index}. ${step.instruction}`),
        ...procurementNotes
      ]
    },
    timelineItem: {
      label: `${component.label} vorbereiten`,
      at: batch.prepWindow
    }
  };
}
