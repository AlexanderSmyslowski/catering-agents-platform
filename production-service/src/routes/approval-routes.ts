import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  auditIdFor,
  AuditLogEntryConflictError,
  AuditLogPostPublishError,
  AuditLogStore,
  createApprovedProductionSpec,
  createApprovalRequestRecord,
  createProductionApplyManifest,
  resolveMinimalMvpRoleFromTrustedActor,
  validateProductionDraft,
  type ApprovedProductionSpec,
  type AcceptedEventSpec,
  type ApprovalRequestRecord,
  type AuditEntry,
  type BusinessContext,
  type CaseEvent,
  type ProductionHandoff,
  type ProductionDraft,
  type ProductionApplyManifest,
  type TrustedActor,
  type Queryable,
  type AuditLogWriteResult
} from "@catering/shared-core";
import {
  projectApprovedProductionSpec,
  projectProductionEventSpec
} from "./production-response-projection.js";
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
  | "after_plan_write"
  | "after_purchase_list_write"
  | "after_recipe_write"
  | "before_manifest_publish"
  | "after_manifest_publish"
  | "after_case_cas"
  | "after_result_event"
  | "after_audit";

function approvalRoleForActor(actor: TrustedActor): "production_operator" | "admin" {
  return resolveMinimalMvpRoleFromTrustedActor(actor) === "admin" ? "admin" : "production_operator";
}

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
  /**
   * An insert can publish a File record and still throw while running its
   * post-publish work.  Keep that exception attached to the ownership result so
   * the caller can register the exact record before rethrowing it.
   */
  error?: unknown;
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
  let insertion: "created" | "exists";
  try {
    insertion = await input.insert();
  } catch (error) {
    // atomicInsert may have linked the exact record before its post-publish
    // callback failed.  The pre-read proved this operation owned an empty slot;
    // only an exact read-back can therefore transfer ownership for rollback.
    try {
      const observed = await input.get();
      if (observed && areJsonValuesEqual(observed, input.expected)) {
        return { created: true, error };
      }
    } catch {
      // Preserve the original write error; without an exact read-back the
      // record must not be treated as ours.
    }
    throw error;
  }

  const created = insertion === "created";
  try {
    const observed = await input.get();
    return {
      created,
      ...(areJsonValuesEqual(observed, input.expected)
        ? {}
        : { conflict: `${input.label} konnte nicht konfliktfrei veröffentlicht werden.` })
    };
  } catch (error) {
    // The insert result is the ownership decision.  If only its validation
    // read failed, retain that decision and let the caller compensate exactly.
    if (created) return { created: true, error };
    throw error;
  }
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
  if (canonical.operationalArchive?.status === "archived") {
    return `AcceptedEventSpec ${candidate.specId} ist archiviert und nicht mehr für Apply freigegeben.`;
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

function deterministicProductionDraftId(prefix: string, identity: string): string {
  return `${prefix}${createHash("sha256").update(identity).digest("hex")}`;
}

function isDeterministicCaseRootCandidate(
  actor: TrustedActor,
  currentCase: NonNullable<Awaited<ReturnType<ProductionStore["getCase"]>>>,
  expectedEventSpec: AcceptedEventSpec | undefined,
  draft: ProductionDraft,
  events: Awaited<ReturnType<ProductionStore["listEvents"]>>
): boolean {
  if (draft.supersedesDraftId) return false;
  const eventSpec = draft.draftArtifacts.eventSpec;
  if (!eventSpec) return false;

  const handoffId = currentCase.productionHandoffId;
  if (
    handoffId &&
    draft.draftId === `production-draft-handoff-${handoffId}` &&
    draft.source.sourceRef === `offer-handoff:${handoffId}`
  ) {
    return true;
  }

  const specId = expectedEventSpec?.specId;
  const specFingerprint = draft.source.inputHash?.startsWith("sha256:")
    ? draft.source.inputHash.slice("sha256:".length)
    : undefined;
  if (
    expectedEventSpec &&
    specFingerprint &&
    draft.draftId === deterministicProductionDraftId(
      "production-draft-spec-",
      `${actor.businessId}\0${currentCase.caseId}\0${specId}\0${specFingerprint}`
    ) &&
    draft.source.sourceRef === `accepted-event-spec:${specId}`
  ) {
    return true;
  }

  return events
    .filter((event) => event.kind === "source_added")
    .some((event) => {
      const source = event.sourceRef;
      const documentId = event.sourceId ?? source?.documentId;
      if (!documentId || !source?.filename || !source.sha256) return false;
      const expectedInputHash = `sha256:${source.sha256}`;
      return draft.draftId === deterministicProductionDraftId(
        "production-draft-document-",
        `${actor.businessId}\0${currentCase.caseId}\0${documentId}`
      ) &&
        draft.source.sourceRef === `upload:${source.filename}` &&
        draft.source.inputHash === expectedInputHash &&
        (eventSpec.sourceLineage ?? []).some((lineage) =>
          lineage.sourceType === "pdf" && lineage.reference === expectedInputHash
        );
    });
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

/**
 * Decision events are deterministic projections.  Check an already occupied
 * identity before publishing any decision rows so a foreign event cannot turn
 * into a late, partially compensated conflict.
 */
async function decisionCaseEventProjectionError(
  actor: TrustedActor,
  scope: Pick<CaseDecisionProjectionScope, "getCaseEvent">,
  caseId: string,
  aggregate: ProductionDecisionAggregate
): Promise<string | undefined> {
  const { approval, approvedProductionSpec } = aggregate;
  const expectedEvents: Array<{
    kind: CaseEvent["kind"];
    eventIdentity: string;
    at: string;
    role: CaseEvent["role"];
    text: string;
    artifactId: string;
  }> = [{
    kind: "review_decision",
    eventIdentity: approval.approvalRequestId,
    at: approval.decidedAt,
    role: "user",
    text: approval.decision === "approved"
      ? "Produktionsentwurf freigegeben."
      : "Produktionsentwurf abgelehnt.",
    artifactId: approval.approvalRequestId
  }];
  if (approvedProductionSpec) {
    expectedEvents.push({
      kind: "approval",
      eventIdentity: approvedProductionSpec.approvedProductionSpecId,
      at: approval.decidedAt,
      role: "system",
      text: "Produktionssnapshot freigegeben.",
      artifactId: approvedProductionSpec.approvedProductionSpecId
    });
  }
  for (const expectedEvent of expectedEvents) {
    const eventId = `production-case-event-${createHash("sha256")
      .update(`${actor.businessId}\0${caseId}\0${expectedEvent.kind}\0${expectedEvent.eventIdentity}`)
      .digest("hex")}`;
    const existing = await scope.getCaseEvent(eventId);
    if (!existing) continue;
    const expected = {
      businessId: actor.businessId,
      eventId,
      caseId,
      sequence: existing.sequence,
      at: expectedEvent.at,
      role: expectedEvent.role,
      kind: expectedEvent.kind,
      text: expectedEvent.text,
      artifactId: expectedEvent.artifactId
    } satisfies CaseEvent;
    if (!areJsonValuesEqual(existing, expected)) {
      return "Ein Produktionsentscheidungsereignis ist bereits mit abweichendem Inhalt vorhanden.";
    }
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

type ProductionDraftTimelineScope = {
  listDrafts: () => Promise<ProductionDraft[]>;
  listEvents: (caseId: string) => Promise<CaseEvent[]>;
};

/**
 * Verify that the approved draft is still the only observable branch of the
 * case. This deliberately reads drafts and case events from the caller's
 * already-held transaction/lock so an event-loss orphan cannot be hidden by a
 * later projection check.
 */
async function productionCaseDraftTimelineError(
  actor: TrustedActor,
  currentCase: NonNullable<Awaited<ReturnType<ProductionStore["getCase"]>>>,
  expectedDraft: ProductionDraft,
  scope: ProductionDraftTimelineScope
): Promise<string | undefined> {
  const conflictMessage = "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  const drafts = await scope.listDrafts();
  const draftsById = new Map(drafts.map((draft) => [draft.draftId, draft]));
  const events = await scope.listEvents(currentCase.caseId);
  const hasDirectDraftEvent = (draft: ProductionDraft): boolean => events.some((event) => {
    const revisionRef = event.revisionRef;
    if (draft.supersedesDraftId) {
      return event.kind === "revision_created" &&
        event.artifactId === draft.draftId &&
        revisionRef?.artifactType === "ProductionDraft" &&
        revisionRef.artifactId === draft.draftId &&
        revisionRef.revision === draft.revision &&
        revisionRef.createdAt === draft.createdAt &&
        revisionRef.supersedesArtifactId === draft.supersedesDraftId;
    }
    return event.kind === "draft_created" &&
      event.artifactId === draft.draftId &&
      revisionRef?.artifactType === "ProductionDraft" &&
      revisionRef.artifactId === draft.draftId &&
      revisionRef.revision === draft.revision &&
      revisionRef.createdAt === draft.createdAt;
  });
  const caseProjectedDraftIds = new Set(
    events
      .filter((event) => event.kind === "draft_created" || event.kind === "revision_created")
      .flatMap((event) => [event.artifactId, event.revisionRef?.artifactId])
      .filter((draftId): draftId is string => typeof draftId === "string")
  );
  for (const draftId of caseProjectedDraftIds) {
    const projectedDraft = draftsById.get(draftId);
    if (!projectedDraft || !hasDirectDraftEvent(projectedDraft)) return conflictMessage;
  }
  for (const draft of drafts) {
    if (
      isDeterministicCaseRootCandidate(
        actor,
        currentCase,
        expectedDraft.draftArtifacts.eventSpec,
        draft,
        events
      ) &&
      !hasDirectDraftEvent(draft)
    ) {
      return conflictMessage;
    }
  }

  const lineageSeen = new Set<string>();
  let lineageDraft: ProductionDraft | undefined = expectedDraft;
  while (lineageDraft) {
    if (lineageSeen.has(lineageDraft.draftId) || lineageSeen.size >= 100) return conflictMessage;
    lineageSeen.add(lineageDraft.draftId);
    const predecessorId = lineageDraft.supersedesDraftId;
    if (!predecessorId) break;
    lineageDraft = draftsById.get(predecessorId);
    if (!lineageDraft) return conflictMessage;
  }
  for (const draftId of lineageSeen) {
    const draft = draftsById.get(draftId);
    if (!draft || !hasDirectDraftEvent(draft)) return conflictMessage;
  }

  const branchReachable = new Set(lineageSeen);
  let branchExpanded = true;
  while (branchExpanded) {
    branchExpanded = false;
    for (const draft of drafts) {
      if (
        !draft.supersedesDraftId ||
        !branchReachable.has(draft.supersedesDraftId) ||
        lineageSeen.has(draft.draftId) ||
        branchReachable.has(draft.draftId)
      ) continue;
      if (!hasDirectDraftEvent(draft)) return conflictMessage;
      branchReachable.add(draft.draftId);
      branchExpanded = true;
    }
  }

  const reachable = new Set([expectedDraft.draftId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const draft of drafts) {
      if (
        draft.draftId !== expectedDraft.draftId &&
        draft.supersedesDraftId &&
        reachable.has(draft.supersedesDraftId) &&
        !reachable.has(draft.draftId)
      ) {
        reachable.add(draft.draftId);
        expanded = true;
      }
    }
  }
  if (reachable.size > 1) return conflictMessage;

  const latestDraftEvent = events
    .filter((event) => event.kind === "draft_created" || event.kind === "revision_created")
    .sort((left, right) => right.sequence - left.sequence)[0];
  if (!latestDraftEvent || latestDraftEvent.artifactId !== expectedDraft.draftId) return conflictMessage;
  return undefined;
}

async function productionCaseApplyConsistencyError(
  store: ProductionStore,
  actor: TrustedActor,
  currentCase: Awaited<ReturnType<ProductionStore["getCase"]>>,
  approvedSpec: ApprovedProductionSpec,
  scope?: ProductionCaseApplyScope,
  aggregate?: ProductionDecisionAggregate,
  persistedCurrentDraft?: ProductionDraft
): Promise<string | undefined> {
  if (!currentCase || currentCase.approvedProductionSpecId !== approvedSpec.approvedProductionSpecId) {
    return "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  }
  if (currentCase.status === "archived") {
    return "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  }

  if (currentCase.sourceSpecId !== approvedSpec.artifacts.eventSpec.specId) {
    return "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  }

  const current = persistedCurrentDraft ?? await scope?.getDraft(approvedSpec.sourceDraft.draftId);
  if (!aggregate || !current ||
    aggregate.decidedDraft.draftId !== approvedSpec.sourceDraft.draftId ||
    !areJsonValuesEqual(current, aggregate.decidedDraft)) {
    return "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag.";
  }

  const events = scope
    ? await scope.listEvents(currentCase.caseId)
    : await store.listEvents(actor, currentCase.caseId);
  const latestDraftEvent = events
    .filter((event) => event.kind === "draft_created" || event.kind === "revision_created")
    .sort((left, right) => right.sequence - left.sequence)[0];
  const timelineConflict = await productionCaseDraftTimelineError(
    actor,
    currentCase,
    aggregate.decidedDraft,
    scope
      ? { listDrafts: () => scope.listDrafts(), listEvents: (caseId) => scope.listEvents(caseId) }
      : { listDrafts: async () => [current], listEvents: (caseId) => store.listEvents(actor, caseId) }
  );
  if (timelineConflict) return timelineConflict;
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

type CaseDecisionProjectionScope = ProductionDecisionTargetScope & {
  listDrafts: () => Promise<ProductionDraft[]>;
  listEvents: (caseId: string) => Promise<CaseEvent[]>;
  getCase: (caseId: string) => Promise<Awaited<ReturnType<ProductionStore["getCase"]>>>;
  compareAndSetCase: (
    caseId: string,
    expectedVersion: number,
    next: NonNullable<Awaited<ReturnType<ProductionStore["getCase"]>>>
  ) => Promise<"updated" | "conflict" | "missing">;
  appendCaseEvent: (
    caseId: string,
    input: Parameters<ProductionStore["appendEvent"]>[2],
    eventIdentity?: string
  ) => Promise<unknown>;
};

async function appendProductionDecisionEventsInCaseScope(
  scope: CaseDecisionProjectionScope,
  caseId: string,
  aggregate: ProductionDecisionAggregate
): Promise<void> {
  const { approval, sourceDraft, approvedProductionSpec } = aggregate;
  await scope.appendCaseEvent(caseId, {
    at: approval.decidedAt,
    role: "user",
    kind: "review_decision",
    text: approval.decision === "approved"
      ? "Produktionsentwurf freigegeben."
      : "Produktionsentwurf abgelehnt.",
    artifactId: approval.approvalRequestId
  }, approval.approvalRequestId);
  if (!approvedProductionSpec) return;

  const current = await scope.getCase(caseId);
  if (!current) throw new Error("ProductionCase wurde nicht gefunden.");
  if (
    current.approvedProductionSpecId &&
    current.approvedProductionSpecId !== approvedProductionSpec.approvedProductionSpecId
  ) {
    throw new Error("Produktionsauftrag besitzt bereits eine andere freigegebene Produktionsspezifikation.");
  }
  if (!current.approvedProductionSpecId) {
    const updated = await scope.compareAndSetCase(caseId, current.version, {
      ...current,
      approvedProductionSpecId: approvedProductionSpec.approvedProductionSpecId,
      version: current.version + 1,
      updatedAt: approval.decidedAt
    });
    if (updated !== "updated") {
      throw new Error("Produktionsauftrag konnte nicht atomar mit der Freigabe verknüpft werden.");
    }
  }
  await scope.appendCaseEvent(caseId, {
    at: approval.decidedAt,
    role: "system",
    kind: "approval",
    text: "Produktionssnapshot freigegeben.",
    artifactId: approvedProductionSpec.approvedProductionSpecId
  }, approvedProductionSpec.approvedProductionSpecId);
  // Keep the source draft in this helper's contract so the projection remains
  // visibly tied to the immutable aggregate provenance.
  void sourceDraft;
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

  function decisionAuditInputFor(
    actor: TrustedActor,
    aggregate: ProductionDecisionAggregate
  ) {
    const { approval } = aggregate;
    if (approval.decision === "rejected") {
      return {
        action: "production.production_draft_rejected" as const,
        entityType: "ProductionDraft" as const,
        entityId: aggregate.sourceDraft.draftId,
        actor,
        at: approval.decidedAt,
        idempotencyKey: `production-decision:${approval.approvalRequestId}`,
        summary: "ProductionDraft nach Review verworfen.",
        details: {
          draftId: aggregate.sourceDraft.draftId,
          revision: aggregate.sourceDraft.revision,
          approvalRequestId: approval.approvalRequestId,
          writesProductObject: false
        }
      };
    }
    const approvedProductionSpec = aggregate.approvedProductionSpec;
    if (!approvedProductionSpec) {
      throw new Error("Freigegebener Produktionssnapshot fehlt für das Entscheidungs-Audit.");
    }
    return {
      action: "production.production_spec_approved" as const,
      entityType: "ApprovedProductionSpec" as const,
      entityId: approvedProductionSpec.approvedProductionSpecId,
      actor,
      at: approval.decidedAt,
      idempotencyKey: `production-decision:${approvedProductionSpec.approvedProductionSpecId}`,
      summary: "Geprüfter Produktions-Snapshot unveränderlich freigegeben.",
      details: {
        draftId: aggregate.sourceDraft.draftId,
        revision: aggregate.sourceDraft.revision,
        approvalRequestId: approval.approvalRequestId,
        writesProductObject: false
      }
    };
  }

  type DecisionAuditPublication = {
    writer: AuditLogStore;
    context: BusinessContext;
    result: AuditLogWriteResult;
    transactionalQueryable?: Queryable;
  };

  const prepareDecisionAudit = async (
    actor: TrustedActor,
    aggregate: ProductionDecisionAggregate,
    transactionalQueryable?: Queryable
  ): Promise<DecisionAuditPublication | { conflict: string }> => {
    const writer = transactionalQueryable
      ? new AuditLogStore({ pgPool: transactionalQueryable })
      : auditLog;
    const context = { businessId: actor.businessId };
    try {
      const result = await writer.logForWithResult(context, decisionAuditInputFor(actor, aggregate));
      return { writer, context, result, transactionalQueryable };
    } catch (error) {
      if (error instanceof AuditLogEntryConflictError) {
        return { conflict: "Entscheidungs-Audit ist bereits mit abweichendem Inhalt vorhanden." };
      }
      throw error;
    }
  };

  const compensateDecisionAudit = async (publication: DecisionAuditPublication): Promise<void> => {
    if (!publication.result.created) return;
    const result = await publication.writer.deleteIfExact(publication.context, publication.result.entry);
    if (result === "conflict") {
      throw new Error("Entscheidungs-Audit konnte nach einer unterbrochenen Projektion nicht sicher zurückgebaut werden.");
    }
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
    // Any linked ProductionCase, including a legacy case without a handoff marker,
    // must share the case decision scope so its timeline projection cannot escape
    // the same transaction/lock as the decision rows.
    const decisionCaseId = linkedCaseId;
    const requestedApproval = createApprovalRequestRecord({
      actor,
      role: approvalRoleForActor(actor),
      target,
      decision: request.body.decision,
      ...(request.body.comment?.trim() ? { comment: request.body.comment.trim() } : {})
    });
    const canonicalCaseId = linkedCaseId && linkedCase?.productionHandoffId ? linkedCaseId : undefined;
    const resolveDecisionInScope = async (
      scope: ProductionDecisionTargetScope,
      caseScope?: CaseDecisionProjectionScope,
      expectedCaseVersion?: number,
      transactionalQueryable?: Queryable
    ) => {
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
        if (decisionCaseId) {
          if (!caseScope) {
            return { kind: "conflict" as const, message: "Produktionsauftrag ist nicht mehr verfügbar." };
          }
          const currentCase = await caseScope.getCase(decisionCaseId);
          if (
            !currentCase ||
            expectedCaseVersion !== undefined && currentCase.version !== expectedCaseVersion ||
            currentCase.approvedProductionSpecId !== undefined &&
              currentCase.approvedProductionSpecId !== persistedAggregate.approvedProductionSpec?.approvedProductionSpecId
          ) {
            return { kind: "conflict" as const, message: "Produktionsauftrag wurde während der Freigabe verändert." };
          }
        }
        if (canonicalCaseId) {
          if (!caseScope) {
            return { kind: "conflict" as const, message: "Produktionsauftrag ist nicht mehr verfügbar." };
          }
          const currentCase = await caseScope.getCase(canonicalCaseId);
          if (
            !currentCase ||
            expectedCaseVersion !== undefined && currentCase.version !== expectedCaseVersion ||
            currentCase.approvedProductionSpecId !== undefined &&
              currentCase.approvedProductionSpecId !== persistedAggregate.approvedProductionSpec?.approvedProductionSpecId
          ) {
            return { kind: "conflict" as const, message: "Produktionsauftrag wurde während der Freigabe verändert." };
          }
          const continuationError = await canonicalDecisionContinuationErrorAtDecisionScope(
            scope,
            canonicalCaseId,
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
          const timelineConflict = await productionCaseDraftTimelineError(
            actor,
            currentCase,
            persistedAggregate.decidedDraft,
            caseScope
          );
          if (timelineConflict) {
            return { kind: "conflict" as const, message: timelineConflict };
          }
          const reviewProjectionError = await canonicalReviewProjectionErrorAtDecisionScope(
            actor,
            scope,
            persistedCurrent,
            persistedAggregate.sourceDraft,
            canonicalCaseId,
            persistedCurrent
          );
          if (reviewProjectionError) {
            return { kind: "conflict" as const, message: reviewProjectionError };
          }
        }
        if (caseScope && decisionCaseId) {
          const eventConflict = await decisionCaseEventProjectionError(
            actor,
            caseScope,
            decisionCaseId,
            persistedAggregate
          );
          if (eventConflict) {
            return { kind: "conflict" as const, message: eventConflict };
          }
        }
        const auditPublication = await prepareDecisionAudit(actor, persistedAggregate, transactionalQueryable);
        if ("conflict" in auditPublication) {
          return { kind: "conflict" as const, message: auditPublication.conflict };
        }
        try {
          await projectDecisionAggregate(scope, persistedAggregate);
          if (caseScope && decisionCaseId) {
            await appendProductionDecisionEventsInCaseScope(caseScope, decisionCaseId, persistedAggregate);
          } else {
            await appendProductionDecisionEvents(store, actor, persistedAggregate);
          }
          return { kind: "decided" as const, aggregate: persistedAggregate };
        } catch (error) {
          await compensateDecisionAudit(auditPublication);
          throw error;
        }
      }

      const draft = await scope.getDraft(request.params.draftId);
      if (!draft) return { kind: "not_found" as const };
      if (draft.revision !== target.revision) {
        return { kind: "conflict" as const, message: "ProductionDraft-Revision wurde gleichzeitig verändert." };
      }
      if (decisionCaseId) {
        if (!caseScope) {
          return { kind: "conflict" as const, message: "Produktionsauftrag ist nicht mehr verfügbar." };
        }
        const currentCase = await caseScope.getCase(decisionCaseId);
        if (
          !currentCase ||
          expectedCaseVersion !== undefined && currentCase.version !== expectedCaseVersion ||
          currentCase.approvedProductionSpecId !== undefined
        ) {
          return { kind: "conflict" as const, message: "Produktionsauftrag wurde während der Freigabe verändert." };
        }
      }
      if (canonicalCaseId) {
        if (!caseScope) {
          return { kind: "conflict" as const, message: "Produktionsauftrag ist nicht mehr verfügbar." };
        }
        const currentCase = await caseScope.getCase(canonicalCaseId);
        if (
          !currentCase ||
          expectedCaseVersion !== undefined && currentCase.version !== expectedCaseVersion ||
          currentCase.approvedProductionSpecId !== undefined
        ) {
          return { kind: "conflict" as const, message: "Produktionsauftrag wurde während der Freigabe verändert." };
        }
        const timelineConflict = await productionCaseDraftTimelineError(
          actor,
          currentCase,
          draft,
          caseScope
        );
        if (timelineConflict) {
          return { kind: "conflict" as const, message: timelineConflict };
        }
        const reviewProjectionError = await canonicalReviewProjectionErrorAtDecisionScope(
          actor,
          scope,
          draft,
          draft,
          canonicalCaseId
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
      if (canonicalCaseId) {
        const continuationError = await canonicalDecisionContinuationErrorAtDecisionScope(
          scope,
          canonicalCaseId,
          aggregate
        );
        if (continuationError) {
          return { kind: "conflict" as const, message: continuationError };
        }
      }
      if (caseScope && decisionCaseId) {
        const eventConflict = await decisionCaseEventProjectionError(
          actor,
          caseScope,
          decisionCaseId,
          aggregate
        );
        if (eventConflict) {
          return { kind: "conflict" as const, message: eventConflict };
        }
      }
      const auditPublication = await prepareDecisionAudit(actor, aggregate, transactionalQueryable);
      if ("conflict" in auditPublication) {
        return { kind: "conflict" as const, message: auditPublication.conflict };
      }
      try {
        const aggregateInsert = await scope.insertDecisionAggregate(aggregate);
        const authoritative = await scope.getDecisionAggregate(approval.approvalRequestId);
        if (!authoritative || !areJsonValuesEqual(authoritative, aggregate)) {
          if (aggregateInsert === "created") {
            const rollback = await scope.deleteDecisionAggregateIfExact(aggregate);
            if (rollback === "conflict") {
              throw new Error("Autoritative Produktionsentscheidung konnte nach einem Read-back-Konflikt nicht sicher zurückgebaut werden.");
            }
          }
          await compensateDecisionAudit(auditPublication);
          return { kind: "conflict" as const, message: "Autoritative Produktionsentscheidung konnte nicht konfliktfrei gespeichert werden." };
        }
        await projectDecisionAggregate(scope, authoritative);
        if (caseScope && decisionCaseId) {
          await appendProductionDecisionEventsInCaseScope(caseScope, decisionCaseId, authoritative);
        } else {
          await appendProductionDecisionEvents(store, actor, authoritative);
        }
        return { kind: "decided" as const, aggregate: authoritative };
      } catch (error) {
        await compensateDecisionAudit(auditPublication);
        throw error;
      }
    };
    const resolution = decisionCaseId
      ? await store.withCaseDecisionCriticalSection(
        actor,
        decisionCaseId,
        target,
        (_current, scope, transactionalQueryable) => resolveDecisionInScope(
          scope,
          scope,
          linkedCase?.version,
          transactionalQueryable
        )
      )
      : await decisionRepository.withTargetCriticalSection(
        actor,
        target,
        (scope, transactionalQueryable) => resolveDecisionInScope(scope, undefined, undefined, transactionalQueryable)
      );
    if (!resolution) {
      return reply.code(409).send({ message: "Produktionsauftrag ist nicht mehr verfügbar." });
    }

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
      return reply.code(201).send({ approval });
    }
    const approvedProductionSpec = aggregate.approvedProductionSpec!;
    return reply.code(201).send({
      approval,
      approvedProductionSpec: projectApprovedProductionSpec(actor, approvedProductionSpec)
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
      const { productionPlan, purchaseList, recipes } = approvedSpec.artifacts;
      const publicationTargets: import("@catering/shared-core").CriticalSectionTarget[] = [
        { kind: "production_plan", artifactId: productionPlan.planId, revision: 0 },
        { kind: "production_purchase_list", artifactId: purchaseList.purchaseListId, revision: 0 },
        { kind: "production_approved_spec", artifactId: approvedSpec.approvedProductionSpecId, revision: 0 },
        ...recipes.map((recipe) => ({ kind: "production_recipe", artifactId: recipe.recipeId, revision: 0 }))
      ];
      const applyResult = await store.withCaseApplyCriticalSection(actor, caseId, async (
        currentCase,
        applyScope,
        transactionalQueryable
      ) => {
        const recipeScope = repository.createLockedMutationScope(transactionalQueryable);
        // PostgreSQL must use the very same transaction-local collection for the
        // Apply audit. File storage keeps the injected store so its exact record
        // can be compensated if a later step fails.
        const auditWriter = transactionalQueryable
          ? new AuditLogStore({ pgPool: transactionalQueryable })
          : auditLog;
        const aggregate = await applyScope.getDecisionAggregate(approvedSpec.approvalRequestId);
        const currentDraft = await applyScope.getDraft(approvedSpec.sourceDraft.draftId);
        const caseConflict = await productionCaseApplyConsistencyError(
          store,
          actor,
          currentCase,
          approvedSpec,
          applyScope,
          aggregate,
          currentDraft
        );
        if (caseConflict) {
          return reply.code(409).send({
            message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
            errors: [caseConflict]
          });
        }

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

        const { eventSpec } = approvedSpec.artifacts;
        const conflicts: string[] = [];
        const createdPlans: typeof productionPlan[] = [];
        const createdPurchaseLists: typeof purchaseList[] = [];
        const createdRecipes: typeof recipes = [];
        let createdManifest: ProductionApplyManifest | undefined;
        let previousCase: import("@catering/shared-core").ProductionCase | undefined;
        let updatedCase: import("@catering/shared-core").ProductionCase | undefined;
        let createdResultEvent: CaseEvent | undefined;
        let createdAudit: AuditEntry | undefined;
        const rollbackCreatedArtifacts = async (): Promise<string[]> => {
          const rollbackConflicts: string[] = [];
          for (const recipe of [...createdRecipes].reverse()) {
            const result = await recipeScope.deleteIfExact(actor, recipe);
            if (result === "conflict") rollbackConflicts.push(`Recipe ${recipe.recipeId} konnte nicht sicher zurückgebaut werden.`);
          }
          for (const list of [...createdPurchaseLists].reverse()) {
            const result = await applyScope.deletePurchaseListIfExact(list);
            if (result === "conflict") rollbackConflicts.push(`PurchaseList ${list.purchaseListId} konnte nicht sicher zurückgebaut werden.`);
          }
          for (const plan of [...createdPlans].reverse()) {
            const result = await applyScope.deletePlanIfExact(plan);
            if (result === "conflict") rollbackConflicts.push(`ProductionPlan ${plan.planId} konnte nicht sicher zurückgebaut werden.`);
          }
          if (createdManifest) {
            const result = await applyScope.deleteApplyManifestIfExact(createdManifest);
            if (result === "conflict") rollbackConflicts.push("ProductionApplyManifest konnte nicht sicher zurückgebaut werden.");
          }
          return rollbackConflicts;
        };
        const rollbackApplyState = async (): Promise<string[]> => {
          const rollbackConflicts: string[] = [];
          let caseRestored = true;
          if (previousCase && updatedCase) {
            caseRestored = false;
            const latestCase = await applyScope.getCase(caseId);
            if (!latestCase || !areJsonValuesEqual(latestCase, updatedCase)) {
              rollbackConflicts.push("ProductionCase konnte nicht sicher zurückgebaut werden.");
            } else {
              try {
                const result = await applyScope.restoreCaseIfExact(caseId, updatedCase, previousCase);
                if (result === "updated") {
                  caseRestored = true;
                } else {
                  rollbackConflicts.push("ProductionCase konnte nicht sicher zurückgebaut werden.");
                }
              } catch {
                // atomicWrite can publish the previous Case and then fail while
                // syncing the directory.  Continue only after an exact read-back
                // proves that the compensation reached durable storage.
                const observedCase = await applyScope.getCase(caseId);
                if (observedCase && areJsonValuesEqual(observedCase, previousCase)) {
                  caseRestored = true;
                } else {
                  rollbackConflicts.push("ProductionCase konnte nicht sicher zurückgebaut werden.");
                }
              }
            }
          }
          // Never delete Apply artefacts while the Case still carries an
          // uncertain current projection; preserving that drift is safer than
          // deleting data that may belong to a concurrent writer.
          if (!caseRestored) return rollbackConflicts;
          if (createdAudit && !transactionalQueryable) {
            const result = await auditWriter.deleteIfExact({ businessId: createdAudit.businessId }, createdAudit);
            if (result === "conflict") rollbackConflicts.push("Apply-Audit konnte nicht sicher zurückgebaut werden.");
          }
          if (createdResultEvent) {
            const result = await applyScope.deleteCaseEventIfExact(createdResultEvent);
            if (result === "conflict") rollbackConflicts.push("Production-Result-Ereignis konnte nicht sicher zurückgebaut werden.");
          }
          rollbackConflicts.push(...await rollbackCreatedArtifacts());
          return rollbackConflicts;
        };

        try {
          const canonicalEventSpec = await intakeRecords.getSpec(actor, eventSpec.specId);
          const eventSpecConflict = acceptedEventSpecConsistencyError(
            canonicalEventSpec,
            eventSpec
          );
          if (eventSpecConflict) conflicts.push(eventSpecConflict);

          if (conflicts.length === 0) {
            const preflightConflicts = [
              await existingArtifactConflict({
                get: () => applyScope.getPlan(productionPlan.planId),
                expected: productionPlan,
                label: `ProductionPlan ${productionPlan.planId}`
              }),
              await existingArtifactConflict({
                get: () => applyScope.getPurchaseList(purchaseList.purchaseListId),
                expected: purchaseList,
                label: `PurchaseList ${purchaseList.purchaseListId}`
              }),
              ...(await Promise.all(recipes.map((recipe) => existingArtifactConflict({
                get: () => recipeScope.get(actor, recipe.recipeId),
                expected: recipe,
                label: `Recipe ${recipe.recipeId}`
              }))))
            ].filter((conflict): conflict is string => Boolean(conflict));
            conflicts.push(...preflightConflicts);
          }

          if (conflicts.length === 0) {
            const result = await compareOrInsert({
              get: () => applyScope.getPlan(productionPlan.planId),
              insert: () => applyScope.insertPlan(productionPlan),
              expected: productionPlan,
              label: `ProductionPlan ${productionPlan.planId}`
            });
            if (result.conflict) conflicts.push(result.conflict);
            if (result.created) {
              createdPlans.push(productionPlan);
              if (!result.error && !result.conflict) applyFaultInjector?.("after_plan_write");
            }
            if (result.error) throw result.error;
          }

          if (conflicts.length === 0) {
            const result = await compareOrInsert({
              get: () => applyScope.getPurchaseList(purchaseList.purchaseListId),
              insert: () => applyScope.insertPurchaseList(purchaseList),
              expected: purchaseList,
              label: `PurchaseList ${purchaseList.purchaseListId}`
            });
            if (result.conflict) conflicts.push(result.conflict);
            if (result.created) {
              createdPurchaseLists.push(purchaseList);
              if (!result.error && !result.conflict) applyFaultInjector?.("after_purchase_list_write");
            }
            if (result.error) throw result.error;
          }

          for (const recipe of conflicts.length === 0 ? recipes : []) {
            const result = await compareOrInsert({
              get: () => recipeScope.get(actor, recipe.recipeId),
              insert: () => recipeScope.insert(actor, recipe),
              expected: recipe,
              label: `Recipe ${recipe.recipeId}`
            });
            if (result.conflict) {
              conflicts.push(result.conflict);
              break;
            }
            if (result.created) {
              createdRecipes.push(recipe);
              if (!result.error && !result.conflict) applyFaultInjector?.("after_recipe_write");
            }
            if (result.error) throw result.error;
          }

          if (conflicts.length > 0) {
            conflicts.push(...await rollbackApplyState());
            return reply.code(409).send({
              message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
              errors: conflicts
            });
          }

          const candidateManifest = createProductionApplyManifest({
            approvedProductionSpec: approvedSpec,
            actor
          });
          const existingManifest = await applyScope.getApplyManifest(approvedSpec.approvedProductionSpecId);
          let expectedPersistedClaim = existingManifest;
          if (!existingManifest) {
            applyFaultInjector?.("before_manifest_publish");
            try {
              const insertResult = await applyScope.insertApplyManifest(candidateManifest);
              expectedPersistedClaim = insertResult === "created" ? candidateManifest : undefined;
              createdManifest = insertResult === "created" ? candidateManifest : undefined;
            } catch (error) {
              // File publication may complete before a post-publish callback
              // fails.  Because the pre-read established an empty slot, accept
              // ownership only when the persisted manifest is an exact match.
              try {
                const observedManifest = await applyScope.getApplyManifest(approvedSpec.approvedProductionSpecId);
                if (observedManifest && areJsonValuesEqual(observedManifest, candidateManifest)) {
                  expectedPersistedClaim = observedManifest;
                  createdManifest = observedManifest;
                }
              } catch {
                // Preserve the original insert error and do not infer ownership.
              }
              throw error;
            }
          }
          if (createdManifest) applyFaultInjector?.("after_manifest_publish");
          const authoritativeManifest = await applyScope.getApplyManifest(approvedSpec.approvedProductionSpecId);
          if (
            !authoritativeManifest ||
            !manifestMatchesApprovedSpec(authoritativeManifest, approvedSpec) ||
            (expectedPersistedClaim && !areJsonValuesEqual(authoritativeManifest, expectedPersistedClaim))
          ) {
            conflicts.push("ProductionApplyManifest konnte nicht konfliktfrei veröffentlicht werden.");
            conflicts.push(...await rollbackApplyState());
            return reply.code(409).send({
              message: "ProductionApplyManifest konnte nicht konfliktfrei veröffentlicht werden.",
              errors: conflicts
            });
          }

          const persistedCase = await applyScope.getCase(caseId);
          if (!persistedCase) {
            conflicts.push("ProductionCase wurde nicht gefunden.");
          } else {
            const nextCase = {
              ...persistedCase,
              approvedProductionSpecId: approvedSpec.approvedProductionSpecId,
              currentPlanId: productionPlan.planId,
              currentPurchaseListId: purchaseList.purchaseListId,
              status: "completed" as const,
              version: persistedCase.version + 1,
              updatedAt: authoritativeManifest.appliedAt
            };
            const caseUnchanged = persistedCase.approvedProductionSpecId === nextCase.approvedProductionSpecId &&
              persistedCase.currentPlanId === nextCase.currentPlanId &&
              persistedCase.currentPurchaseListId === nextCase.currentPurchaseListId &&
              persistedCase.status === nextCase.status;
            if (!caseUnchanged) {
              previousCase = structuredClone(persistedCase);
              try {
                const caseResult = await applyScope.compareAndSetCase(caseId, persistedCase.version, nextCase);
                if (caseResult !== "updated") {
                  conflicts.push("ProductionCase konnte nicht atomar mit dem Apply verknüpft werden.");
                } else {
                  updatedCase = nextCase;
                }
              } catch (error) {
                const observedCase = await applyScope.getCase(caseId);
                if (observedCase && areJsonValuesEqual(observedCase, nextCase)) updatedCase = observedCase;
                throw error;
              }
            }
          }
          if (updatedCase) applyFaultInjector?.("after_case_cas");
          if (conflicts.length > 0) {
            conflicts.push(...await rollbackApplyState());
            return reply.code(409).send({
              message: "ApprovedProductionSpec konnte nicht atomar angewendet werden.",
              errors: conflicts
            });
          }

          const resultEventsBefore = new Set((await applyScope.listEvents(caseId)).map((event) => event.eventId));
          try {
            const resultEvent = await applyScope.appendCaseEvent(caseId, {
              at: authoritativeManifest.appliedAt,
              role: "system",
              kind: "result",
              text: "Produktionsplan und Einkaufsliste erstellt.",
              artifactId: productionPlan.planId
            }, productionPlan.planId);
            if (!resultEventsBefore.has(resultEvent.eventId)) createdResultEvent = resultEvent;
          } catch (error) {
            const resultEventsAfter = await applyScope.listEvents(caseId);
            createdResultEvent = resultEventsAfter.find((event) =>
              !resultEventsBefore.has(event.eventId) &&
              event.kind === "result" &&
              event.artifactId === productionPlan.planId
            );
            throw error;
          }
          if (createdResultEvent) applyFaultInjector?.("after_result_event");

          const auditContext = { businessId: authoritativeManifest.businessId };
          const auditInput = {
            action: "production.approved_spec_applied" as const,
            entityType: "ApprovedProductionSpec" as const,
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
          };
          try {
            const persistedAudit = await auditWriter.logForWithResult(auditContext, auditInput);
            if (persistedAudit.created) {
              createdAudit = persistedAudit.entry;
              applyFaultInjector?.("after_audit");
            }
          } catch (error) {
            if (error instanceof AuditLogPostPublishError) createdAudit = error.entry;
            throw error;
          }
          return {
            kind: "success" as const,
            payload: {
              eventSpec: projectProductionEventSpec(actor, eventSpec),
              plan: productionPlan,
              purchaseList,
              recipes
            },
            audit: { context: auditContext, input: auditInput }
          };
        } catch (error) {
          if (!transactionalQueryable) {
            const rollbackConflicts = await rollbackApplyState();
            if (rollbackConflicts.length > 0) {
              throw new Error(`Apply konnte nach einer Exception nicht vollständig zurückgebaut werden: ${rollbackConflicts.join("; ")}`);
            }
          }
          throw error;
        }
      },
      { draftId: approvedSpec.sourceDraft.draftId, revision: approvedSpec.sourceDraft.revision },
      publicationTargets,
      [{
        collectionNamespace: "intake/specs",
        target: {
          kind: "accepted_event_spec",
          artifactId: approvedSpec.artifacts.eventSpec.specId,
          revision: 0
        }
      }]
      );
      if (applyResult && typeof applyResult === "object" && "kind" in applyResult && applyResult.kind === "success") {
        return reply.send(applyResult.payload);
      }
      return applyResult ?? reply.code(409).send({
        message: "ApprovedProductionSpec würde bestehende Produktobjekte überschreiben.",
        errors: ["ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag."]
      });
    }
  );
}
