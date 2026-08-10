import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  createApprovedProductionSpec,
  createApprovalRequestRecord,
  createProductionApplyManifest,
  validateProductionDraft,
  type ApprovalRequestRecord,
  type AuditLogStore,
  type BusinessContext,
  type ProductionApplyManifest,
  type TrustedActor
} from "@catering/shared-core";
import type { IntakeStore } from "@catering/intake-service";
import type { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";
import type { ProductionStore } from "../repositories/production-store.js";

export type ProductionDecisionFaultPhase = "after_approval_insert";
export type ProductionApplyFaultPhase =
  | "after_event_spec_write"
  | "after_plan_write"
  | "after_purchase_list_write"
  | "after_recipe_write"
  | "before_manifest_publish";

export interface ProductionApprovalRouteDependencies {
  store: ProductionStore;
  intakeStore: IntakeStore;
  repository: InMemoryRecipeRepository;
  auditLog: AuditLogStore;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  requireProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => unknown | undefined;
  actorForRequest: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => TrustedActor;
  decisionFaultInjector?: (phase: ProductionDecisionFaultPhase) => void;
  applyFaultInjector?: (phase: ProductionApplyFaultPhase) => void;
}

function sameApproval(left: ApprovalRequestRecord, right: ApprovalRequestRecord): boolean {
  return left.approvalRequestId === right.approvalRequestId &&
    left.decision === right.decision &&
    left.selectedVariantId === right.selectedVariantId &&
    left.comment === right.comment &&
    left.decidedBy.name === right.decidedBy.name &&
    left.decidedBy.role === right.decidedBy.role &&
    left.decidedBy.source === right.decidedBy.source;
}

function sameAppliedArtifacts(left: ProductionApplyManifest, right: ProductionApplyManifest): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.businessId === right.businessId &&
    left.approvedProductionSpecId === right.approvedProductionSpecId &&
    left.eventSpecId === right.eventSpecId &&
    left.planId === right.planId &&
    left.purchaseListId === right.purchaseListId &&
    areJsonValuesEqual(left.recipeIds, right.recipeIds);
}

async function compareOrInsert<T>(input: {
  get: () => Promise<T | undefined>;
  insert: () => Promise<"created" | "exists">;
  expected: T;
  label: string;
}): Promise<string | undefined> {
  const existing = await input.get();
  if (existing) {
    return areJsonValuesEqual(existing, input.expected)
      ? undefined
      : `${input.label} existiert bereits mit abweichendem Inhalt.`;
  }
  await input.insert();
  const observed = await input.get();
  return areJsonValuesEqual(observed, input.expected)
    ? undefined
    : `${input.label} konnte nicht konfliktfrei veröffentlicht werden.`;
}

