import { ProductionStore, productionDecisionRepositoryFor } from "@catering/production-service";
import { areJsonValuesEqual, createProductionApplyManifest, type ApprovedProductionSpec, type BusinessContext, type CriticalSectionTarget, type ProductionApplyManifest, type ProductionCase } from "@catering/shared-core";

export interface AppliedProductionSnapshot {
  productionCase: ProductionCase;
  approvedSpec: ApprovedProductionSpec;
  manifest: ProductionApplyManifest;
}

function conflict(): never {
  throw Object.assign(new Error("Angewendete Produktionsartefakte sind nicht vollständig und eindeutig verknüpft."), { statusCode: 409 });
}

type ExportTarget = ({ planId: string } | { purchaseListId: string }) & { eventSpecId: string };

export async function resolveAppliedProductionSnapshot(
  store: ProductionStore,
  context: BusinessContext,
  target: ExportTarget
): Promise<AppliedProductionSnapshot | undefined> {
  const candidate = await readAppliedProductionSnapshot(store, context, target);
  if (!candidate) return undefined;
  const { productionCase, approvedSpec } = candidate;
  const { productionPlan, purchaseList, recipes } = approvedSpec.artifacts;
  const publicationTargets: CriticalSectionTarget[] = [
    { kind: "production_plan", artifactId: productionPlan.planId, revision: 0 },
    { kind: "production_purchase_list", artifactId: purchaseList.purchaseListId, revision: 0 },
    { kind: "production_approved_spec", artifactId: approvedSpec.approvedProductionSpecId, revision: 0 },
    ...recipes.map(recipe => ({ kind: "production_recipe", artifactId: recipe.recipeId, revision: 0 }))
  ];
  // File Apply can still compensate after publishing its case, manifest and
  // result event. Its publication locks, not the presence of these rows, mark
  // the boundary after which a frozen snapshot can leave the service.
  const snapshot = await store.withCaseApplyCriticalSection(
    context,
    productionCase.caseId,
    async (_current, _scope, transactionalQueryable) => {
      const reader = transactionalQueryable ? new ProductionStore({ pgPool: transactionalQueryable }) : store;
      const current = await readAppliedProductionSnapshot(reader, context, target);
      if (!current || current.productionCase.caseId !== productionCase.caseId ||
        current.approvedSpec.approvedProductionSpecId !== approvedSpec.approvedProductionSpecId) conflict();
      return current;
    },
    approvedSpec.sourceDraft,
    publicationTargets
  );
  if (!snapshot) conflict();
  return snapshot;
}

async function readAppliedProductionSnapshot(
  store: ProductionStore,
  context: BusinessContext,
  target: ExportTarget
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
  let expectedManifest: ProductionApplyManifest;
  try {
    expectedManifest = createProductionApplyManifest({ approvedProductionSpec: approvedSpec,
      actor: { businessId: context.businessId, ...manifest.appliedBy }, appliedAt: new Date(manifest.appliedAt) });
  } catch {
    conflict();
  }
  if (manifest.businessId !== context.businessId || approvedSpec.businessId !== context.businessId || productionCase.businessId !== context.businessId ||
    productionCase.status === "archived" || !productionCase.productionHandoffId ||
    productionCase.approvedProductionSpecId !== approvedSpec.approvedProductionSpecId ||
    productionCase.sourceSpecId !== eventSpec.specId || productionCase.currentPlanId !== productionPlan.planId ||
    productionCase.currentPurchaseListId !== purchaseList.purchaseListId ||
    !areJsonValuesEqual(manifest, expectedManifest)) conflict();
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
  // The unlocked discovery read may race a case continuation. The locked
  // validation also uses the transaction-local reader for PostgreSQL.
  const currentCase = await store.getCase(context, productionCase.caseId);
  if (!currentCase || !areJsonValuesEqual(currentCase, productionCase)) conflict();
  return { productionCase, approvedSpec, manifest };
}
