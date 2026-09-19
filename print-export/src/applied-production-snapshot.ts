import { ProductionStore, productionDecisionRepositoryFor } from "@catering/production-service";
import { areJsonValuesEqual, createProductionApplyManifest, type ApprovedProductionSpec, type BusinessContext, type ProductionApplyManifest, type ProductionCase } from "@catering/shared-core";

export interface AppliedProductionSnapshot {
  productionCase: ProductionCase;
  approvedSpec: ApprovedProductionSpec;
  manifest: ProductionApplyManifest;
}

function conflict(): never {
  throw Object.assign(new Error("Angewendete Produktionsartefakte sind nicht vollständig und eindeutig verknüpft."), { statusCode: 409 });
}

export async function resolveAppliedProductionSnapshot(
  store: ProductionStore,
  context: BusinessContext,
  target: ({ planId: string } | { purchaseListId: string }) & { eventSpecId: string }
): Promise<AppliedProductionSnapshot | undefined> {
  const [manifests, approvedSpecs, cases] = await Promise.all([
    store.listApplyManifests(context), store.listApprovedProductionSpecs(context), store.listCases(context)
  ]);
  const matches = (planId: string | undefined, purchaseListId: string | undefined) =>
    "planId" in target ? target.planId === planId : target.purchaseListId === purchaseListId;
  const linkedManifests = manifests.filter(item => matches(item.planId, item.purchaseListId));
  const linkedSpecs = approvedSpecs.filter(item => matches(item.artifacts.productionPlan.planId, item.artifacts.purchaseList.purchaseListId));
  const linkedCases = cases.filter(item => matches(item.currentPlanId, item.currentPurchaseListId));
  // Standalone legacy artifacts have no Apply anchors. Once any approval or
  // Apply anchor exists, an incomplete chain must never downgrade to live data.
  if (!linkedManifests.length && !linkedSpecs.length && !linkedCases.length) {
    if (approvedSpecs.some(item => item.artifacts.eventSpec.specId === target.eventSpecId) ||
      manifests.some(item => item.eventSpecId === target.eventSpecId)) conflict();
    return undefined;
  }
  if (linkedManifests.length !== 1 || linkedSpecs.length !== 1 || linkedCases.length !== 1) conflict();
  const manifest = linkedManifests[0]!;
  const approvedSpec = linkedSpecs[0]!;
  const productionCase = linkedCases[0]!;
  const { eventSpec, productionPlan, purchaseList, recipes } = approvedSpec.artifacts;
  if (manifest.businessId !== context.businessId || approvedSpec.businessId !== context.businessId || productionCase.businessId !== context.businessId ||
    productionCase.status === "archived" || !productionCase.productionHandoffId ||
    productionCase.approvedProductionSpecId !== approvedSpec.approvedProductionSpecId ||
    productionCase.sourceSpecId !== eventSpec.specId || productionCase.currentPlanId !== productionPlan.planId ||
    productionCase.currentPurchaseListId !== purchaseList.purchaseListId ||
    !areJsonValuesEqual(manifest, createProductionApplyManifest({ approvedProductionSpec: approvedSpec,
      actor: { businessId: context.businessId, ...manifest.appliedBy }, appliedAt: new Date(manifest.appliedAt) }))) conflict();
  let draftCaseId: string | undefined;
  try { draftCaseId = await store.findCaseIdForArtifact(context, approvedSpec.sourceDraft.draftId); }
  catch { conflict(); }
  if (draftCaseId !== productionCase.caseId) conflict();
  const [plan, list, aggregate, events] = await Promise.all([
    store.getPlan(context, productionPlan.planId), store.getPurchaseList(context, purchaseList.purchaseListId),
    productionDecisionRepositoryFor(store).getDecisionAggregate(context, approvedSpec.approvalRequestId),
    store.listEvents(context, productionCase.caseId)
  ]);
  const recipeIds = new Set(recipes.map(recipe => recipe.recipeId));
  if (!plan || !list || !aggregate?.approvedProductionSpec ||
    !areJsonValuesEqual(plan, productionPlan) || !areJsonValuesEqual(list, purchaseList) ||
    !areJsonValuesEqual(aggregate.approvedProductionSpec, approvedSpec) ||
    !events.some(event => event.kind === "approval" && event.artifactId === approvedSpec.approvedProductionSpecId) ||
    !events.some(event => event.kind === "result" && event.artifactId === productionPlan.planId && event.at === manifest.appliedAt) ||
    [...productionPlan.productionBatches, ...productionPlan.kitchenSheets, ...productionPlan.recipeSelections]
      .some(item => item.recipeId && !recipeIds.has(item.recipeId))) conflict();
  // A concurrent case continuation invalidates this read rather than mixing
  // its new selection with the previously read immutable artifacts.
  const currentCase = await store.getCase(context, productionCase.caseId);
  if (!currentCase || !areJsonValuesEqual(currentCase, productionCase)) conflict();
  return { productionCase, approvedSpec, manifest };
}
