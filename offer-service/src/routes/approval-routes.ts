import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  AuditLogEntryConflictError,
  AuditLogPostPublishError,
  AuditLogStore,
  auditIdFor,
  createApprovalRequestRecord,
  resolveMinimalMvpRoleFromTrustedActor,
  validateApprovedOffer,
  validateProductionHandoff,
  type ApprovalRequestRecord,
  type ApprovedOffer,
  type AuditLogWriteResult,
  type AuditEntry,
  type CaseEvent,
  type OfferDraft,
  type ProductionHandoff,
  type Queryable,
  type TrustedActor
} from "@catering/shared-core";
import {
  approvedOfferIdForApproval,
  validateOfferDecisionAggregate,
  type OfferDecisionAggregate
} from "../offer-decision-aggregate.js";
import {
  offerDecisionRepositoryFor,
  offerDraftTimelineError,
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

function approvalRoleForActor(actor: TrustedActor): "offer_operator" | "admin" {
  return resolveMinimalMvpRoleFromTrustedActor(actor) === "admin" ? "admin" : "offer_operator";
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

/**
 * A conflict discovered after a transaction-local publication must abort the
 * transaction rather than be returned as an ordinary callback value.  The
 * route maps this internal error to the public 409 response after the
 * File/PG critical section has had a chance to roll back.
 */
class OfferPublicationConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "OfferPublicationConflictError";
  }
}

async function updateOfferCaseProjection(
  store: OfferStore,
  actor: TrustedActor,
  caseId: string,
  update: {
    approvedOfferId?: string;
    productionHandoffId?: string;
    status?: "open" | "completed";
  },
  updatedAt: string
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await store.getCase(actor, caseId);
    if (!current) return;
    const unchanged = Object.entries(update).every(([key, value]) =>
      current[key as keyof typeof current] === value
    );
    if (unchanged) return;
    const result = await store.updateCase(actor, caseId, current.version, {
      ...current,
      ...update,
      version: current.version + 1,
      updatedAt: current.updatedAt > updatedAt ? current.updatedAt : updatedAt
    });
    if (result === "updated" || result === "missing") return;
  }
  throw new Error("Angebotsauftrag wurde gleichzeitig zu oft verändert.");
}

