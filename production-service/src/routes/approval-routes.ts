import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  createApprovedProductionSpec,
  createApprovalRequestRecord,
  createProductionApplyManifest,
  validateProductionDraft,
  type ApprovedProductionSpec,
  type AcceptedEventSpec,
  type ApprovalRequestRecord,
  type AuditLogStore,
  type BusinessContext,
  type ProductionHandoff,
  type ProductionDraft,
  type ProductionApplyManifest,
  type TrustedActor
} from "@catering/shared-core";
import type { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";
import {
  productionDecisionRepositoryFor,
  type ProductionStore,
  type ProductionCaseApplyScope
} from "../repositories/production-store.js";
import type { ProductionDecisionTargetScope } from "../repositories/production-decision-repository.js";
import type { IntakeRecordsPort } from "../ports/intake-records-port.js";
import type { ProductionHandoffReader } from "../ports/production-handoff-reader.js";
import {
  productionDecidedDraftFor,
  validateProductionDecisionAggregate,
  type ProductionDecisionAggregate
} from "../production-decision-aggregate.js";

export type ProductionDecisionFaultPhase = "after_approval_insert";
export type ProductionApplyFaultPhase =
  | "after_event_spec_write"
  | "after_plan_write"
  | "after_purchase_list_write"
  | "after_recipe_write"
  | "before_manifest_publish";

export interface ProductionApprovalRouteDependencies {
  store: ProductionStore;
  intakeRecords: IntakeRecordsPort;
  handoffReader?: ProductionHandoffReader;
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

function manifestMatchesApprovedSpec(
  manifest: ProductionApplyManifest,
  approvedProductionSpec: ApprovedProductionSpec
): boolean {
  const appliedAt = new Date(manifest.appliedAt);
  if (Number.isNaN(appliedAt.getTime())) return false;

  try {
    const expected = createProductionApplyManifest({
      approvedProductionSpec,
      actor: {
        businessId: manifest.businessId,
        name: manifest.appliedBy.name,
        source: manifest.appliedBy.source
      },
      appliedAt
    });
    return areJsonValuesEqual(manifest, expected);
  } catch {
    return false;
  }
}

interface CompareOrInsertResult {
  conflict?: string;
  created: boolean;
}

async function compareOrInsert<T>(input: {
  get: () => Promise<T | undefined>;
  insert: () => Promise<"created" | "exists">;
  expected: T;
  label: string;
}): Promise<CompareOrInsertResult> {
  const existing = await input.get();
  if (existing) {
    return {
      created: false,
      ...(areJsonValuesEqual(existing, input.expected)
        ? {}
        : { conflict: `${input.label} existiert bereits mit abweichendem Inhalt.` })
    };
  }
  const insertion = await input.insert();
  const observed = await input.get();
  return {
    created: insertion === "created",
    ...(areJsonValuesEqual(observed, input.expected)
      ? {}
      : { conflict: `${input.label} konnte nicht konfliktfrei veröffentlicht werden.` })
  };
}

async function existingArtifactConflict<T>(input: {
  get: () => Promise<T | undefined>;
  expected: T;
  label: string;
}): Promise<string | undefined> {
  const existing = await input.get();
  return existing && !areJsonValuesEqual(existing, input.expected)
    ? `${input.label} existiert bereits mit abweichendem Inhalt.`
    : undefined;
}

function productionDecisionSnapshot(spec: AcceptedEventSpec): Array<{
  componentId: string;
  productionDecision: AcceptedEventSpec["menuPlan"][number]["productionDecision"];
}> {
  return spec.menuPlan
    .map((component) => ({
      componentId: component.componentId,
      productionDecision: component.productionDecision
    }))
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
}

function acceptedEventSpecConsistencyError(
  canonical: AcceptedEventSpec | undefined,
  candidate: AcceptedEventSpec
): string | undefined {
  if (!canonical) return `AcceptedEventSpec ${candidate.specId} fehlt im autoritativen Intake.`;
  if (canonical.specId !== candidate.specId) {
    return `AcceptedEventSpec ${candidate.specId} referenziert eine unzulässige Identität.`;
  }
  if (!areJsonValuesEqual(canonical.sourceLineage, candidate.sourceLineage)) {
    return `AcceptedEventSpec ${candidate.specId} besitzt eine inkonsistente sourceLineage.`;
  }
  if (!areJsonValuesEqual(productionDecisionSnapshot(canonical), productionDecisionSnapshot(candidate))) {
    return `AcceptedEventSpec ${candidate.specId} besitzt inkonsistente Produktionsentscheidungen.`;
  }
  return undefined;
}

async function approvedSnapshotConsistencyError(
  store: ProductionStore,
  actor: TrustedActor,
  approvedSpec: ApprovedProductionSpec
): Promise<string | undefined> {
  const aggregate = await productionDecisionRepositoryFor(store).getDecisionAggregate(
    actor,
    approvedSpec.approvalRequestId
  );
  if (!aggregate?.approvedProductionSpec || !areJsonValuesEqual(aggregate.approvedProductionSpec, approvedSpec)) {
    return "ApprovedProductionSpec stimmt nicht mit der persistierten Freigabeevidenz überein.";
  }
  return undefined;
}

function offerHandoffIdFor(sourceRef: string | undefined): string | undefined {
  const prefix = "offer-handoff:";
  if (!sourceRef?.startsWith(prefix)) return undefined;
  const handoffId = sourceRef.slice(prefix.length).trim();
  return handoffId.length > 0 ? handoffId : undefined;
}

function reviewDecisionEventText(decision: ProductionDraft["reviewCards"][number]["decision"]): string {
  const decisionLabel = {
    pending: "Offen",
    fits: "Passt",
    change_requested: "Änderung nötig",
    unclear: "Unklar",
    blocked: "Blockiert"
  }[decision];
  return `Prüfpunkt als „${decisionLabel}“ bewertet.`;
}

async function canonicalDraftTimelineError(
  store: ProductionStore,
  actor: TrustedActor,
  draft: ProductionDraft
): Promise<string | undefined> {
  const lineage: ProductionDraft[] = [];
  const seen = new Set<string>();
  let current: ProductionDraft | undefined = draft;
  while (current) {
    if (seen.has(current.draftId) || lineage.length >= 100) {
      return "ProductionDraft-Lineage ist nicht vollständig oder nicht eindeutig projiziert.";
    }
    seen.add(current.draftId);
    lineage.push(current);
    const predecessorId = current.supersedesDraftId;
    if (!predecessorId) break;
    current = await store.getProductionDraft(actor, predecessorId);
    if (!current) {
      return "ProductionDraft-Lineage ist nicht vollständig oder nicht eindeutig projiziert.";
    }
  }
  const root = lineage.at(-1);
  const handoffId = offerHandoffIdFor(root?.source.sourceRef);
  if (!handoffId) return undefined;
  const caseIds = new Set<string>();
  for (const candidate of lineage) {
    const caseId = await store.findCaseIdForArtifact(actor, candidate.draftId);
    if (caseId) caseIds.add(caseId);
  }
  if (caseIds.size !== 1) {
    return "ProductionDraft ist nicht exakt an die kanonische Offer-/Handoff-Case-Identität gebunden.";
  }
  const caseId = [...caseIds][0]!;
  const productionCase = await store.getCase(actor, caseId);
  if (
    !productionCase ||
    productionCase.productionHandoffId !== handoffId ||
    productionCase.sourceSpecId !== root?.draftArtifacts.eventSpec?.specId
  ) {
    return "ProductionDraft ist nicht exakt an die kanonische Offer-/Handoff-Case-Identität gebunden.";
  }
  const events = await store.listEvents(actor, caseId);
  for (const candidate of lineage) {
    const direct = events.some((event) => {
      const revisionRef = event.revisionRef;
      if (candidate.supersedesDraftId) {
        return event.kind === "revision_created" &&
          revisionRef?.artifactType === "ProductionDraft" &&
          revisionRef.artifactId === candidate.draftId &&
          revisionRef.revision === candidate.revision &&
          revisionRef.createdAt === candidate.createdAt &&
          revisionRef.supersedesArtifactId === candidate.supersedesDraftId;
      }
      return event.kind === "draft_created" &&
        event.artifactId === candidate.draftId &&
        revisionRef?.artifactType === "ProductionDraft" &&
        revisionRef.artifactId === candidate.draftId &&
        revisionRef.revision === candidate.revision &&
        revisionRef.createdAt === candidate.createdAt;
    });
    if (!direct) {
      return "ProductionDraft besitzt keine direkte kanonische Case-Timeline-Projektion.";
    }
  }
  return undefined;
}

async function canonicalReviewProjectionError(
  store: ProductionStore,
  actor: TrustedActor,
  draft: ProductionDraft,
  caseId: string
): Promise<string | undefined> {
  const valid = await store.withPlanningEvidenceCriticalSection(
    actor,
    caseId,
    draft.draftId,
    draft.revision,
    async (scope) => {
      const current = await scope.getDraft(draft.draftId);
      if (!current || !areJsonValuesEqual(current, draft)) return false;
      const lineage: ProductionDraft[] = [];
      const seen = new Set<string>();
      let lineageDraft: ProductionDraft | undefined = current;
      while (lineageDraft) {
        if (seen.has(lineageDraft.draftId) || lineage.length >= 100) return false;
        seen.add(lineageDraft.draftId);
        lineage.push(lineageDraft);
        const predecessorId = lineageDraft.supersedesDraftId;
        if (!predecessorId) break;
        lineageDraft = await scope.getDraft(predecessorId);
        if (!lineageDraft) return false;
      }
      for (const candidate of lineage) {
        for (const card of candidate.reviewCards) {
          if (!card.decidedAt) {
            if (card.decision !== "pending") return false;
            continue;
          }
          if (!await scope.hasReviewDecisionEvent(
            candidate.draftId,
            card.cardId,
            card.decidedAt,
            reviewDecisionEventText(card.decision)
          )) return false;
        }
      }
      return true;
    }
  );
  return valid
    ? undefined
    : "ProductionDraft besitzt nicht für jede persistierte Review-Entscheidung ein kanonisches Case-Ereignis.";
}

async function canonicalReviewProjectionErrorAtDecisionScope(
  actor: TrustedActor,
  scope: Pick<ProductionDecisionTargetScope, "getDraft" | "getCaseEvent">,
  expectedCurrent: ProductionDraft,
  reviewSource: ProductionDraft,
  caseId: string,
  persistedCurrent?: ProductionDraft
): Promise<string | undefined> {
  const current = persistedCurrent ?? await scope.getDraft(expectedCurrent.draftId);
  if (
    expectedCurrent.draftId !== reviewSource.draftId ||
    expectedCurrent.revision !== reviewSource.revision ||
    !current ||
    !areJsonValuesEqual(current, expectedCurrent)
  ) {
    return "ProductionDraft wurde während der Freigabe verändert oder entschieden.";
  }
  const lineage: ProductionDraft[] = [];
  const seen = new Set<string>();
  let lineageDraft: ProductionDraft | undefined = reviewSource;
  while (lineageDraft) {
    if (seen.has(lineageDraft.draftId) || lineage.length >= 100) {
      return "ProductionDraft-Lineage ist nicht vollständig oder nicht eindeutig projiziert.";
    }
    seen.add(lineageDraft.draftId);
    lineage.push(lineageDraft);
    const predecessorId = lineageDraft.supersedesDraftId;
    if (!predecessorId) break;
    lineageDraft = await scope.getDraft(predecessorId);
    if (!lineageDraft) {
      return "ProductionDraft-Lineage ist nicht vollständig oder nicht eindeutig projiziert.";
    }
  }
  for (const candidate of lineage) {
    for (const card of candidate.reviewCards) {
      if (!card.decidedAt) {
        if (card.decision !== "pending") {
          return "ProductionDraft besitzt nicht für jede persistierte Review-Entscheidung ein kanonisches Case-Ereignis.";
        }
        continue;
      }
      const eventIdentity = `review:${candidate.draftId}:${card.cardId}:${card.decidedAt}`;
      const eventId = `production-case-event-${createHash("sha256")
        .update(`${actor.businessId}\0${caseId}\0review_decision\0${eventIdentity}`)
        .digest("hex")}`;
      const event = await scope.getCaseEvent(eventId);
      if (
        !event ||
        event.caseId !== caseId ||
        event.kind !== "review_decision" ||
        event.artifactId !== candidate.draftId ||
        event.at !== card.decidedAt ||
        event.role !== "user" ||
        event.text !== reviewDecisionEventText(card.decision)
      ) {
        return "ProductionDraft besitzt nicht für jede persistierte Review-Entscheidung ein kanonisches Case-Ereignis.";
      }
    }
  }
  return undefined;
}

async function canonicalDecisionContinuationErrorAtDecisionScope(
  scope: Pick<ProductionDecisionTargetScope, "listCaseEvents">,
  caseId: string,
  aggregate: ProductionDecisionAggregate
): Promise<string | undefined> {
  const target = aggregate.approval.target;
  const latestDraftEvent = (await scope.listCaseEvents(caseId))
    .filter((event) => event.kind === "draft_created" || event.kind === "revision_created")
    .sort((left, right) => right.sequence - left.sequence)[0];
  const revisionRef = latestDraftEvent?.revisionRef;
  const expectedSupersedes = aggregate.decidedDraft.supersedesDraftId;
  const directEventMatches = expectedSupersedes
    ? latestDraftEvent?.kind === "revision_created" && revisionRef?.supersedesArtifactId === expectedSupersedes
    : latestDraftEvent?.kind === "draft_created" && revisionRef?.supersedesArtifactId === undefined;
  if (
    target.kind !== "production_draft" ||
    target.artifactId !== aggregate.decidedDraft.draftId ||
    target.revision !== aggregate.decidedDraft.revision ||
    !latestDraftEvent ||
    latestDraftEvent.artifactId !== aggregate.decidedDraft.draftId ||
    !directEventMatches ||
    revisionRef?.artifactType !== "ProductionDraft" ||
    revisionRef.artifactId !== aggregate.decidedDraft.draftId ||
    revisionRef.revision !== aggregate.decidedDraft.revision ||
    revisionRef.createdAt !== aggregate.decidedDraft.createdAt
  ) {
    return "ProductionDraft wurde nach der Freigabe fortgesetzt.";
  }
  return undefined;
}

async function handoffSnapshotConsistencyError(
  store: ProductionStore,
  handoffReader: ProductionHandoffReader | undefined,
  actor: TrustedActor,
  approvedSpec: ApprovedProductionSpec
): Promise<string | undefined> {
  const sourceDraft = await store.getProductionDraft(actor, approvedSpec.sourceDraft.draftId);
  const sourceRefHandoffId = offerHandoffIdFor(sourceDraft?.source.sourceRef);
  const linkedCaseId = await store.findCaseIdForArtifact(actor, approvedSpec.sourceDraft.draftId);
  const linkedCase = linkedCaseId ? await store.getCase(actor, linkedCaseId) : undefined;
  const caseHandoffId = linkedCase?.productionHandoffId;
  if (!sourceRefHandoffId && !caseHandoffId) {
    return "Freigegebener Produktionssnapshot besitzt keine gültige Offer-/Handoff-Evidenz.";
  }
  // The mutable draft may only corroborate the immutable case linkage; it
  // must never choose a different Handoff identity for Apply.
  if (
    sourceRefHandoffId !== caseHandoffId ||
    !linkedCase?.productionHandoffId
  ) {
    return "Freigegebener Produktionssnapshot besitzt keine gültige Offer-/Handoff-Evidenz.";
  }
  if (!handoffReader) return "Freigegebener Produktionssnapshot besitzt keine lesbare Offer-/Handoff-Evidenz.";

  let handoff: ProductionHandoff | undefined;
  try {
    handoff = await handoffReader.get(actor, caseHandoffId!);
  } catch {
    return "Freigegebener Produktionssnapshot konnte nicht gegen den persistierten Offer-/Handoff-Snapshot geprüft werden.";
  }
  if (
    !handoff ||
    handoff.businessId !== actor.businessId ||
    handoff.handoffId !== caseHandoffId ||
    !handoff.approvedOfferId?.trim() ||
    !handoff.approvalRequestId?.trim() ||
    !handoff.source.draftId?.trim() ||
    !Number.isInteger(handoff.source.revision) ||
    !handoff.source.selectedVariantId?.trim()
  ) {
    return "Freigegebener Produktionssnapshot besitzt keine gültige Offer-/Handoff-Evidenz.";
  }
  if (!areJsonValuesEqual(handoff.eventSpecSnapshot, approvedSpec.artifacts.eventSpec)) {
    return "Freigegebener Produktionssnapshot weicht vom persistierten Offer-/Handoff-Snapshot ab.";
  }
  const pricingSummary = approvedSpec.artifacts.eventSpec.budgetContext?.pricingSummary;
  if (!pricingSummary || !areJsonValuesEqual(handoff.pricingSnapshot, pricingSummary)) {
    return "Freigegebener Produktionssnapshot besitzt eine inkonsistente Offer-Preisgrundlage.";
  }
  return undefined;
}

async function productionCaseApplyConsistencyError(
  store: ProductionStore,
  actor: TrustedActor,
  currentCase: Awaited<ReturnType<ProductionStore["getCase"]>>,
  approvedSpec: ApprovedProductionSpec,
  scope?: ProductionCaseApplyScope
): Promise<string | undefined> {
  if (!currentCase || currentCase.approvedProductionSpecId !== approvedSpec.approvedProductionSpecId) {
    return "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  }
  if (currentCase.status === "archived") {
    return "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  }

  const events = scope
    ? await scope.listEvents(currentCase.caseId)
    : await store.listEvents(actor, currentCase.caseId);
  const latestDraftEvent = events
    .filter((event) => event.kind === "draft_created" || event.kind === "revision_created")
    .sort((left, right) => right.sequence - left.sequence)[0];
  const approvalEvent = events
    .filter((event) => event.kind === "approval" && event.artifactId === approvedSpec.approvedProductionSpecId)
    .sort((left, right) => right.sequence - left.sequence)[0];
  if (
    !latestDraftEvent ||
    latestDraftEvent.artifactId !== approvedSpec.sourceDraft.draftId ||
    !approvalEvent ||
    approvalEvent.sequence <= latestDraftEvent.sequence
  ) {
    return "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  }
  return undefined;
}

async function updateLinkedProductionCase(
  store: ProductionStore,
  actor: TrustedActor,
  sourceDraftId: string,
  update: {
    approvedProductionSpecId?: string;
    currentPlanId?: string;
    currentPurchaseListId?: string;
    status?: "open" | "completed";
  }
): Promise<void> {
  const caseId = await store.findCaseIdForArtifact(actor, sourceDraftId);
  if (!caseId) return;
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
      updatedAt: new Date().toISOString()
    });
    if (result === "updated" || result === "missing") return;
  }
  throw new Error("Produktionsauftrag wurde gleichzeitig zu oft verändert.");
}

async function appendProductionDecisionEvents(
  store: ProductionStore,
  actor: TrustedActor,
  aggregate: ProductionDecisionAggregate
): Promise<void> {
  const { approval, sourceDraft, approvedProductionSpec } = aggregate;
  await store.appendEventForArtifactCase(actor, sourceDraft.draftId, {
    at: approval.decidedAt,
    role: "user",
    kind: "review_decision",
    text: approval.decision === "approved"
      ? "Produktionsentwurf freigegeben."
      : "Produktionsentwurf abgelehnt.",
    artifactId: approval.approvalRequestId
  });
  if (!approvedProductionSpec) return;
  await updateLinkedProductionCase(store, actor, sourceDraft.draftId, {
    approvedProductionSpecId: approvedProductionSpec.approvedProductionSpecId
  });
  await store.appendEventForArtifactCase(actor, sourceDraft.draftId, {
    at: approval.decidedAt,
    role: "system",
    kind: "approval",
    text: "Produktionssnapshot freigegeben.",
    artifactId: approvedProductionSpec.approvedProductionSpecId
  });
}

export function registerProductionApprovalRoutes(
  app: FastifyInstance,
  deps: ProductionApprovalRouteDependencies
): void {
  const {
    store,
    intakeRecords,
    handoffReader,
    repository,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    requireProductionOperator,
    actorForRequest,
    decisionFaultInjector,
    applyFaultInjector
  } = deps;
  const decisionRepository = productionDecisionRepositoryFor(store);

  const projectDecisionAggregate = async (
    scope: ProductionDecisionTargetScope,
    aggregate: ProductionDecisionAggregate
  ) => {
    const approval = aggregate.approval;
    const existingApproval = await scope.getApproval(approval.approvalRequestId);
    if (existingApproval && !areJsonValuesEqual(existingApproval, approval)) {
      throw new Error("Freigabeprojektion weicht von der autoritativen Produktionsentscheidung ab.");
    }
    if (!existingApproval) {
      await scope.insertApproval(approval);
      decisionFaultInjector?.("after_approval_insert");
    }

    if (aggregate.approvedProductionSpec) {
      const expectedSpec = aggregate.approvedProductionSpec;
      const existingSpec = await scope.getApprovedProductionSpec(expectedSpec.approvedProductionSpecId);
      if (existingSpec && !areJsonValuesEqual(existingSpec, expectedSpec)) {
        throw new Error("Freigegebener Produktionssnapshot weicht von der autoritativen Entscheidung ab.");
      }
      if (!existingSpec) await scope.insertApprovedProductionSpec(expectedSpec);
    }
    await scope.setDraft(aggregate.decidedDraft);
  };

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
    const aggregateCandidates = await decisionRepository.listDecisionAggregatesForDraft(
      actor,
      request.params.draftId
    );
    if (aggregateCandidates.length > 1) {
      return reply.code(409).send({ message: "ProductionDraft besitzt konkurrierende autoritative Entscheidungen." });
    }
    const existingAggregate = aggregateCandidates[0];
    const observedDraft = existingAggregate
      ? existingAggregate.decidedDraft
      : await store.getProductionDraft(actor, request.params.draftId);
    if (!observedDraft) return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
    const canonicalTimelineError = await canonicalDraftTimelineError(store, actor, observedDraft);
    if (canonicalTimelineError) {
      return reply.code(409).send({ message: canonicalTimelineError });
    }
    const linkedCaseId = await store.findCaseIdForArtifact(actor, observedDraft.draftId);
    const linkedCase = linkedCaseId ? await store.getCase(actor, linkedCaseId) : undefined;
    if (!existingAggregate && linkedCaseId && linkedCase?.productionHandoffId) {
      const reviewProjectionError = await canonicalReviewProjectionError(
        store,
        actor,
        observedDraft,
        linkedCaseId
      );
      if (reviewProjectionError) {
        return reply.code(409).send({ message: reviewProjectionError });
      }
    }
    const target = existingAggregate?.approval.target ?? {
      kind: "production_draft" as const,
      artifactId: observedDraft.draftId,
      revision: observedDraft.revision
    };
    const requestedApproval = createApprovalRequestRecord({
      actor,
      role: "production_operator",
      target,
      decision: request.body.decision,
      ...(request.body.comment?.trim() ? { comment: request.body.comment.trim() } : {})
    });
    const resolution = await decisionRepository.withTargetCriticalSection(actor, target, async (scope) => {
      const persistedAggregate = await scope.getDecisionAggregate(requestedApproval.approvalRequestId);
      if (persistedAggregate) {
        validateProductionDecisionAggregate(persistedAggregate);
        if (!sameApproval(persistedAggregate.approval, requestedApproval)) {
          return { kind: "conflict" as const, message: "ProductionDraft-Revision wurde bereits anders entschieden." };
        }
        if (
          request.body.decision === "approved" &&
          persistedAggregate.approvedProductionSpec &&
          (
            persistedAggregate.approvedProductionSpec.artifacts.productionPlan.readiness.status === "insufficient" ||
            (persistedAggregate.approvedProductionSpec.artifacts.productionPlan.blockingIssues?.length ?? 0) > 0
          )
        ) {
          return {
            kind: "readiness_conflict" as const,
            errors: ["production readiness is insufficient"]
          };
        }
        if (linkedCaseId && linkedCase?.productionHandoffId) {
          const continuationError = await canonicalDecisionContinuationErrorAtDecisionScope(
            scope,
            linkedCaseId,
            persistedAggregate
          );
          if (continuationError) {
            return { kind: "conflict" as const, message: continuationError };
          }
          const persistedCurrent = await scope.getDraft(persistedAggregate.decidedDraft.draftId);
          if (
            !persistedCurrent ||
            (
              !areJsonValuesEqual(persistedCurrent, persistedAggregate.sourceDraft) &&
              !areJsonValuesEqual(persistedCurrent, persistedAggregate.decidedDraft)
            )
          ) {
            return { kind: "conflict" as const, message: "ProductionDraft wurde während der Freigabe verändert oder entschieden." };
          }
          const reviewProjectionError = await canonicalReviewProjectionErrorAtDecisionScope(
            actor,
            scope,
            persistedCurrent,
            persistedAggregate.sourceDraft,
            linkedCaseId,
            persistedCurrent
          );
          if (reviewProjectionError) {
            return { kind: "conflict" as const, message: reviewProjectionError };
          }
        }
        await projectDecisionAggregate(scope, persistedAggregate);
        return { kind: "decided" as const, aggregate: persistedAggregate };
      }

      const draft = await scope.getDraft(request.params.draftId);
      if (!draft) return { kind: "not_found" as const };
      if (draft.revision !== target.revision) {
        return { kind: "conflict" as const, message: "ProductionDraft-Revision wurde gleichzeitig verändert." };
      }
      if (linkedCaseId && linkedCase?.productionHandoffId) {
        const reviewProjectionError = await canonicalReviewProjectionErrorAtDecisionScope(
          actor,
          scope,
          draft,
          draft,
          linkedCaseId
        );
        if (reviewProjectionError) {
          return { kind: "conflict" as const, message: reviewProjectionError };
        }
      }
      const existingApprovals = await scope.listApprovalsForTarget();
      if (existingApprovals.length > 1) {
        return { kind: "conflict" as const, message: "Freigabeziel besitzt konkurrierende Entscheidungen." };
      }
      const existingApproval = existingApprovals[0];
      if (existingApproval && !sameApproval(existingApproval, requestedApproval)) {
        return { kind: "conflict" as const, message: "ProductionDraft-Revision wurde bereits anders entschieden." };
      }
      if (!existingApproval && draft.status !== "pending_review") {
        return { kind: "conflict" as const, message: "Nur ein pending_review ProductionDraft darf entschieden werden." };
      }
      if (existingApproval && draft.status !== "pending_review") {
        return { kind: "conflict" as const, message: "Persistierte Freigabeevidenz besitzt keinen unveränderten Quelldraft." };
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
        const planningInsufficient = productionPlan?.readiness.status === "insufficient" ||
          (productionPlan?.blockingIssues?.length ?? 0) > 0;
        if (unresolvedCards.length > 0 || incomplete) {
          return {
            kind: "unprocessable" as const,
            errors: [
              ...unresolvedCards.map((card) => `reviewCard ${card.cardId} is ${card.decision}`),
              ...(incomplete ? ["eventSpec, productionPlan, purchaseList und recipes müssen vollständig vorliegen"] : [])
            ]
          };
        }
        if (planningInsufficient) {
          return {
            kind: "readiness_conflict" as const,
            errors: ["production readiness is insufficient"]
          };
        }
      }

      const approval = existingApproval ?? requestedApproval;
      const aggregate = validateProductionDecisionAggregate({
        schemaVersion: "1.0",
        businessId: actor.businessId,
        sourceDraft: draft,
        approval,
        decidedDraft: productionDecidedDraftFor(draft, approval),
        ...(approval.decision === "approved"
          ? { approvedProductionSpec: createApprovedProductionSpec({ draft, approval }) }
          : {})
      });
      await scope.insertDecisionAggregate(aggregate);
      const authoritative = await scope.getDecisionAggregate(approval.approvalRequestId);
      if (!authoritative || !areJsonValuesEqual(authoritative, aggregate)) {
        return { kind: "conflict" as const, message: "Autoritative Produktionsentscheidung konnte nicht konfliktfrei gespeichert werden." };
      }
      await projectDecisionAggregate(scope, authoritative);
      return { kind: "decided" as const, aggregate: authoritative };
    }, linkedCaseId && linkedCase?.productionHandoffId ? linkedCaseId : undefined);

    if (resolution.kind === "not_found") {
      return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
    }
    if (resolution.kind === "conflict") {
      return reply.code(409).send({ message: resolution.message });
    }
    if (resolution.kind === "unprocessable") {
      return reply.code(422).send({
        message: "ProductionDraft-Snapshot ist noch nicht vollständig freigabefähig.",
        errors: resolution.errors
      });
    }
    if (resolution.kind === "readiness_conflict") {
      return reply.code(409).send({
        message: "ProductionDraft ist wegen unzureichender Produktionsbereitschaft nicht freigabefähig.",
        errors: resolution.errors
      });
    }

    const { aggregate } = resolution;
    const { approval } = aggregate;
    if (approval.decision === "rejected") {
      await auditLog.logFor(actor, {
        action: "production.production_draft_rejected",
        entityType: "ProductionDraft",
        entityId: aggregate.sourceDraft.draftId,
        actor,
        idempotencyKey: `production-decision:${approval.approvalRequestId}`,
        summary: "ProductionDraft nach Review verworfen.",
        details: {
          draftId: aggregate.sourceDraft.draftId,
          revision: aggregate.sourceDraft.revision,
          approvalRequestId: approval.approvalRequestId,
          writesProductObject: false
        }
      });
      await appendProductionDecisionEvents(store, actor, aggregate);
      return reply.code(201).send({ approval });
    }
    const approvedProductionSpec = aggregate.approvedProductionSpec!;
    await auditLog.logFor(actor, {
      action: "production.production_spec_approved",
      entityType: "ApprovedProductionSpec",
      entityId: approvedProductionSpec.approvedProductionSpecId,
      actor,
      idempotencyKey: `production-decision:${approvedProductionSpec.approvedProductionSpecId}`,
      summary: "Geprüfter Produktions-Snapshot unveränderlich freigegeben.",
      details: {
        draftId: aggregate.sourceDraft.draftId,
        revision: aggregate.sourceDraft.revision,
        approvalRequestId: approval.approvalRequestId,
        writesProductObject: false
      }
    });
    await appendProductionDecisionEvents(store, actor, aggregate);
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
      if (
        approvedSpec.artifacts.productionPlan.readiness.status === "insufficient" ||
        (approvedSpec.artifacts.productionPlan.blockingIssues?.length ?? 0) > 0
      ) {
        return reply.code(409).send({
          message: "ApprovedProductionSpec ist wegen unzureichender Produktionsbereitschaft nicht freigabefähig.",
          errors: ["production readiness is insufficient"]
        });
      }
      const snapshotConflict = await approvedSnapshotConsistencyError(store, actor, approvedSpec);
      if (snapshotConflict) {
        return reply.code(409).send({
          message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
          errors: [snapshotConflict]
        });
      }
      const handoffConflict = await handoffSnapshotConsistencyError(
        store,
        handoffReader,
        actor,
        approvedSpec
      );
      if (handoffConflict) {
        return reply.code(409).send({
          message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
          errors: [handoffConflict]
        });
      }

      const caseId = await store.findCaseIdForArtifact(actor, approvedSpec.sourceDraft.draftId);
      if (!caseId) {
        return reply.code(409).send({
          message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
          errors: ["ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag."]
        });
      }
      const applyResult = await store.withCaseApplyCriticalSection(actor, caseId, async (currentCase, applyScope) => {
        const caseConflict = await productionCaseApplyConsistencyError(store, actor, currentCase, approvedSpec, applyScope);
        if (caseConflict) {
          return reply.code(409).send({
            message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
            errors: [caseConflict]
          });
        }

        const aggregate = await applyScope.getDecisionAggregate(approvedSpec.approvalRequestId);
        if (
          !aggregate ||
          !aggregate.approvedProductionSpec ||
          !areJsonValuesEqual(aggregate.approvedProductionSpec, approvedSpec) ||
          aggregate.sourceDraft.draftId !== approvedSpec.sourceDraft.draftId ||
          aggregate.sourceDraft.revision !== approvedSpec.sourceDraft.revision
        ) {
          return reply.code(409).send({
            message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
            errors: ["ApprovedProductionSpec stimmt nicht mit der unveränderlichen Freigabeevidenz überein."]
          });
        }
        const currentDraft = await applyScope.getDraft(approvedSpec.sourceDraft.draftId);
        if (!currentDraft || !areJsonValuesEqual(currentDraft, aggregate.decidedDraft)) {
          return reply.code(409).send({
            message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
            errors: ["ProductionDraft stimmt nicht mit der unveränderlichen Freigabeevidenz überein."]
          });
        }
        const sourceRefHandoffId = offerHandoffIdFor(currentDraft?.source.sourceRef);
        if (sourceRefHandoffId && currentCase.productionHandoffId === sourceRefHandoffId) {
          const reviewProjectionError = await canonicalReviewProjectionErrorAtDecisionScope(
            actor,
            applyScope,
            aggregate.decidedDraft,
            aggregate.sourceDraft,
            caseId
          );
          if (reviewProjectionError) {
            return reply.code(409).send({
              message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
              errors: [reviewProjectionError]
            });
          }
        }

        const { eventSpec, productionPlan, purchaseList, recipes } = approvedSpec.artifacts;
      const conflicts: string[] = [];
      const createdPlans: typeof productionPlan[] = [];
      const createdPurchaseLists: typeof purchaseList[] = [];
      const createdRecipes: typeof recipes = [];
      let createdManifest: ProductionApplyManifest | undefined;
      const rollbackCreatedArtifacts = async (): Promise<void> => {
        const rollbackConflicts: string[] = [];
        for (const recipe of [...createdRecipes].reverse()) {
          const result = await repository.deleteIfExact(actor, recipe);
          if (result === "conflict") rollbackConflicts.push(`Recipe ${recipe.recipeId} konnte nicht sicher zurückgebaut werden.`);
        }
        for (const list of [...createdPurchaseLists].reverse()) {
          const result = await store.deletePurchaseListIfExact(actor, list);
          if (result === "conflict") rollbackConflicts.push(`PurchaseList ${list.purchaseListId} konnte nicht sicher zurückgebaut werden.`);
        }
        for (const plan of [...createdPlans].reverse()) {
          const result = await store.deletePlanIfExact(actor, plan);
          if (result === "conflict") rollbackConflicts.push(`ProductionPlan ${plan.planId} konnte nicht sicher zurückgebaut werden.`);
        }
        if (createdManifest) {
          const result = await store.deleteApplyManifestIfExact(actor, createdManifest);
          if (result === "conflict") rollbackConflicts.push("ProductionApplyManifest konnte nicht sicher zurückgebaut werden.");
        }
        conflicts.push(...rollbackConflicts);
      };
      const canonicalEventSpec = await intakeRecords.getSpec(actor, eventSpec.specId);
      const eventSpecConflict = acceptedEventSpecConsistencyError(
        canonicalEventSpec,
        eventSpec
      );
      if (eventSpecConflict) conflicts.push(eventSpecConflict);
      applyFaultInjector?.("after_event_spec_write");

      if (conflicts.length === 0 && canonicalEventSpec) {
        try {
          // The existing Intake replacement endpoint is a server-side exact CAS.
          // Passing the same snapshot as replacement performs a no-op while proving
          // that the canonical hash-equivalent payload did not drift since the read.
          const verified = await intakeRecords.replaceSpec(actor, canonicalEventSpec, canonicalEventSpec);
          if (verified !== "same_content") {
            conflicts.push("AcceptedEventSpec wurde zwischenzeitlich geändert.");
          }
        } catch {
          conflicts.push("AcceptedEventSpec wurde zwischenzeitlich geändert.");
        }
      }

      if (conflicts.length === 0) {
        const preflightConflicts = [
          await existingArtifactConflict({
            get: () => store.getPlan(actor, productionPlan.planId),
            expected: productionPlan,
            label: `ProductionPlan ${productionPlan.planId}`
          }),
          await existingArtifactConflict({
            get: () => store.getPurchaseList(actor, purchaseList.purchaseListId),
            expected: purchaseList,
            label: `PurchaseList ${purchaseList.purchaseListId}`
          }),
          ...(await Promise.all(recipes.map((recipe) => existingArtifactConflict({
            get: () => repository.get(actor, recipe.recipeId),
            expected: recipe,
            label: `Recipe ${recipe.recipeId}`
          }))))
        ].filter((conflict): conflict is string => Boolean(conflict));
        conflicts.push(...preflightConflicts);
      }

      if (conflicts.length === 0) {
        const result = await compareOrInsert({
          get: () => store.getPlan(actor, productionPlan.planId),
          insert: () => store.insertPlan(actor, productionPlan),
          expected: productionPlan,
          label: `ProductionPlan ${productionPlan.planId}`
        });
        if (result.conflict) conflicts.push(result.conflict);
        if (result.created) createdPlans.push(productionPlan);
      }
      applyFaultInjector?.("after_plan_write");

      if (conflicts.length === 0) {
        const result = await compareOrInsert({
          get: () => store.getPurchaseList(actor, purchaseList.purchaseListId),
          insert: () => store.insertPurchaseList(actor, purchaseList),
          expected: purchaseList,
          label: `PurchaseList ${purchaseList.purchaseListId}`
        });
        if (result.conflict) conflicts.push(result.conflict);
        if (result.created) createdPurchaseLists.push(purchaseList);
      }
      applyFaultInjector?.("after_purchase_list_write");

      for (const recipe of conflicts.length === 0 ? recipes : []) {
        const result = await compareOrInsert({
          get: () => repository.get(actor, recipe.recipeId),
          insert: () => repository.insert(actor, recipe),
          expected: recipe,
          label: `Recipe ${recipe.recipeId}`
        });
        if (result.conflict) {
          conflicts.push(result.conflict);
          break;
        }
        if (result.created) createdRecipes.push(recipe);
        applyFaultInjector?.("after_recipe_write");
      }

      if (conflicts.length > 0) {
        await rollbackCreatedArtifacts();
        return reply.code(409).send({
          message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
          errors: conflicts
        });
      }

      const candidateManifest = createProductionApplyManifest({
        approvedProductionSpec: approvedSpec,
        actor
      });
      const existingManifest = await store.getApplyManifest(actor, approvedSpec.approvedProductionSpecId);
      let expectedPersistedClaim = existingManifest;
      if (!existingManifest) {
        applyFaultInjector?.("before_manifest_publish");
        const insertResult = await store.insertApplyManifest(actor, candidateManifest);
        expectedPersistedClaim = insertResult === "created" ? candidateManifest : undefined;
        createdManifest = insertResult === "created" ? candidateManifest : undefined;
      }
      const authoritativeManifest = await store.getApplyManifest(actor, approvedSpec.approvedProductionSpecId);
      if (
        !authoritativeManifest ||
        !manifestMatchesApprovedSpec(authoritativeManifest, approvedSpec) ||
        (expectedPersistedClaim && !areJsonValuesEqual(authoritativeManifest, expectedPersistedClaim))
      ) {
        await rollbackCreatedArtifacts();
        return reply.code(409).send({ message: "ProductionApplyManifest konnte nicht konfliktfrei veröffentlicht werden." });
      }

      await auditLog.logFor({ businessId: authoritativeManifest.businessId }, {
        action: "production.approved_spec_applied",
        entityType: "ApprovedProductionSpec",
        entityId: approvedSpec.approvedProductionSpecId,
        actor: authoritativeManifest.appliedBy,
        at: authoritativeManifest.appliedAt,
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
      await updateLinkedProductionCase(store, actor, approvedSpec.sourceDraft.draftId, {
        approvedProductionSpecId: approvedSpec.approvedProductionSpecId,
        currentPlanId: productionPlan.planId,
        currentPurchaseListId: purchaseList.purchaseListId,
        status: "completed"
      });
      await store.appendEventForArtifactCaseWhileCaseLocked(actor, approvedSpec.sourceDraft.draftId, {
        at: authoritativeManifest.appliedAt,
        role: "system",
        kind: "result",
        text: "Produktionsplan und Einkaufsliste erstellt.",
        artifactId: productionPlan.planId
      });
      return reply.send({ eventSpec, plan: productionPlan, purchaseList, recipes });
      }, { draftId: approvedSpec.sourceDraft.draftId, revision: approvedSpec.sourceDraft.revision });
      return applyResult ?? reply.code(409).send({
        message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
        errors: ["ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag."]
      });
    }
  );
}
