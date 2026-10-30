import { areJsonValuesEqual, createProductionApplyManifest, type BusinessContext, type CriticalSectionTarget } from "@catering/shared-core";
import { ProductionStore } from "./repositories/production-store.js";
import { projectDietaryQuestionReviews } from "./rules/dietary-question-review.js";
import { productionDecisionRepositoryFor } from "./repositories/production-decision-repository.js";

function conflict(): never {
  throw Object.assign(new Error("Der übernommene Produktionsstand ist nicht eindeutig nachweisbar."), { statusCode: 409 });
}

/** Resolve the immutable published chain; a result event alone is never a snapshot. */
export async function resolveLastAppliedSnapshot(store: ProductionStore, context: BusinessContext, caseId: string, selectedPlanId?: string) {
  const discover = async (reader: ProductionStore) => {
    const productionCase = await reader.getCase(context, caseId);
    if (!productionCase) conflict();
    const events = await reader.listEvents(context, caseId);
    const results = events.filter(event => event.kind === "result" && event.artifactId);
    const result = selectedPlanId ? results.filter(event => event.artifactId === selectedPlanId) : results.slice(-1);
    if (!result.length && !selectedPlanId) {
      if (productionCase.currentPlanId || productionCase.currentPurchaseListId) conflict();
      return undefined;
    }
    if (result.length !== 1 || !result[0]!.artifactId) conflict();
    const planId = result[0]!.artifactId;
    if (results.filter(event => event.artifactId === planId).length !== 1) conflict();
    const [manifests, specs] = await Promise.all([reader.listApplyManifests(context), reader.listApprovedProductionSpecs(context)]);
    const matchingManifests = manifests.filter(manifest => manifest.planId === planId);
    if (matchingManifests.length !== 1) conflict();
    const manifest = matchingManifests[0]!;
    const matchingSpecs = specs.filter(spec => spec.approvedProductionSpecId === manifest.approvedProductionSpecId);
    if (matchingSpecs.length !== 1 || manifests.filter(item => item.purchaseListId === manifest.purchaseListId).length !== 1) conflict();
    const approvedSpec = matchingSpecs[0]!;
    const { eventSpec, productionPlan, purchaseList, recipes } = approvedSpec.artifacts;
    if (!selectedPlanId && (productionCase.currentPlanId !== undefined || productionCase.currentPurchaseListId !== undefined) &&
        (productionCase.currentPlanId !== productionPlan.planId || productionCase.currentPurchaseListId !== purchaseList.purchaseListId ||
         productionCase.approvedProductionSpecId !== approvedSpec.approvedProductionSpecId)) conflict();
    let expected;
    try { expected = createProductionApplyManifest({ approvedProductionSpec: approvedSpec, actor: { businessId: context.businessId, ...manifest.appliedBy }, appliedAt: new Date(manifest.appliedAt) }); } catch { conflict(); }
    if (productionCase.businessId !== context.businessId || manifest.businessId !== context.businessId || approvedSpec.businessId !== context.businessId ||
        productionCase.status === "archived" || !productionCase.productionHandoffId || productionCase.sourceSpecId !== eventSpec.specId ||
        result[0]!.at !== manifest.appliedAt || !areJsonValuesEqual(manifest, expected) ||
        specs.filter(item => item.artifacts.productionPlan.planId === planId && manifests.some(m => m.approvedProductionSpecId === item.approvedProductionSpecId)).length !== 1 ||
        !events.some(event => event.kind === "approval" && event.artifactId === approvedSpec.approvedProductionSpecId)) conflict();
    let linkedCase: string | undefined;
    try { linkedCase = await reader.findCaseIdForArtifact(context, approvedSpec.sourceDraft.draftId); } catch { conflict(); }
    const aggregate = await productionDecisionRepositoryFor(reader).getDecisionAggregate(context, approvedSpec.approvalRequestId);
    if (linkedCase !== caseId || !aggregate?.approvedProductionSpec || !areJsonValuesEqual(aggregate.approvedProductionSpec, approvedSpec) ||
        aggregate.sourceDraft.businessId !== context.businessId || aggregate.sourceDraft.draftId !== approvedSpec.sourceDraft.draftId ||
        aggregate.sourceDraft.revision !== approvedSpec.sourceDraft.revision ||
        !areJsonValuesEqual(aggregate.sourceDraft.draftArtifacts.eventSpec, eventSpec)) conflict();
    const recipeIds = new Set(recipes.map(recipe => recipe.recipeId));
    if ([...productionPlan.productionBatches, ...productionPlan.kitchenSheets, ...productionPlan.recipeSelections].some(item => item.recipeId && !recipeIds.has(item.recipeId))) conflict();
    return { productionCase, approvedSpec, manifest, dietaryQuestionReviews: projectDietaryQuestionReviews(context.businessId, caseId, aggregate.sourceDraft, events) };
  };
  const initial = await discover(store);
  if (!initial) return undefined;
  const { approvedSpec } = initial;
  const targets: CriticalSectionTarget[] = [
    { kind: "production_plan", artifactId: approvedSpec.artifacts.productionPlan.planId, revision: 0 },
    { kind: "production_purchase_list", artifactId: approvedSpec.artifacts.purchaseList.purchaseListId, revision: 0 },
    { kind: "production_approved_spec", artifactId: approvedSpec.approvedProductionSpecId, revision: 0 },
    ...approvedSpec.artifacts.recipes.map(recipe => ({ kind: "production_recipe" as const, artifactId: recipe.recipeId, revision: 0 }))
  ];
  return store.withCaseApplyCriticalSection(context, caseId, async (_case, _scope, transaction) => {
    const current = await discover(transaction ? new ProductionStore({ pgPool: transaction }) : store);
    if (!current || !areJsonValuesEqual(current, initial)) conflict();
    return current;
  }, approvedSpec.sourceDraft, targets);
}
