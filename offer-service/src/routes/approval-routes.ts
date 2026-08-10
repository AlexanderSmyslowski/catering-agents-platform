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
  type OfferDraft,
  type TrustedActor
} from "@catering/shared-core";
import {
  approvedOfferIdForApproval,
  validateOfferDecisionAggregate,
  type OfferDecisionAggregate
} from "../offer-decision-aggregate.js";
import {
  offerDecisionRepositoryFor,
  type OfferDecisionTargetScope,
  type OfferStore
} from "../store.js";

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

function sameOptionalJsonValue<T>(left: T | undefined, right: T | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return areJsonValuesEqual(left, right);
}

export function registerOfferApprovalRoutes(app: FastifyInstance, deps: OfferApprovalRouteDependencies) {
  const { store, auditLog, requireOfferOperator, requireHandoffReader, actorForRequest } = deps;
  const decisionRepository = offerDecisionRepositoryFor(store);
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
  const projectDecisionAggregate = async (actor: TrustedActor, aggregate: OfferDecisionAggregate) => {
    let approvalProjection = await store.getApproval(actor, aggregate.approval.approvalRequestId);
    if (!approvalProjection) {
      const inserted = await store.insertApproval(actor, aggregate.approval);
      approvalProjection = inserted === "created"
        ? aggregate.approval
        : await store.getApproval(actor, aggregate.approval.approvalRequestId);
    }
    if (!areJsonValuesEqual(approvalProjection, aggregate.approval)) return "approval_conflict" as const;
    if (aggregate.approval.decision === "rejected") return "ok" as const;

    const approvedOffer = aggregate.approvedOffer!;
    let approvedOfferProjection = await store.getApprovedOffer(actor, approvedOffer.approvedOfferId);
    if (!approvedOfferProjection) {
      const inserted = await store.insertApprovedOffer(actor, approvedOffer);
      approvedOfferProjection = inserted === "created"
        ? approvedOffer
        : await store.getApprovedOffer(actor, approvedOffer.approvedOfferId);
    }
    if (!areJsonValuesEqual(approvedOfferProjection, approvedOffer)) return "approved_offer_conflict" as const;
    await logApprovedOfferAudit(actor, aggregate.approval, approvedOffer);
    return "ok" as const;
  };

  const sendAggregateResponse = async (
    actor: TrustedActor,
    aggregate: OfferDecisionAggregate,
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ) => {
    const projection = await projectDecisionAggregate(actor, aggregate);
    if (projection === "approval_conflict") {
      return reply.code(409).send({ message: "Für diesen Entwurf liegt bereits eine andere Entscheidung vor." });
    }
    if (projection === "approved_offer_conflict") {
      return reply.code(409).send({ message: "Freigegebenes Angebot stimmt nicht mit dem bestehenden Artefakt überein." });
    }
    return aggregate.approval.decision === "rejected"
      ? reply.code(201).send({ approval: aggregate.approval })
      : reply.code(201).send({ approval: aggregate.approval, approvedOffer: aggregate.approvedOffer });
  };

  const buildApprovedOffer = (
    actor: TrustedActor,
    draft: OfferDraft,
    approval: ApprovalRequestRecord
  ): ApprovedOffer => {
    const selectedVariant = draft.variantSet.find(
      (variant) => variant.variantId === approval.selectedVariantId
    );
    const pricingSummary = selectedVariant?.proposedEventSpec.budgetContext?.pricingSummary;
    if (approval.decision !== "approved" || !selectedVariant || !pricingSummary) {
      throw new Error("The selected variant has no approvable pricing snapshot.");
    }
    return validateApprovedOffer({
      schemaVersion: "1.0",
      businessId: actor.businessId,
      approvedOfferId: approvedOfferIdForApproval(approval),
      sourceDraft: { draftId: draft.draftId, revision: approval.target.revision },
      selectedVariantId: selectedVariant.variantId,
      approvalRequestId: approval.approvalRequestId,
      approvedAt: approval.decidedAt,
      eventSummary: draft.eventSummary,
      customerFacingText: draft.customerFacingText,
      serviceModules: structuredClone(draft.serviceModules),
      pricingSummary: structuredClone(pricingSummary),
      selectedVariant: structuredClone(selectedVariant)
    });
  };

  const stageDecisionProjections = async (
    scope: OfferDecisionTargetScope,
    candidate: OfferDecisionAggregate
  ): Promise<boolean> => {
    // Previous binaries share these deterministic IDs, so the insert-only rows close gaps their target locks cannot.
    const approvalInsert = await scope.insertApproval(candidate.approval);
    if (approvalInsert === "exists") {
      const existingApproval = await scope.getApproval(candidate.approval.approvalRequestId);
      if (!existingApproval || !areJsonValuesEqual(existingApproval, candidate.approval)) return false;
    }

    if (candidate.approval.decision === "rejected") {
      return (await scope.getApprovedOffer(approvedOfferIdForApproval(candidate.approval))) === undefined;
    }

    const approvedOffer = candidate.approvedOffer!;
    const approvedOfferInsert = await scope.insertApprovedOffer(approvedOffer);
    if (approvedOfferInsert === "created") return true;
    const existingApprovedOffer = await scope.getApprovedOffer(approvedOffer.approvedOfferId);
    return existingApprovedOffer !== undefined && areJsonValuesEqual(existingApprovedOffer, approvedOffer);
  };

  const claimAggregate = async (
    scope: OfferDecisionTargetScope,
    candidate: OfferDecisionAggregate,
    requestedApproval: ApprovalRequestRecord,
    requireIdenticalCandidate = false
  ): Promise<OfferDecisionAggregate | undefined> => {
    const inserted = await scope.insertDecisionAggregate(candidate);
    if (inserted === "created") return candidate;
    const winner = await scope.getDecisionAggregate(requestedApproval.approvalRequestId);
    if (!winner) return undefined;
    return requireIdenticalCandidate
      ? (areJsonValuesEqual(winner, candidate) ? winner : undefined)
      : (sameDecision(winner.approval, requestedApproval) ? winner : undefined);
  };

  const resolveLegacyDecision = async (
    scope: OfferDecisionTargetScope,
    actor: TrustedActor,
    requestedApproval: ApprovalRequestRecord
  ): Promise<
    | { status: "none" }
    | { status: "conflict" }
    | { status: "aggregate"; aggregate: OfferDecisionAggregate }
  > => {
    const legacyApprovals = await scope.listApprovalsForTarget();
    if (legacyApprovals.length > 1) return { status: "conflict" };
    const legacyApproval = legacyApprovals[0];
    if (!legacyApproval) {
      const orphanOffer = await scope.getApprovedOffer(approvedOfferIdForApproval(requestedApproval));
      return orphanOffer ? { status: "conflict" } : { status: "none" };
    }
    if (!sameDecision(legacyApproval, requestedApproval)) return { status: "conflict" };

    let candidate: OfferDecisionAggregate;
    let observedApprovedOffer: ApprovedOffer | undefined;
    try {
      if (legacyApproval.decision === "rejected") {
        const unexpectedOffer = await scope.getApprovedOffer(approvedOfferIdForApproval(legacyApproval));
        if (unexpectedOffer) return { status: "conflict" };
        candidate = validateOfferDecisionAggregate({
          schemaVersion: "1.0",
          businessId: actor.businessId,
          approval: legacyApproval
        });
      } else {
        observedApprovedOffer = await scope.getApprovedOffer(approvedOfferIdForApproval(legacyApproval));
        let approvedOffer = observedApprovedOffer;
        if (!approvedOffer) {
          const draft = await scope.getDraft(legacyApproval.target.artifactId);
          if (!draft || draft.revision !== legacyApproval.target.revision) return { status: "conflict" };
          approvedOffer = buildApprovedOffer(actor, draft, legacyApproval);
        }
        candidate = validateOfferDecisionAggregate({
          schemaVersion: "1.0",
          businessId: actor.businessId,
          approval: legacyApproval,
          approvedOffer
        });
      }
    } catch {
      return { status: "conflict" };
    }

    const currentApprovals = await scope.listApprovalsForTarget();
    if (currentApprovals.length !== 1 || !areJsonValuesEqual(currentApprovals[0], legacyApproval)) {
      return { status: "conflict" };
    }
    const currentApprovedOffer = await scope.getApprovedOffer(approvedOfferIdForApproval(legacyApproval));
    if (!sameOptionalJsonValue(currentApprovedOffer, observedApprovedOffer)) {
      return { status: "conflict" };
    }
    if (!(await stageDecisionProjections(scope, candidate))) return { status: "conflict" };
    const aggregate = await claimAggregate(scope, candidate, requestedApproval, true);
    return aggregate ? { status: "aggregate", aggregate } : { status: "conflict" };
  };

  const legacyStateIsStillAbsent = async (
    scope: OfferDecisionTargetScope,
    requestedApproval: ApprovalRequestRecord
  ): Promise<boolean> => {
    if ((await scope.listApprovalsForTarget()).length > 0) return false;
    return (await scope.getApprovedOffer(approvedOfferIdForApproval(requestedApproval))) === undefined;
  };

  app.post<{ Params: { draftId: string }; Body: { decision?: "approved" | "rejected"; revision?: number; variantId?: string; comment?: string } }>(
    "/v1/offers/drafts/:draftId/decision",
    async (request, reply) => {
      const forbidden = requireOfferOperator(request, reply);
      if (forbidden) return forbidden;
      const actor = actorForRequest(request);
      const decision = request.body?.decision;
      const requestedRevision = request.body?.revision;
      const hasValidDecision = decision === "approved" || decision === "rejected";
      const hasValidRevision = Number.isInteger(requestedRevision)
        && requestedRevision! >= 1
        && requestedRevision! <= 2_147_483_647;
      let requestedApproval: ApprovalRequestRecord | undefined;
      let approvalError: unknown;
      if (hasValidDecision && hasValidRevision) {
        try {
          requestedApproval = createApprovalRequestRecord({
            actor,
            role: "offer_operator",
            target: { kind: "offer_draft", artifactId: request.params.draftId, revision: requestedRevision! },
            decision,
            ...(decision === "approved" && request.body.variantId !== undefined
              ? { selectedVariantId: request.body.variantId }
              : {}),
            ...(request.body?.comment?.trim() ? { comment: request.body.comment.trim() } : {})
          });
        } catch (error) {
          approvalError = error;
        }
      }

      if (requestedApproval) {
        const resolution = await decisionRepository.withTargetCriticalSection(
          actor,
          requestedApproval.target,
          async (scope) => {
            const existingAggregate = await scope.getDecisionAggregate(requestedApproval!.approvalRequestId);
            if (existingAggregate) {
              return sameDecision(existingAggregate.approval, requestedApproval!)
                ? { status: "aggregate" as const, aggregate: existingAggregate }
                : { status: "decision_conflict" as const };
            }

            const legacy = await resolveLegacyDecision(scope, actor, requestedApproval!);
            if (legacy.status === "conflict") return { status: "legacy_conflict" as const };
            if (legacy.status === "aggregate") return legacy;

            const draft = await scope.getDraft(request.params.draftId);
            if (!draft) return { status: "missing_draft" as const };
            if (draft.revision !== requestedApproval!.target.revision) {
              return { status: "stale_revision" as const };
            }

            let candidateApprovedOffer: ApprovedOffer | undefined;
            if (requestedApproval!.decision === "approved") {
              try {
                candidateApprovedOffer = buildApprovedOffer(actor, draft, requestedApproval!);
              } catch {
                const selectedVariantExists = draft.variantSet.some(
                  (variant) => variant.variantId === requestedApproval!.selectedVariantId
                );
                return selectedVariantExists
                  ? { status: "unpriceable_variant" as const }
                  : { status: "missing_variant" as const };
              }
            }
            const candidateAggregate = validateOfferDecisionAggregate({
              schemaVersion: "1.0",
              businessId: actor.businessId,
              approval: requestedApproval!,
              ...(candidateApprovedOffer ? { approvedOffer: candidateApprovedOffer } : {})
            });
            if (!(await legacyStateIsStillAbsent(scope, requestedApproval!))) {
              const lateLegacy = await resolveLegacyDecision(scope, actor, requestedApproval!);
              return lateLegacy.status === "aggregate"
                ? lateLegacy
                : { status: "legacy_conflict" as const };
            }
            if (!(await stageDecisionProjections(scope, candidateAggregate))) {
              const lateLegacy = await resolveLegacyDecision(scope, actor, requestedApproval!);
              return lateLegacy.status === "aggregate"
                ? lateLegacy
                : { status: "legacy_conflict" as const };
            }
            const finalAggregate = await claimAggregate(scope, candidateAggregate, requestedApproval!);
            return finalAggregate
              ? { status: "aggregate" as const, aggregate: finalAggregate }
              : { status: "decision_conflict" as const };
          }
        );

        if (resolution.status === "aggregate") {
          return sendAggregateResponse(actor, resolution.aggregate, reply);
        }
        if (resolution.status === "legacy_conflict") {
          return reply.code(409).send({ message: "Der bestehende Freigabestand kann nicht eindeutig als autoritative Angebotsentscheidung übernommen werden." });
        }
        if (resolution.status === "decision_conflict") {
          return reply.code(409).send({ message: "Für diesen Entwurf liegt bereits eine andere Entscheidung vor." });
        }
        if (resolution.status === "missing_draft") {
          return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
        }
        if (resolution.status === "stale_revision") {
          return reply.code(409).send({ message: "Die angeforderte Angebotsrevision ist nicht mehr der aktuelle Entwurf." });
        }
        if (resolution.status === "unpriceable_variant") {
          return reply.code(422).send({ message: "Die gewählte Angebotsvariante enthält keinen vollständigen freigabefähigen Preis-Snapshot." });
        }
        return reply.code(422).send({ message: "Eine vorhandene Angebotsvariante muss explizit gewählt werden." });
      }

      const draft = await store.getDraft(actor, request.params.draftId);
      if (!draft) return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
      if (!hasValidDecision) return reply.code(422).send({ message: "Explizite Freigabeentscheidung erforderlich." });
      if (!hasValidRevision) {
        return reply.code(422).send({ message: "Eine gültige Angebotsrevision ist für die Entscheidung erforderlich." });
      }
      if (!requestedApproval) {
        return reply.code(403).send({ message: approvalError instanceof Error ? approvalError.message : "Freigabe nicht zulässig." });
      }
      return reply.code(403).send({ message: "Freigabe nicht zulässig." });
    }
  );

  app.post<{ Params: { approvedOfferId: string } }>("/v1/offers/approved/:approvedOfferId/handoffs", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply);
    if (forbidden) return forbidden;
    const actor = actorForRequest(request);
    const aggregates = await decisionRepository.listDecisionAggregatesForApprovedOffer(actor, request.params.approvedOfferId);
    if (aggregates.length === 0) return reply.code(404).send({ message: "Freigegebenes Angebot nicht gefunden." });
    if (aggregates.length > 1) {
      return reply.code(409).send({ message: "Freigegebenes Angebot ist nicht eindeutig einer autoritativen Entscheidung zugeordnet." });
    }
    const aggregate = aggregates[0]!;
    const projection = await projectDecisionAggregate(actor, aggregate);
    if (projection !== "ok") {
      return reply.code(409).send({ message: "Freigegebenes Angebot stimmt nicht mit der autoritativen Entscheidung überein." });
    }
    const approvedOffer = aggregate.approvedOffer!;
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
