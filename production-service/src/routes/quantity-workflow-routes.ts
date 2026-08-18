import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  confirmQuantityOverride,
  recalculateQuantityLineage,
  type AuditLogStore,
  type ConfirmedQuantityOverride,
  type QuantityOverrideEdit,
  type TrustedActor
} from "@catering/shared-core";
import {
  buildQuantityWorkflowProjection,
  previewProductionQuantityOverride,
  type ProductionQuantityOverridePreview
} from "../quantity-workflow/service.js";
import type { QuantityWorkflowRuntimeComponent } from "../quantity-workflow/runtime.js";

export interface ProductionQuantityWorkflowRouteDependencies {
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
  resolveRuntime: (actor: TrustedActor, caseId: string) => Promise<QuantityWorkflowRuntimeComponent[]>;
  persistConfirmedOverride?: (actor: TrustedActor, override: ConfirmedQuantityOverride) => Promise<void>;
}

type SupportedEdit = Extract<QuantityOverrideEdit, { origin: "target_output" | "purchase_ingredient" }>;
interface PreviewBody { edit?: SupportedEdit; }
interface ConfirmBody extends PreviewBody { previewId?: string; }

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function previewIdFor(runtime: QuantityWorkflowRuntimeComponent, edit: SupportedEdit, preview: ProductionQuantityOverridePreview): string {
  const digest = createHash("sha256").update(stableJson({
    caseId: runtime.caseId,
    componentId: runtime.componentId,
    revision: runtime.revision,
    currentAuthority: runtime.previewInput.currentAuthority,
    edit,
    previewStatus: preview.status,
    resultingTarget: preview.status === "preview_ready" ? preview.resultingTarget : undefined,
    scaleFactor: preview.status === "preview_ready" ? preview.scaleFactor : undefined
  })).digest("hex");
  return `quantity-preview-${digest}`;
}

function findRuntime(runtimes: QuantityWorkflowRuntimeComponent[], componentId: string): QuantityWorkflowRuntimeComponent | undefined {
  const matches = runtimes.filter((runtime) => runtime.componentId === componentId);
  return matches.length === 1 ? matches[0] : undefined;
}

function validEdit(value: unknown): value is SupportedEdit {
  if (!value || typeof value !== "object") return false;
  const edit = value as Record<string, unknown>;
  if (edit.origin === "target_output") {
    return typeof edit.perUnitAmount === "number" && Number.isFinite(edit.perUnitAmount) && typeof edit.unit === "string" && edit.unit.trim().length > 0;
  }
  if (edit.origin === "purchase_ingredient") {
    return typeof edit.ingredientId === "string" && edit.ingredientId.trim().length > 0 && typeof edit.amount === "number" && Number.isFinite(edit.amount) && typeof edit.unit === "string" && edit.unit.trim().length > 0;
  }
  return false;
}

