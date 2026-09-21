import {
  hasMinimalMvpCapability,
  validateProductionPlan,
  validatePurchaseList,
  type IngredientLine,
  type ProductionPlan,
  type PurchaseList,
  type Quantity,
  type RecipeSourceExportMetadata,
  type RecipeStep,
  type TrustedActor
} from "@catering/shared-core";

function projectQuantity(quantity: Quantity): Quantity {
  return {
    amount: quantity.amount,
    unit: quantity.unit,
    ...(quantity.approx === undefined ? {} : { approx: quantity.approx })
  };
}

function projectIngredient(ingredient: IngredientLine): IngredientLine {
  return {
    ingredientId: ingredient.ingredientId,
    name: ingredient.name,
    quantity: projectQuantity(ingredient.quantity),
    group: ingredient.group,
    ...(ingredient.purchaseUnit === undefined ? {} : { purchaseUnit: ingredient.purchaseUnit }),
    ...(ingredient.normalizedUnit === undefined ? {} : { normalizedUnit: ingredient.normalizedUnit })
  };
}

function projectStep(step: RecipeStep): RecipeStep {
  return {
    index: step.index,
    instruction: step.instruction,
    ...(step.durationMinutes === undefined ? {} : { durationMinutes: step.durationMinutes })
  };
}

function projectRecipeSource(source: RecipeSourceExportMetadata): RecipeSourceExportMetadata {
  return {
    recipeId: source.recipeId,
    recipeName: source.recipeName,
    sourceTier: source.sourceTier,
    originType: source.originType,
    approvalState: source.approvalState,
    reference: source.reference,
    ...(source.url === undefined ? {} : { url: source.url }),
    ...(source.publisher === undefined ? {} : { publisher: source.publisher })
  };
}

function projectPlanForNonCommercialReader(plan: ProductionPlan): ProductionPlan {
  // The persisted artifact is internal truth. Reconstructing the public
  // operational shape keeps unknown future or malformed commercial fields
  // fail-closed instead of trying to maintain an ever-growing denylist.
  return validateProductionPlan({
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    eventSpecId: plan.eventSpecId,
    readiness: {
      status: plan.readiness.status,
      reasons: [...plan.readiness.reasons]
    },
    productionBatches: plan.productionBatches.map((batch) => ({
      batchId: batch.batchId,
      componentId: batch.componentId,
      recipeId: batch.recipeId,
      scaledYield: projectQuantity(batch.scaledYield),
      batchCount: batch.batchCount,
      lossFactor: batch.lossFactor,
      gnPlan: batch.gnPlan.map((entry) => ({ container: entry.container, count: entry.count })),
      station: batch.station,
      prepWindow: batch.prepWindow,
      ingredients: batch.ingredients.map(projectIngredient),
      steps: batch.steps.map(projectStep),
      ...(batch.recipeSource === undefined ? {} : { recipeSource: projectRecipeSource(batch.recipeSource) })
    })),
    timeline: plan.timeline.map((entry) => ({ label: entry.label, at: entry.at })),
    kitchenSheets: plan.kitchenSheets.map((sheet) => ({
      title: sheet.title,
      instructions: [...sheet.instructions],
      componentId: sheet.componentId,
      productionQty: projectQuantity(sheet.productionQty),
      station: sheet.station,
      prepWindow: sheet.prepWindow,
      ingredients: sheet.ingredients.map(projectIngredient),
      steps: sheet.steps.map(projectStep),
      ...(sheet.recipeId === undefined ? {} : { recipeId: sheet.recipeId }),
      ...(sheet.recipeSource === undefined ? {} : { recipeSource: projectRecipeSource(sheet.recipeSource) }),
      ...(sheet.allergens === undefined ? {} : { allergens: [...sheet.allergens] }),
      ...(sheet.dietTags === undefined ? {} : { dietTags: [...sheet.dietTags] }),
      ...(sheet.procurementNotes === undefined ? {} : { procurementNotes: [...sheet.procurementNotes] }),
      ...(sheet.blockingNotes === undefined ? {} : { blockingNotes: [...sheet.blockingNotes] }),
      ...(sheet.gnPlan === undefined
        ? {}
        : { gnPlan: sheet.gnPlan.map((entry) => ({ container: entry.container, count: entry.count })) })
    })),
    recipeSelections: plan.recipeSelections.map((selection) => ({
      componentId: selection.componentId,
      selectionReason: selection.selectionReason,
      autoUsedInternetRecipe: selection.autoUsedInternetRecipe,
      ...(selection.recipeId === undefined ? {} : { recipeId: selection.recipeId }),
      ...(selection.searchQuery === undefined ? {} : { searchQuery: selection.searchQuery }),
      ...(selection.searchTrace === undefined ? {} : { searchTrace: [...selection.searchTrace] }),
      ...(selection.sourceTier === undefined ? {} : { sourceTier: selection.sourceTier }),
      ...(selection.qualityScore === undefined ? {} : { qualityScore: selection.qualityScore }),
      ...(selection.fitScore === undefined ? {} : { fitScore: selection.fitScore })
    })),
    ...(plan.componentReadiness === undefined
      ? {}
      : { componentReadiness: plan.componentReadiness.map((entry) => ({ ...entry })) }),
    unresolvedItems: [...plan.unresolvedItems],
    ...(plan.isFallback === undefined ? {} : { isFallback: plan.isFallback }),
    ...(plan.fallbackReason === undefined ? {} : { fallbackReason: plan.fallbackReason }),
    ...(plan.warnings === undefined ? {} : { warnings: [...plan.warnings] }),
    ...(plan.blockingIssues === undefined ? {} : { blockingIssues: [...plan.blockingIssues] })
  });
}

function projectPurchaseListForNonCommercialReader(purchaseList: PurchaseList): PurchaseList {
  return validatePurchaseList({
    schemaVersion: purchaseList.schemaVersion,
    purchaseListId: purchaseList.purchaseListId,
    eventSpecId: purchaseList.eventSpecId,
    items: purchaseList.items.map((item) => ({
      ingredientId: item.ingredientId,
      displayName: item.displayName,
      normalizedQty: item.normalizedQty,
      normalizedUnit: item.normalizedUnit,
      purchaseQty: item.purchaseQty,
      purchaseUnit: item.purchaseUnit,
      group: item.group,
      sourceRecipes: [...item.sourceRecipes],
      mappingConfidence: item.mappingConfidence,
      ...(item.supplierHint === undefined ? {} : { supplierHint: item.supplierHint }),
      ...(item.sourceRecipeMetadata === undefined
        ? {}
        : { sourceRecipeMetadata: item.sourceRecipeMetadata.map(projectRecipeSource) })
    })),
    groupingMode: "group",
    totals: {
      itemCount: purchaseList.totals.itemCount,
      groups: [...purchaseList.totals.groups]
    }
  });
}

export function projectProductionPlanReadResponse(
  actor: TrustedActor,
  plan: ProductionPlan
): ProductionPlan {
  return hasMinimalMvpCapability(actor, "commercial")
    ? plan
    : projectPlanForNonCommercialReader(plan);
}

export function projectPurchaseListReadResponse(
  actor: TrustedActor,
  purchaseList: PurchaseList
): PurchaseList {
  return hasMinimalMvpCapability(actor, "commercial")
    ? purchaseList
    : projectPurchaseListForNonCommercialReader(purchaseList);
}