export function registerProductionApprovalRoutes(
  app: FastifyInstance,
  deps: ProductionApprovalRouteDependencies
): void {
  const {
    store,
    intakeStore,
    repository,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    requireProductionOperator,
    actorForRequest,
    decisionFaultInjector,
    applyFaultInjector
  } = deps;

  app.post<{
    Params: { draftId: string };
    Body: { decision?: "approved" | "rejected"; comment?: string };
  }>("/v1/production/drafts/:draftId/decision", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) return forbidden;
    if (request.body?.decision !== "approved" && request.body?.decision !== "rejected") {
      return reply.code(400).send({ message: "decision muss approved oder rejected sein." });
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const draft = await store.getProductionDraft(actor, request.params.draftId);
    if (!draft) return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
    const target = {
      kind: "production_draft" as const,
      artifactId: draft.draftId,
      revision: draft.revision
    };
    const requestedApproval = createApprovalRequestRecord({
      actor,
      role: "production_operator",
      target,
      decision: request.body.decision,
      ...(request.body.comment?.trim() ? { comment: request.body.comment.trim() } : {})
    });
    const existingApprovals = await store.listApprovalsForTarget(actor, target);
    if (existingApprovals.length > 1) {
      return reply.code(409).send({ message: "Freigabeziel besitzt konkurrierende Entscheidungen." });
    }
    const existingApproval = existingApprovals[0];
    if (existingApproval && !sameApproval(existingApproval, requestedApproval)) {
      return reply.code(409).send({ message: "ProductionDraft-Revision wurde bereits anders entschieden." });
    }
    if (!existingApproval && draft.status !== "pending_review") {
      return reply.code(409).send({ message: "Nur ein pending_review ProductionDraft darf entschieden werden." });
    }

    if (request.body.decision === "approved") {
      const unresolvedCards = draft.reviewCards.filter((card) =>
        (card.requiredApproval === true || card.riskLevel === "blocking") && card.decision !== "fits"
      );
      const { eventSpec, productionPlan, purchaseList, recipes } = draft.draftArtifacts;
      const selectedRecipeIds = productionPlan?.recipeSelections
        .map((selection) => selection.recipeId)
        .filter((recipeId): recipeId is string => Boolean(recipeId)) ?? [];
      const incomplete = !eventSpec || !productionPlan || !purchaseList || !Array.isArray(recipes) ||
        selectedRecipeIds.some((recipeId) => !recipes?.some((recipe) => recipe.recipeId === recipeId));
      if (unresolvedCards.length > 0 || incomplete) {
        return reply.code(422).send({
          message: "ProductionDraft-Snapshot ist noch nicht vollständig freigabefähig.",
          errors: [
            ...unresolvedCards.map((card) => `reviewCard ${card.cardId} is ${card.decision}`),
            ...(incomplete ? ["eventSpec, productionPlan, purchaseList und recipes müssen vollständig vorliegen"] : [])
          ]
        });
      }
    }

    let approval = existingApproval ?? requestedApproval;
    if (!existingApproval) {
      await store.insertApproval(actor, approval);
      decisionFaultInjector?.("after_approval_insert");
      const persistedApproval = await store.getApproval(actor, requestedApproval.approvalRequestId);
      if (!persistedApproval) {
        return reply.code(409).send({ message: "Freigabe konnte nicht konfliktfrei gespeichert werden." });
      }
      if (!sameApproval(persistedApproval, requestedApproval)) {
        return reply.code(409).send({ message: "ProductionDraft-Revision wurde gleichzeitig anders entschieden." });
      }
      approval = persistedApproval;
    }

    if (approval.decision === "rejected") {
      const decidedDraft = validateProductionDraft({
        ...draft,
        status: "rejected",
        approvalRequestId: approval.approvalRequestId
      });
      await store.saveProductionDraft(actor, decidedDraft);
      await auditLog.logFor(actor, {
        action: "production.production_draft_rejected",
        entityType: "ProductionDraft",
        entityId: draft.draftId,
        actor,
        summary: "ProductionDraft nach Review verworfen.",
        details: {
          draftId: draft.draftId,
          revision: draft.revision,
          approvalRequestId: approval.approvalRequestId,
          writesProductObject: false
        }
      });
      return reply.code(201).send({ approval });
    }

    const expectedSpec = createApprovedProductionSpec({ draft, approval });
    const snapshotConflict = await compareOrInsert({
      get: () => store.getApprovedProductionSpec(actor, expectedSpec.approvedProductionSpecId),
      insert: () => store.insertApprovedProductionSpec(actor, expectedSpec),
      expected: expectedSpec,
      label: `ApprovedProductionSpec ${expectedSpec.approvedProductionSpecId}`
    });
    if (snapshotConflict) return reply.code(409).send({ message: snapshotConflict });
    const approvedProductionSpec = await store.getApprovedProductionSpec(
      actor,
      expectedSpec.approvedProductionSpecId
    );

    const decidedDraft = validateProductionDraft({
      ...draft,
      status: "approved",
      approvalRequestId: approval.approvalRequestId,
      approvedBy: approval.decidedBy.name,
      approvedAt: approval.decidedAt
    });
    await store.saveProductionDraft(actor, decidedDraft);
    await auditLog.logFor(actor, {
      action: "production.production_spec_approved",
      entityType: "ApprovedProductionSpec",
      entityId: expectedSpec.approvedProductionSpecId,
      actor,
      summary: "Geprüfter Produktions-Snapshot unveränderlich freigegeben.",
      details: {
        draftId: draft.draftId,
        revision: draft.revision,
        approvalRequestId: approval.approvalRequestId,
        writesProductObject: false
      }
    });
    return reply.code(201).send({
      approval,
      approvedProductionSpec
    });
  });

  app.post<{ Params: { approvedProductionSpecId: string }; Body: Record<string, never> }>(
    "/v1/production/approved-specs/:approvedProductionSpecId/apply",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) return forbidden;
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const approvedSpec = await store.getApprovedProductionSpec(actor, request.params.approvedProductionSpecId);
      if (!approvedSpec) return reply.code(404).send({ message: "ApprovedProductionSpec nicht gefunden." });

      const { eventSpec, productionPlan, purchaseList, recipes } = approvedSpec.artifacts;
      const conflicts: string[] = [];
      const eventSpecConflict = await compareOrInsert({
        get: () => intakeStore.getSpec(eventSpec.specId),
        insert: () => intakeStore.insertSpec(eventSpec),
        expected: eventSpec,
        label: `AcceptedEventSpec ${eventSpec.specId}`
      });
      if (eventSpecConflict) conflicts.push(eventSpecConflict);
      applyFaultInjector?.("after_event_spec_write");

      if (conflicts.length === 0) {
        const conflict = await compareOrInsert({
          get: () => store.getPlan(actor, productionPlan.planId),
          insert: () => store.insertPlan(actor, productionPlan),
          expected: productionPlan,
          label: `ProductionPlan ${productionPlan.planId}`
        });
        if (conflict) conflicts.push(conflict);
      }
      applyFaultInjector?.("after_plan_write");

      if (conflicts.length === 0) {
        const conflict = await compareOrInsert({
          get: () => store.getPurchaseList(actor, purchaseList.purchaseListId),
          insert: () => store.insertPurchaseList(actor, purchaseList),
          expected: purchaseList,
          label: `PurchaseList ${purchaseList.purchaseListId}`
        });
        if (conflict) conflicts.push(conflict);
      }
      applyFaultInjector?.("after_purchase_list_write");

      for (const recipe of conflicts.length === 0 ? recipes : []) {
        const conflict = await compareOrInsert({
          get: () => repository.get(actor, recipe.recipeId),
          insert: () => repository.insert(actor, recipe),
          expected: recipe,
          label: `Recipe ${recipe.recipeId}`
        });
        if (conflict) {
          conflicts.push(conflict);
          break;
        }
        applyFaultInjector?.("after_recipe_write");
      }

      if (conflicts.length > 0) {
        return reply.code(409).send({
          message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
          errors: conflicts
        });
      }

      const expectedManifest = createProductionApplyManifest({
        approvedProductionSpec: approvedSpec,
        actor
      });
      const existingManifest = await store.getApplyManifest(actor, approvedSpec.approvedProductionSpecId);
      if (existingManifest && !sameAppliedArtifacts(existingManifest, expectedManifest)) {
        return reply.code(409).send({ message: "ProductionApplyManifest existiert mit abweichendem Inhalt." });
      }
      if (!existingManifest) {
        applyFaultInjector?.("before_manifest_publish");
        await store.insertApplyManifest(actor, expectedManifest);
        const persistedManifest = await store.getApplyManifest(actor, approvedSpec.approvedProductionSpecId);
        if (!persistedManifest || !sameAppliedArtifacts(persistedManifest, expectedManifest)) {
          return reply.code(409).send({ message: "ProductionApplyManifest konnte nicht konfliktfrei veröffentlicht werden." });
        }
      }

      await auditLog.logFor(actor, {
        action: "production.approved_spec_applied",
        entityType: "ApprovedProductionSpec",
        entityId: approvedSpec.approvedProductionSpecId,
        actor,
        idempotencyKey: `production-apply:${approvedSpec.approvedProductionSpecId}`,
        summary: "Freigegebener Produktions-Snapshot in Produktobjekte übernommen.",
        details: {
          specId: eventSpec.specId,
          planId: productionPlan.planId,
          purchaseListId: purchaseList.purchaseListId,
          recipeCandidateCount: recipes.length,
          writesProductObject: true
        }
      });
      return reply.send({ eventSpec, plan: productionPlan, purchaseList, recipes });
    }
  );
}