export function registerOfferApprovalRoutes(app: FastifyInstance, deps: OfferApprovalRouteDependencies) {
  const { store, auditLog, requireOfferOperator, requireHandoffReader, actorForRequest } = deps;
  const decisionRepository = offerDecisionRepositoryFor(store);
  type OfferAuditInput = Parameters<AuditLogStore["logForWithResult"]>[1];
  type OfferAuditPublication = {
    writer: AuditLogStore;
    context: { businessId: string };
    result: AuditLogWriteResult;
  };
  type OfferAuditPublicationHolder = { publications: OfferAuditPublication[] };
  type DecisionResolution =
    | { status: "case_timeline_conflict" | "legacy_conflict" | "decision_conflict" | "missing_draft" | "stale_revision" | "unpriceable_variant" | "missing_variant" | "audit_conflict" }
    | { status: "aggregate"; aggregate: OfferDecisionAggregate; published: true }
    | { status: "projection_conflict" };
  type HandoffResolution =
    | { status: "timeline_conflict" | "case_conflict" | "projection_conflict" | "handoff_conflict" }
    | { status: "ok" };

  const prepareOfferAudit = async (
    actor: TrustedActor,
    input: OfferAuditInput,
    transactionalQueryable?: Queryable,
    holder?: OfferAuditPublicationHolder
  ): Promise<"ok" | "conflict"> => {
    const writer = transactionalQueryable
      ? new AuditLogStore({ pgPool: transactionalQueryable })
      : auditLog;
    const context = { businessId: actor.businessId };
    try {
      const result = await writer.logForWithResult(context, input);
      holder?.publications.push({ writer, context, result });
      return "ok";
    } catch (error) {
      if (error instanceof AuditLogEntryConflictError) return "conflict";
      if (error instanceof AuditLogPostPublishError && !transactionalQueryable) {
        const compensation = await writer.deleteIfExact(context, error.entry);
        if (compensation === "conflict") {
          throw new Error("Audit-Eigentum konnte nach einer unterbrochenen Veröffentlichung nicht sicher zurückgebaut werden.");
        }
      }
      throw error;
    }
  };

  const offerAuditEntryFor = (
    actor: TrustedActor,
    input: OfferAuditInput
  ): AuditEntry => {
    const { idempotencyKey, ...auditInput } = input;
    const entryWithoutId: Omit<AuditEntry, "auditId"> = {
      ...auditInput,
      actor: {
        name: auditInput.actor.name,
        source: auditInput.actor.source
      },
      businessId: actor.businessId,
      at: auditInput.at ?? new Date().toISOString()
    };
    return {
      ...entryWithoutId,
      auditId: auditIdFor(entryWithoutId, idempotencyKey)
    };
  };

  const offerAuditPreflight = async (
    actor: TrustedActor,
    input: OfferAuditInput,
    transactionalQueryable?: Queryable
  ): Promise<boolean> => {
    const writer = transactionalQueryable
      ? new AuditLogStore({ pgPool: transactionalQueryable })
      : auditLog;
    const expected = offerAuditEntryFor(actor, input);
    const existing = await writer.getFor({ businessId: actor.businessId }, expected.auditId);
    return existing === undefined || areJsonValuesEqual(existing, expected);
  };

  const compensateOfferAudits = async (holder: OfferAuditPublicationHolder): Promise<void> => {
    for (const publication of [...holder.publications].reverse()) {
      if (!publication.result.created) continue;
      const result = await publication.writer.deleteIfExact(publication.context, publication.result.entry);
      if (result === "conflict") {
        throw new Error("Audit-Eigentum konnte nach einer unterbrochenen Veröffentlichung nicht sicher zurückgebaut werden.");
      }
    }
  };

  const approvedOfferAuditInput = (
    approval: ApprovalRequestRecord,
    approvedOffer: ApprovedOffer
  ): OfferAuditInput => ({
    action: "offer.approved",
    entityType: "ApprovedOffer",
    entityId: approvedOffer.approvedOfferId,
    actor: approval.decidedBy,
    at: approvedOffer.approvedAt,
    idempotencyKey: `approved-offer:${approvedOffer.approvedOfferId}`,
    summary: "Angebotsvariante explizit freigegeben.",
    details: { draftId: approvedOffer.sourceDraft.draftId, variantId: approvedOffer.selectedVariantId }
  });

  const decisionCaseEventSpecs = (
    aggregate: OfferDecisionAggregate
  ): Array<{ identity: string; input: Omit<CaseEvent, "businessId" | "eventId" | "caseId" | "sequence"> }> => {
    const specs: Array<{ identity: string; input: Omit<CaseEvent, "businessId" | "eventId" | "caseId" | "sequence"> }> = [{
      identity: aggregate.approval.approvalRequestId,
      input: {
        at: aggregate.approval.decidedAt,
        role: "user",
        kind: "review_decision",
        text: aggregate.approval.decision === "approved"
          ? "Angebotsentwurf freigegeben."
          : "Angebotsentwurf abgelehnt.",
        artifactId: aggregate.approval.approvalRequestId
      }
    }];
    if (aggregate.approvedOffer) {
      specs.push({
        identity: aggregate.approvedOffer.approvedOfferId,
        input: {
          at: aggregate.approvedOffer.approvedAt,
          role: "system",
          kind: "approval",
          text: "Angebot freigegeben.",
          artifactId: aggregate.approvedOffer.approvedOfferId
        }
      });
    }
    return specs;
  };

  const decisionPublicationPreflight = async (
    actor: TrustedActor,
    scope: OfferDecisionTargetScope,
    caseId: string,
    aggregate: OfferDecisionAggregate,
    transactionalQueryable?: Queryable
  ): Promise<boolean> => {
    const currentCase = await scope.getCase(caseId);
    if (!currentCase) return false;
    if (
      currentCase.approvedOfferId !== undefined
      && currentCase.approvedOfferId !== aggregate.approvedOffer?.approvedOfferId
    ) {
      return false;
    }
    const events = await scope.listCaseEvents(caseId);
    for (const spec of decisionCaseEventSpecs(aggregate)) {
      const eventId = `offer-case-event-${createHash("sha256")
        .update(`${actor.businessId}\0${caseId}\0${spec.input.kind}\0${spec.identity}`)
        .digest("hex")}`;
      const matches = events.filter((event) =>
        event.eventId === eventId
        || (event.kind === spec.input.kind && event.artifactId === spec.input.artifactId)
      );
      if (matches.length > 1) return false;
      const existing = matches[0];
      if (!existing) continue;
      const expected = {
        ...spec.input,
        businessId: actor.businessId,
        eventId,
        caseId,
        sequence: existing.sequence
      } satisfies CaseEvent;
      if (!areJsonValuesEqual(existing, expected)) return false;
    }
    if (aggregate.approvedOffer && !await offerAuditPreflight(
      actor,
      approvedOfferAuditInput(aggregate.approval, aggregate.approvedOffer),
      transactionalQueryable
    )) {
      return false;
    }
    return true;
  };

  const handoffAuditInput = (
    actor: TrustedActor,
    handoff: ProductionHandoff,
    approvedOfferId: string
  ): OfferAuditInput => ({
    action: "offer.production_handoff_created",
    entityType: "ProductionHandoff",
    entityId: handoff.handoffId,
    actor,
    at: handoff.createdAt,
    idempotencyKey: `production-handoff:${handoff.handoffId}`,
    summary: "Freigegebenes Angebot an die Produktion übergeben.",
    details: { approvedOfferId }
  });

  const projectDecisionAggregate = async (
    actor: TrustedActor,
    aggregate: OfferDecisionAggregate,
    scope?: OfferDecisionTargetScope,
    transactionalQueryable?: Queryable,
    holder?: OfferAuditPublicationHolder
  ) => {
    const publicationHolder = holder ?? { publications: [] };
    const lateConflict = async <T extends "approval_conflict" | "approved_offer_conflict">(
      status: T,
      message: string
    ): Promise<T> => {
      if (transactionalQueryable) throw new OfferPublicationConflictError(message);
      await compensateOfferAudits(publicationHolder);
      return status;
    };
    const approvalProjection = scope
      ? await scope.getApproval(aggregate.approval.approvalRequestId)
      : await store.getApproval(actor, aggregate.approval.approvalRequestId);
    if (approvalProjection && !areJsonValuesEqual(approvalProjection, aggregate.approval)) return "approval_conflict" as const;
    if (aggregate.approval.decision === "rejected") return "ok" as const;

    const approvedOffer = aggregate.approvedOffer!;
    const approvedOfferProjection = scope
      ? await scope.getApprovedOffer(approvedOffer.approvedOfferId)
      : await store.getApprovedOffer(actor, approvedOffer.approvedOfferId);
    if (approvedOfferProjection && !areJsonValuesEqual(approvedOfferProjection, approvedOffer)) return "approved_offer_conflict" as const;

    const audit = await prepareOfferAudit(
      actor,
      approvedOfferAuditInput(aggregate.approval, approvedOffer),
      transactionalQueryable,
      publicationHolder
    );
    if (audit === "conflict") return "audit_conflict" as const;

    try {
      if (!approvalProjection) {
        const inserted = scope
          ? await scope.insertApproval(aggregate.approval)
          : await store.insertApproval(actor, aggregate.approval);
        if (inserted === "exists") {
          const racedApproval = scope
            ? await scope.getApproval(aggregate.approval.approvalRequestId)
            : await store.getApproval(actor, aggregate.approval.approvalRequestId);
          if (!racedApproval || !areJsonValuesEqual(racedApproval, aggregate.approval)) {
            return lateConflict(
              "approval_conflict",
              "Für diesen Entwurf liegt bereits eine andere Entscheidung vor."
            );
          }
        }
      }
      if (!approvedOfferProjection) {
        const inserted = scope
          ? await scope.insertApprovedOffer(approvedOffer)
          : await store.insertApprovedOffer(actor, approvedOffer);
        if (inserted === "exists") {
          const racedOffer = scope
            ? await scope.getApprovedOffer(approvedOffer.approvedOfferId)
            : await store.getApprovedOffer(actor, approvedOffer.approvedOfferId);
          if (!racedOffer || !areJsonValuesEqual(racedOffer, approvedOffer)) {
            return lateConflict(
              "approved_offer_conflict",
              "Freigegebenes Angebot stimmt nicht mit dem bestehenden Artefakt überein."
            );
          }
        }
      }
    } catch (error) {
      if (!transactionalQueryable) await compensateOfferAudits(publicationHolder);
      throw error;
    }
    return "ok" as const;
  };
  const handoffForApprovedOffer = (actor: TrustedActor, approvedOffer: ApprovedOffer): ProductionHandoff =>
    validateProductionHandoff({
      schemaVersion: "1.0",
      businessId: actor.businessId,
      handoffId: deterministicId("handoff", {
        businessId: actor.businessId,
        approvedOfferId: approvedOffer.approvedOfferId
      }),
      approvedOfferId: approvedOffer.approvedOfferId,
      approvalRequestId: approvedOffer.approvalRequestId,
      createdAt: approvedOffer.approvedAt,
      eventSpecSnapshot: {
        ...structuredClone(approvedOffer.selectedVariant.proposedEventSpec),
        lifecycle: { commercialState: "accepted" }
      },
      pricingSnapshot: structuredClone(approvedOffer.selectedVariant.proposedEventSpec.budgetContext!.pricingSummary!),
      source: {
        draftId: approvedOffer.sourceDraft.draftId,
        revision: approvedOffer.sourceDraft.revision,
        selectedVariantId: approvedOffer.selectedVariantId
      }
    });
  const appendDecisionEvents = async (
    actor: TrustedActor,
    aggregate: OfferDecisionAggregate,
    scope?: OfferDecisionTargetScope,
    caseId?: string
  ) => {
    const approval = aggregate.approval;
    const decisionEvent = scope && caseId
      ? await scope.appendCaseEvent(caseId, {
        at: approval.decidedAt,
        role: "user",
        kind: "review_decision",
        text: approval.decision === "approved" ? "Angebotsentwurf freigegeben." : "Angebotsentwurf abgelehnt.",
        artifactId: approval.approvalRequestId
      }, approval.approvalRequestId)
      : await store.appendEventForArtifactCase(actor, approval.target.artifactId, {
      at: approval.decidedAt,
      role: "user",
      kind: "review_decision",
      text: approval.decision === "approved" ? "Angebotsentwurf freigegeben." : "Angebotsentwurf abgelehnt.",
      artifactId: approval.approvalRequestId
    });
    if (aggregate.approvedOffer) {
      const approvalEvent = scope && caseId
        ? await scope.appendCaseEvent(caseId, {
          at: aggregate.approvedOffer.approvedAt,
          role: "system",
          kind: "approval",
          text: "Angebot freigegeben.",
          artifactId: aggregate.approvedOffer.approvedOfferId
        }, aggregate.approvedOffer.approvedOfferId)
        : await store.appendEventForArtifactCase(actor, approval.target.artifactId, {
        at: aggregate.approvedOffer.approvedAt,
        role: "system",
        kind: "approval",
        text: "Angebot freigegeben.",
        artifactId: aggregate.approvedOffer.approvedOfferId
      });
      if (decisionEvent && approvalEvent) {
        if (scope && caseId) {
          const current = await scope.getCase(caseId);
          if (!current) throw new Error("OfferCase wurde nicht gefunden.");
          if (current.approvedOfferId && current.approvedOfferId !== aggregate.approvedOffer.approvedOfferId) {
            throw new Error("Angebotsauftrag besitzt bereits ein anderes freigegebenes Angebot.");
          }
          if (!current.approvedOfferId) {
            const updated = await scope.compareAndSetCase(caseId, current.version, {
              ...current,
              approvedOfferId: aggregate.approvedOffer.approvedOfferId,
              version: current.version + 1,
              updatedAt: aggregate.approvedOffer.approvedAt > current.updatedAt
                ? aggregate.approvedOffer.approvedAt
                : current.updatedAt
            });
            if (updated !== "updated") {
              throw new Error("Angebotsauftrag konnte nicht atomar mit der Freigabe verknüpft werden.");
            }
          }
        } else {
          await updateOfferCaseProjection(store, actor, decisionEvent.caseId, {
          approvedOfferId: aggregate.approvedOffer.approvedOfferId
          }, aggregate.approvedOffer.approvedAt);
        }
      }
    }
  };

  const sendAggregateResponse = async (
    actor: TrustedActor,
    aggregate: OfferDecisionAggregate,
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    alreadyProjected = false
  ) => {
    if (!alreadyProjected) {
      const projection = await projectDecisionAggregate(actor, aggregate);
      if (projection === "approval_conflict") {
        return reply.code(409).send({ message: "Für diesen Entwurf liegt bereits eine andere Entscheidung vor." });
      }
      if (projection === "approved_offer_conflict") {
        return reply.code(409).send({ message: "Freigegebenes Angebot stimmt nicht mit dem bestehenden Artefakt überein." });
      }
      if (projection === "audit_conflict") {
        return reply.code(409).send({ message: "Entscheidungs-Audit stimmt nicht mit der autoritativen Entscheidung überein." });
      }
      await appendDecisionEvents(actor, aggregate);
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
    requestedApproval: ApprovalRequestRecord,
    caseId: string,
    transactionalQueryable?: Queryable
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
    if (!await decisionPublicationPreflight(
      actor,
      scope,
      caseId,
      candidate,
      transactionalQueryable
    )) {
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

  const publishAggregateInCaseScope = async (
    actor: TrustedActor,
    scope: OfferDecisionTargetScope,
    caseId: string,
    aggregate: OfferDecisionAggregate,
    transactionalQueryable?: Queryable,
    holder?: OfferAuditPublicationHolder
  ): Promise<
    | { status: "aggregate"; aggregate: OfferDecisionAggregate; published: true }
    | { status: "projection_conflict" }
  > => {
    if (!await decisionPublicationPreflight(actor, scope, caseId, aggregate, transactionalQueryable)) {
      return { status: "projection_conflict" };
    }
    const projection = await projectDecisionAggregate(actor, aggregate, scope, transactionalQueryable, holder);
    if (projection !== "ok") {
      if (transactionalQueryable) {
        throw new OfferPublicationConflictError(
          "Freigegebene Angebotsprojektion stimmt nicht mit der autoritativen Entscheidung überein."
        );
      }
      return { status: "projection_conflict" };
    }
    await appendDecisionEvents(actor, aggregate, scope, caseId);
    return { status: "aggregate", aggregate, published: true };
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
            role: approvalRoleForActor(actor),
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
        const linkedCaseId = await store.findCaseIdForDraft(
          actorForRequest(request),
          requestedApproval.target.artifactId,
          requestedApproval.target.revision
        );
        if (!linkedCaseId) {
          const existingDraft = await store.getDraft(
            actorForRequest(request),
            requestedApproval.target.artifactId
          );
          if (!existingDraft) return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
          return reply.code(409).send({ message: "Der Angebotsentwurf besitzt keine exakt passende Case-Timeline-Projektion." });
        }
        let resolution: DecisionResolution;
        try {
          resolution = await decisionRepository.withTargetCriticalSection(
            actor,
            requestedApproval.target,
            async (scope, transactionalQueryable) => {
            const publicationHolder: OfferAuditPublicationHolder = { publications: [] };
            const publish = (candidate: OfferDecisionAggregate) => publishAggregateInCaseScope(
              actor,
              scope,
              linkedCaseId,
              candidate,
              transactionalQueryable,
              publicationHolder
            );
            try {
              const caseEvents = await scope.listCaseEvents(linkedCaseId);
            const timelineError = offerDraftTimelineError(
              caseEvents,
              requestedApproval!.target.artifactId,
              requestedApproval!.target.revision
            );
            if (timelineError) return { status: "case_timeline_conflict" as const };
            const existingAggregate = await scope.getDecisionAggregate(requestedApproval!.approvalRequestId);
            if (existingAggregate) {
              if (!sameDecision(existingAggregate.approval, requestedApproval!)) {
                return { status: "decision_conflict" as const };
              }
              return publish(existingAggregate);
            }

            const legacy = await resolveLegacyDecision(
              scope,
              actor,
              requestedApproval!,
              linkedCaseId,
              transactionalQueryable
            );
            if (legacy.status === "conflict") return { status: "legacy_conflict" as const };
            if (legacy.status === "aggregate") {
              return publish(legacy.aggregate);
            }

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
              const lateLegacy = await resolveLegacyDecision(
                scope,
                actor,
                requestedApproval!,
                linkedCaseId,
                transactionalQueryable
              );
              return lateLegacy.status === "aggregate"
                ? publish(lateLegacy.aggregate)
                : { status: "legacy_conflict" as const };
            }
            if (!await decisionPublicationPreflight(
              actor,
              scope,
              linkedCaseId,
              candidateAggregate,
              transactionalQueryable
            )) {
              return { status: "audit_conflict" as const };
            }
            if (!(await stageDecisionProjections(scope, candidateAggregate))) {
              const lateLegacy = await resolveLegacyDecision(
                scope,
                actor,
                requestedApproval!,
                linkedCaseId,
                transactionalQueryable
              );
              return lateLegacy.status === "aggregate"
                ? publish(lateLegacy.aggregate)
                : { status: "legacy_conflict" as const };
            }
              const finalAggregate = await claimAggregate(scope, candidateAggregate, requestedApproval!);
              if (!finalAggregate) return { status: "decision_conflict" as const };
              return publish(finalAggregate);
            } catch (error) {
              if (!transactionalQueryable) await compensateOfferAudits(publicationHolder);
              throw error;
            }
            }, [{ kind: "offer_case", artifactId: linkedCaseId, revision: 0 }]
          );
        } catch (error) {
          if (error instanceof OfferPublicationConflictError) {
            return reply.code(409).send({ message: error.message });
          }
          throw error;
        }

        if (resolution.status === "case_timeline_conflict") {
          return reply.code(409).send({ message: "Der Angebotsentwurf ist nicht mehr der aktuelle Case-Timeline-Zustand." });
        }
        if (resolution.status === "aggregate") {
          return sendAggregateResponse(actor, resolution.aggregate, reply, resolution.published === true);
        }
        if (resolution.status === "projection_conflict") {
          return reply.code(409).send({ message: "Freigegebene Angebotsprojektion stimmt nicht mit der autoritativen Entscheidung überein." });
        }
        if (resolution.status === "audit_conflict") {
          return reply.code(409).send({ message: "Entscheidungs-Audit stimmt nicht mit der autoritativen Entscheidung überein." });
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
    const approvedOffer = aggregate.approvedOffer!;
    const handoffCaseId = await store.findCaseIdForDraft(
      actor,
      approvedOffer.sourceDraft.draftId,
      approvedOffer.sourceDraft.revision
    );
    if (!handoffCaseId) {
      return reply.code(409).send({ message: "Freigegebenes Angebot besitzt keine exakt passende Case-Timeline-Projektion." });
    }
    const handoff = handoffForApprovedOffer(actor, approvedOffer);
    let resolution: HandoffResolution;
    try {
      resolution = await decisionRepository.withTargetCriticalSection(
        actor,
        aggregate.approval.target,
        async (scope, transactionalQueryable) => {
          const publicationHolder: OfferAuditPublicationHolder = { publications: [] };
          let createdHandoff: ProductionHandoff | undefined;
          let createdResultEvent: CaseEvent | undefined;
          let fileCompensationComplete = false;
          const compensateHandoffPublication = async (): Promise<void> => {
            if (fileCompensationComplete) return;
            if (createdResultEvent) {
              const result = await scope.deleteCaseEventIfExact(createdResultEvent);
              if (result === "conflict") {
                throw new Error("Das Handoff-Ereignis konnte nach einer unterbrochenen Veröffentlichung nicht sicher zurückgebaut werden.");
              }
            }
            if (createdHandoff) {
              const result = await scope.deleteHandoffIfExact(createdHandoff);
              if (result === "conflict") {
                throw new Error("Die Produktionsübergabe konnte nach einer unterbrochenen Veröffentlichung nicht sicher zurückgebaut werden.");
              }
            }
            await compensateOfferAudits(publicationHolder);
            fileCompensationComplete = true;
          };
          const lateConflict = <T extends "projection_conflict" | "handoff_conflict" | "case_conflict">(
            status: T,
            message: string
          ): Promise<{ status: T }> => {
            if (transactionalQueryable) throw new OfferPublicationConflictError(message);
            return compensateHandoffPublication().then(() => ({ status }));
          };
          try {
            const caseEvents = await scope.listCaseEvents(handoffCaseId);
            const timelineError = offerDraftTimelineError(
              caseEvents,
              approvedOffer.sourceDraft.draftId,
              approvedOffer.sourceDraft.revision
            );
            if (timelineError) return { status: "timeline_conflict" as const };
            const currentCase = await scope.getCase(handoffCaseId);
            if (!currentCase) return { status: "case_conflict" as const };
            if (currentCase.productionHandoffId && currentCase.productionHandoffId !== handoff.handoffId) {
              return { status: "case_conflict" as const };
            }
            if (currentCase.approvedOfferId && currentCase.approvedOfferId !== approvedOffer.approvedOfferId) {
              return { status: "case_conflict" as const };
            }

            // All deterministic conflicts are checked before the first write. The held Case
            // scope makes these snapshots stable for both File and PostgreSQL backends.
            const existingHandoff = await scope.getHandoff(handoff.handoffId);
            if (existingHandoff && !areJsonValuesEqual(existingHandoff, handoff)) {
              return { status: "handoff_conflict" as const };
            }
            const resultEventId = `offer-case-event-${createHash("sha256")
              .update(`${actor.businessId}\0${handoffCaseId}\0result\0${handoff.handoffId}`)
              .digest("hex")}`;
            const resultMatches = caseEvents.filter(
              (event) => event.eventId === resultEventId
                || (event.kind === "result" && event.artifactId === handoff.handoffId)
            );
            if (resultMatches.length > 1) {
              return { status: "handoff_conflict" as const };
            }
            const existingResult = resultMatches[0];
            if (existingResult) {
              const expectedResult = {
                businessId: actor.businessId,
                eventId: resultEventId,
                caseId: handoffCaseId,
                sequence: existingResult.sequence,
                at: handoff.createdAt,
                role: "system" as const,
                kind: "result" as const,
                text: "Angebot an die Produktion übergeben.",
                artifactId: handoff.handoffId
              } satisfies CaseEvent;
              if (!areJsonValuesEqual(existingResult, expectedResult)) {
                return { status: "handoff_conflict" as const };
              }
            }

            const handoffAudit = await prepareOfferAudit(
              actor,
              handoffAuditInput(actor, handoff, approvedOffer.approvedOfferId),
              transactionalQueryable,
              publicationHolder
            );
            if (handoffAudit === "conflict") return { status: "handoff_conflict" as const };
            const projection = await projectDecisionAggregate(
              actor,
              aggregate,
              scope,
              transactionalQueryable,
              publicationHolder
            );
            if (projection !== "ok") {
              if (transactionalQueryable) {
                throw new OfferPublicationConflictError(
                  "Freigegebene Angebotsprojektion stimmt nicht mit der autoritativen Entscheidung überein."
                );
              }
              await compensateHandoffPublication();
              return { status: "projection_conflict" as const };
            }
            const inserted = await scope.insertHandoff(handoff);
            if (inserted === "created") createdHandoff = handoff;
            if (inserted === "exists") {
              const existing = await scope.getHandoff(handoff.handoffId);
              if (!existing || !areJsonValuesEqual(existing, handoff)) {
                return lateConflict(
                  "handoff_conflict",
                  "Produktionsübergabe stimmt nicht mit der autoritativen Freigabeevidenz überein."
                );
              }
            }
            const resultEvent = await scope.appendCaseEvent(handoffCaseId, {
              at: handoff.createdAt,
              role: "system",
              kind: "result",
              text: "Angebot an die Produktion übergeben.",
              artifactId: handoff.handoffId
            }, handoff.handoffId);
            if (!existingResult) createdResultEvent = resultEvent;
            if (currentCase.productionHandoffId !== handoff.handoffId || currentCase.status !== "completed") {
              const updated = await scope.compareAndSetCase(handoffCaseId, currentCase.version, {
                ...currentCase,
                approvedOfferId: approvedOffer.approvedOfferId,
                productionHandoffId: handoff.handoffId,
                status: "completed",
                version: currentCase.version + 1,
                updatedAt: handoff.createdAt > currentCase.updatedAt ? handoff.createdAt : currentCase.updatedAt
              });
              if (updated !== "updated") {
                return lateConflict(
                  "case_conflict",
                  "Angebotsauftrag konnte nicht atomar mit der Produktionsübergabe verknüpft werden."
                );
              }
            }
            void resultEvent;
            return { status: "ok" as const };
          } catch (error) {
            if (!transactionalQueryable) await compensateHandoffPublication();
            throw error;
          }
        },
        [{ kind: "offer_case", artifactId: handoffCaseId, revision: 0 }]
      );
    } catch (error) {
      if (error instanceof OfferPublicationConflictError) {
        return reply.code(409).send({ message: error.message });
      }
      throw error;
    }
    if (resolution.status === "timeline_conflict") {
      return reply.code(409).send({ message: "Produktionsübergabe ist nicht mehr der aktuelle Case-Timeline-Zustand." });
    }
    if (resolution.status !== "ok") {
      return reply.code(409).send({ message: "Produktionsübergabe stimmt nicht mit der autoritativen Freigabeevidenz überein." });
    }
    return reply.code(201).send({ handoff });
  });

  app.get<{ Params: { handoffId: string } }>("/v1/offers/handoffs/:handoffId", async (request, reply) => {
    const forbidden = requireHandoffReader(request, reply);
    if (forbidden) return forbidden;
    const actor = actorForRequest(request);
    const handoff = await store.getHandoff(actor, request.params.handoffId);
    if (!handoff) return reply.code(404).send({ message: "Produktionsübergabe nicht gefunden." });
    const handoffCaseId = await store.findCaseIdForDraft(
      actor,
      handoff.source.draftId,
      handoff.source.revision
    );
    if (!handoffCaseId) {
      return reply.code(409).send({ message: "Produktionsübergabe besitzt keine exakt passende Case-Timeline-Projektion." });
    }

    // Keep the cheap lookup outside the lock, then repeat every mutable authority check inside the
    // same OfferCase scope used by continuation writers.  A continuation may win after this
    // preflight; in that case the locked check rejects the stale handoff before any recovery write.
    const handoffTimelineError = await store.currentDraftTimelineError(
      actor,
      handoffCaseId,
      handoff.source.draftId,
      handoff.source.revision
    );
    const currentCase = await store.getCase(actor, handoffCaseId);
    if (handoffTimelineError || currentCase?.productionHandoffId !== handoff.handoffId) {
      return reply.code(409).send({ message: "Produktionsübergabe ist nicht mehr der aktuelle Case-Timeline-Zustand." });
    }
    const aggregates = await decisionRepository.listDecisionAggregatesForApprovedOffer(actor, handoff.approvedOfferId);
    if (aggregates.length !== 1 || !aggregates[0]?.approvedOffer) {
      return reply.code(409).send({ message: "Produktionsübergabe stimmt nicht mit der autoritativen Freigabeevidenz überein." });
    }
    const aggregate = aggregates[0]!;
    let resolution:
      | { status: "ok"; handoff: ProductionHandoff }
      | { status: "conflict" };
    try {
      resolution = await decisionRepository.withTargetCriticalSection(
        actor,
        aggregate.approval.target,
        async (scope, transactionalQueryable) => {
          const caseEvents = await scope.listCaseEvents(handoffCaseId);
          const timelineError = offerDraftTimelineError(
            caseEvents,
            handoff.source.draftId,
            handoff.source.revision
          );
          const lockedCase = await scope.getCase(handoffCaseId);
          if (
            timelineError
            || !lockedCase
            || lockedCase.status !== "completed"
            || lockedCase.approvedOfferId !== aggregate.approvedOffer!.approvedOfferId
            || lockedCase.productionHandoffId !== handoff.handoffId
          ) {
            return { status: "conflict" as const };
          }

          const lockedHandoff = await scope.getHandoff(handoff.handoffId);
          if (
            !lockedHandoff
            || lockedHandoff.approvedOfferId !== aggregate.approvedOffer!.approvedOfferId
            || !areJsonValuesEqual(lockedHandoff, handoff)
          ) {
            return { status: "conflict" as const };
          }

          const expected = handoffForApprovedOffer(actor, aggregate.approvedOffer!);
          if (!areJsonValuesEqual(expected, lockedHandoff)) {
            return { status: "conflict" as const };
          }

          const publicationHolder: OfferAuditPublicationHolder = { publications: [] };
          const projection = await projectDecisionAggregate(
            actor,
            aggregate,
            scope,
            transactionalQueryable,
            publicationHolder
          );
          if (projection !== "ok") return { status: "conflict" as const };
          return { status: "ok" as const, handoff: expected };
        },
        [{ kind: "offer_case", artifactId: handoffCaseId, revision: 0 }]
      );
    } catch (error) {
      if (error instanceof OfferPublicationConflictError) {
        return reply.code(409).send({ message: "Produktionsübergabe stimmt nicht mit der autoritativen Freigabeevidenz überein." });
      }
      throw error;
    }
    if (resolution.status !== "ok") {
      return reply.code(409).send({ message: "Produktionsübergabe stimmt nicht mit der autoritativen Freigabeevidenz überein." });
    }
    return reply.send({ handoff: resolution.handoff });
  });
}