export function registerProductionQuantityWorkflowRoutes(app: FastifyInstance, deps: ProductionQuantityWorkflowRouteDependencies): void {
  const { auditLog, trustedActorSecret, allowDevActorHeader, requireProductionOperator, actorForRequest, resolveRuntime, persistConfirmedOverride } = deps;

  app.get<{ Params: { caseId: string } }>("/v1/production/cases/:caseId/quantity-workflow", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) return forbidden;
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const runtimes = await resolveRuntime(actor, request.params.caseId);
    return reply.send({ items: runtimes.map((runtime) => ({ ...buildQuantityWorkflowProjection(runtime.projectionInput), sourceRevision: runtime.revision })) });
  });

  app.post<{ Params: { caseId: string; componentId: string }; Body: PreviewBody }>(
    "/v1/production/cases/:caseId/quantity-workflow/:componentId/preview",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) return forbidden;
      if (!validEdit(request.body?.edit)) return reply.code(400).send({ error: "quantity_edit_invalid" });
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const runtime = findRuntime(await resolveRuntime(actor, request.params.caseId), request.params.componentId);
      if (!runtime) return reply.code(404).send({ error: "quantity_component_not_found" });
      const preview = previewProductionQuantityOverride({ ...runtime.previewInput, edit: request.body.edit });
      return reply.send({ previewId: previewIdFor(runtime, request.body.edit, preview), sourceRevision: runtime.revision, preview });
    }
  );

  app.post<{ Params: { caseId: string; componentId: string }; Body: ConfirmBody }>(
    "/v1/production/cases/:caseId/quantity-workflow/:componentId/confirm",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) return forbidden;
      if (!validEdit(request.body?.edit) || typeof request.body?.previewId !== "string") return reply.code(400).send({ error: "quantity_confirmation_invalid" });
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const runtime = findRuntime(await resolveRuntime(actor, request.params.caseId), request.params.componentId);
      if (!runtime) return reply.code(404).send({ error: "quantity_component_not_found" });
      const preview = previewProductionQuantityOverride({ ...runtime.previewInput, edit: request.body.edit });
      const expectedPreviewId = previewIdFor(runtime, request.body.edit, preview);
      if (preview.status !== "preview_ready" || request.body.previewId !== expectedPreviewId) return reply.code(409).send({ error: "quantity_preview_stale" });

      const confirmedAt = new Date().toISOString();
      const overrideId = `quantity-override-${createHash("sha256").update(`${expectedPreviewId}\0${actor.businessId}\0${actor.name}`).digest("hex")}`;
      const confirmation = confirmQuantityOverride({ preview: preview.corePreview, overrideId, confirmedAt, operatorId: actor.name });
      if (confirmation.status !== "confirmed") return reply.code(409).send({ error: "quantity_confirmation_blocked", issues: confirmation.issues });

      const recalculation = recalculateQuantityLineage({
        confirmedOverride: confirmation.override,
        recipe: runtime.previewInput.recipe,
        outputMapping: runtime.previewInput.outputMapping,
        reviewedQuantityDecision: runtime.reviewedQuantityDecision,
        recipeEventUseReview: runtime.recipeEventUseReview,
        productionScalingRules: runtime.previewInput.productionScalingRules,
        productionContext: runtime.previewInput.productionContext
      });

      if (persistConfirmedOverride) await persistConfirmedOverride(actor, confirmation.override);
      await auditLog.logFor(actor, {
        action: "quantity_override_confirmed",
        entityType: "ProductionQuantityOverride",
        entityId: confirmation.override.overrideId,
        actor,
        summary: `Mengenänderung für ${runtime.projectionInput.label} bestätigt.`,
        details: {
          caseId: runtime.caseId,
          componentId: runtime.componentId,
          editOrigin: confirmation.override.editOrigin,
          previewId: expectedPreviewId,
          sourceRevision: runtime.revision,
          previousTargetAmount: confirmation.override.previousAuthority.targetAmount,
          newTargetAmount: confirmation.override.newAuthority.targetAmount,
          targetUnit: confirmation.override.newAuthority.targetUnit,
          bridgeStatus: recalculation.bridge.status,
          appliedProductionScalingRuleIds: (recalculation.appliedProductionScalingRuleIds ?? []).join(",")
        },
        idempotencyKey: confirmation.override.overrideId
      });

      const status = recalculation.bridge.status === "ready_for_scaling" && recalculation.quantityDecision.decision.reviewStatus === "approved" ? "regenerated" : "review_required";
      return reply.send({
        status,
        override: confirmation.override,
        quantityDecision: recalculation.quantityDecision,
        bridge: recalculation.bridge,
        proportionalBaseline: recalculation.proportionalBaseline,
        effectiveRecipeQuantity: recalculation.effectiveRecipeQuantity,
        purchaseQuantities: recalculation.purchaseQuantities,
        appliedProductionScalingRuleIds: recalculation.appliedProductionScalingRuleIds ?? [],
        staleArtifacts: recalculation.staleArtifacts
      });
    }
  );
}
