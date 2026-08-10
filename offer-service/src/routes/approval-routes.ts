import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  createApprovalRequestRecord,
  validateApprovedOffer,
  validateProductionHandoff,
  type ApprovalRequestRecord,
  type ApprovedOffer,
  type AuditLogStore,
  type TrustedActor
} from "@catering/shared-core";
import type { OfferStore } from "../store.js";

export interface OfferApprovalRouteDependencies {
  store: OfferStore;
  auditLog: AuditLogStore;
  requireOfferOperator: (request: { headers: Record<string, string | string[] | undefined> }, reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) => unknown | undefined;
  requireHandoffReader: (request: { headers: Record<string, string | string[] | undefined> }, reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) => unknown | undefined;
  actorForRequest: (request: { headers: Record<string, string | string[] | undefined> }) => TrustedActor;
}

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}-${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function sameDecision(
  left: { decision: string; selectedVariantId?: string; comment?: string; decidedBy: { name: string; role: string; source: string } },
  right: { decision: string; selectedVariantId?: string; comment?: string; decidedBy: { name: string; role: string; source: string } }
): boolean {
  return left.decision === right.decision
    && left.selectedVariantId === right.selectedVariantId
    && left.comment === right.comment
    && left.decidedBy.name === right.decidedBy.name
    && left.decidedBy.role === right.decidedBy.role
    && left.decidedBy.source === right.decidedBy.source;
}

function matchesStoredApproval(offer: ApprovedOffer, approval: ApprovalRequestRecord): boolean {
  const selectedVariantId = approval.selectedVariantId;
  const selectedPricing = offer.selectedVariant.proposedEventSpec.budgetContext?.pricingSummary;
  return approval.decision === "approved"
    && selectedVariantId !== undefined
    && offer.businessId === approval.businessId
    && offer.approvalRequestId === approval.approvalRequestId
    && offer.sourceDraft.draftId === approval.target.artifactId
    && offer.sourceDraft.revision === approval.target.revision
    && offer.selectedVariantId === selectedVariantId
    && offer.selectedVariant.variantId === selectedVariantId
    && offer.approvedAt === approval.decidedAt
    && selectedPricing !== undefined
    && areJsonValuesEqual(offer.pricingSummary, selectedPricing);
}

export function registerOfferApprovalRoutes(app: FastifyInstance, deps: OfferApprovalRouteDependencies) {
  const { store, auditLog, requireOfferOperator, requireHandoffReader, actorForRequest } = deps;
  const logApprovedOfferAudit = (actor: TrustedActor, approval: ApprovalRequestRecord, approvedOffer: ApprovedOffer) => auditLog.logFor(actor, {
    action: "offer.approved",
    entityType: "ApprovedOffer",
    entityId: approvedOffer.approvedOfferId,
    actor: approval.decidedBy,
    at: approvedOffer.approvedAt,
    idempotencyKey: `approved-offer:${approvedOffer.approvedOfferId}`,
    summary: "Angebotsvariante explizit freigegeben.",
    details: { draftId: approvedOffer.sourceDraft.draftId, variantId: approvedOffer.selectedVariantId }
  });

  app.post<{ Params: { draftId: string }; Body: { decision?: "approved" | "rejected"; revision?: number; variantId?: string; comment?: string } }>(
    "/v1/offers/drafts/:draftId/decision",
    async (request, reply) => {
      const forbidden = requireOfferOperator(request, reply);
      if (forbidden) return forbidden;
      const actor = actorForRequest(request);
      const draft = await store.getDraft(actor, request.params.draftId);
      if (!draft) return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
      const decision = request.body?.decision;
      if (decision !== "approved" && decision !== "rejected") return reply.code(422).send({ message: "Explizite Freigabeentscheidung erforderlich." });
      const requestedRevision = request.body?.revision;
      if (!Number.isInteger(requestedRevision) || requestedRevision! < 1 || requestedRevision! > 2_147_483_647) {
        return reply.code(422).send({ message: "Eine gültige Angebotsrevision ist für die Entscheidung erforderlich." });
      }
      const target = { kind: "offer_draft" as const, artifactId: draft.draftId, revision: requestedRevision! };
      const existing = await store.listApprovalsForTarget(actor, target);
      if (existing.length > 1) {
        return reply.code(409).send({ message: "Für diesen Entwurf liegen widersprüchliche Entscheidungen vor." });
      }
      let stored: ApprovalRequestRecord | undefined = existing[0];
      if (draft.revision !== requestedRevision) {
        if (!stored) {
          return reply.code(409).send({ message: "Die angeforderte Angebotsrevision ist nicht mehr der aktuelle Entwurf." });
        }
        let retryApproval: ApprovalRequestRecord;
        try {
          retryApproval = createApprovalRequestRecord({
            actor,
            role: "offer_operator",
            target,
            decision,
            ...(decision === "approved" && request.body.variantId !== undefined
              ? { selectedVariantId: request.body.variantId }
              : {}),
            ...(request.body?.comment?.trim() ? { comment: request.body.comment.trim() } : {})
          });
        } catch (error) {
          return reply.code(403).send({ message: error instanceof Error ? error.message : "Freigabe nicht zulässig." });
        }
        if (!sameDecision(stored, retryApproval)) {
          return reply.code(409).send({ message: "Für diesen Entwurf liegt bereits eine andere Entscheidung vor." });
        }
        if (stored.decision === "rejected") {
          return reply.code(201).send({ approval: stored });
        }
        const approvedOfferId = deterministicId("approved-offer", {
          businessId: actor.businessId,
          approvalRequestId: stored.approvalRequestId
        });
        const approvedOffer = await store.getApprovedOffer(actor, approvedOfferId);
        if (!approvedOffer || !matchesStoredApproval(approvedOffer, stored)) {
          return reply.code(409).send({ message: "Die ältere Angebotsentscheidung kann nicht aus ihrem unveränderlichen Freigabestand wiederhergestellt werden." });
        }
        await logApprovedOfferAudit(actor, stored, approvedOffer);
        return reply.code(201).send({ approval: stored, approvedOffer });
      }
      const selectedVariant = decision === "approved" ? draft.variantSet.find((variant) => variant.variantId === request.body.variantId) : undefined;
      if (decision === "approved" && !selectedVariant) return reply.code(422).send({ message: "Eine vorhandene Angebotsvariante muss explizit gewählt werden." });

      let approval;
      try {
        approval = createApprovalRequestRecord({
          actor,
          role: "offer_operator",
          target,
          decision,
          ...(selectedVariant ? { selectedVariantId: selectedVariant.variantId } : {}),
          ...(request.body?.comment?.trim() ? { comment: request.body.comment.trim() } : {})
        });
      } catch (error) {
        return reply.code(403).send({ message: error instanceof Error ? error.message : "Freigabe nicht zulässig." });
      }
      if (stored && !sameDecision(stored, approval)) {
        return reply.code(409).send({ message: "Für diesen Entwurf liegt bereits eine andere Entscheidung vor." });
      }
      const buildApprovedOffer = (finalApproval: ApprovalRequestRecord) => {
        const pricingSummary = selectedVariant?.proposedEventSpec.budgetContext?.pricingSummary;
        if (!selectedVariant || !pricingSummary) {
          throw new Error("The selected variant has no approvable pricing snapshot.");
        }
        return validateApprovedOffer({
          schemaVersion: "1.0",
          businessId: actor.businessId,
          approvedOfferId: deterministicId("approved-offer", { businessId: actor.businessId, approvalRequestId: finalApproval.approvalRequestId }),
          sourceDraft: { draftId: draft.draftId, revision: requestedRevision! },
          selectedVariantId: selectedVariant.variantId,
          approvalRequestId: finalApproval.approvalRequestId,
          approvedAt: finalApproval.decidedAt,
          eventSummary: draft.eventSummary,
          customerFacingText: draft.customerFacingText,
          serviceModules: structuredClone(draft.serviceModules),
          pricingSummary: structuredClone(pricingSummary),
          selectedVariant: structuredClone(selectedVariant)
        });
      };
      let candidateApprovedOffer;
      if (approval.decision === "approved") {
        try {
          candidateApprovedOffer = buildApprovedOffer(approval);
        } catch {
          return reply.code(422).send({ message: "Die gewählte Angebotsvariante enthält keinen vollständigen freigabefähigen Preis-Snapshot." });
        }
      }
      if (!stored) {
        const inserted = await store.insertApproval(actor, approval);
        if (inserted === "exists") {
          stored = await store.getApproval(actor, approval.approvalRequestId);
          if (!stored || !sameDecision(stored, approval)) {
            return reply.code(409).send({ message: "Für diesen Entwurf liegt bereits eine andere Entscheidung vor." });
          }
        }
      }
      const finalApproval = stored ?? approval;
      if (finalApproval.decision === "rejected") return reply.code(201).send({ approval: finalApproval });
      const approvedOffer = stored ? buildApprovedOffer(finalApproval) : candidateApprovedOffer!;
      const created = await store.insertApprovedOffer(actor, approvedOffer);
      if (created === "exists") {
        const existingOffer = await store.getApprovedOffer(actor, approvedOffer.approvedOfferId);
        if (!areJsonValuesEqual(existingOffer, approvedOffer)) return reply.code(409).send({ message: "Freigegebenes Angebot stimmt nicht mit dem bestehenden Artefakt überein." });
      }
      await logApprovedOfferAudit(actor, finalApproval, approvedOffer);
      return reply.code(201).send({ approval: finalApproval, approvedOffer });
    }
  );

  app.post<{ Params: { approvedOfferId: string } }>("/v1/offers/approved/:approvedOfferId/handoffs", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply);
    if (forbidden) return forbidden;
    const actor = actorForRequest(request);
    const approvedOffer = await store.getApprovedOffer(actor, request.params.approvedOfferId);
    if (!approvedOffer) return reply.code(404).send({ message: "Freigegebenes Angebot nicht gefunden." });
    const handoff = validateProductionHandoff({
      schemaVersion: "1.0", businessId: actor.businessId,
      handoffId: deterministicId("handoff", { businessId: actor.businessId, approvedOfferId: approvedOffer.approvedOfferId }),
      approvedOfferId: approvedOffer.approvedOfferId, approvalRequestId: approvedOffer.approvalRequestId, createdAt: approvedOffer.approvedAt,
      eventSpecSnapshot: { ...structuredClone(approvedOffer.selectedVariant.proposedEventSpec), lifecycle: { commercialState: "accepted" } },
      pricingSnapshot: structuredClone(approvedOffer.selectedVariant.proposedEventSpec.budgetContext!.pricingSummary!),
      source: { draftId: approvedOffer.sourceDraft.draftId, revision: approvedOffer.sourceDraft.revision, selectedVariantId: approvedOffer.selectedVariantId }
    });
    const inserted = await store.insertHandoff(actor, handoff);
    if (inserted === "exists") {
      const existing = await store.getHandoff(actor, handoff.handoffId);
      if (!areJsonValuesEqual(existing, handoff)) return reply.code(409).send({ message: "Bestehende Produktionsübergabe stimmt nicht überein." });
    }
    await auditLog.logFor(actor, {
      action: "offer.production_handoff_created", entityType: "ProductionHandoff", entityId: handoff.handoffId,
      actor, at: handoff.createdAt, idempotencyKey: `production-handoff:${handoff.handoffId}`,
      summary: "Freigegebenes Angebot an die Produktion übergeben.",
      details: { approvedOfferId: approvedOffer.approvedOfferId }
    });
    return reply.code(201).send({ handoff });
  });

  app.get<{ Params: { handoffId: string } }>("/v1/offers/handoffs/:handoffId", async (request, reply) => {
    const forbidden = requireHandoffReader(request, reply);
    if (forbidden) return forbidden;
    const handoff = await store.getHandoff(actorForRequest(request), request.params.handoffId);
    return handoff ? reply.send({ handoff }) : reply.code(404).send({ message: "Produktionsübergabe nicht gefunden." });
  });
}
