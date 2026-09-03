import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import {
  areJsonValuesEqual,
  approvalRequestIdForTarget,
  createLlmReadinessAgentAuditRecord,
  createEventRequestFromManualForm,
  createUploadSourceMetadata,
  findLlmReadinessPromptSchemaEntryByInputKind,
  hasMinimalMvpCapability,
  ingestDocument,
  isTrustedFinalApprovalSource,
  llmReadinessForbiddenPayloadKeys,
  llmReadinessContractVersion,
  normalizeEventRequestToSpec,
  validateAcceptedEventSpec,
  validateUploadedDocument,
  validateLlmReadinessModelOutputCandidate,
  validateProductionDraft,
  uploadErrorResponse,
  type AcceptedEventSpec,
  type AuditLogStore,
  type BoundaryGuardedLlmAdapter,
  type ByoLlmProcessingPolicyMetadata,
  type ByoLlmDataClass,
  type LlmReadinessDataMode,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessProviderAdapterRequest,
  type LlmReadinessProviderAdapterResponse,
  type ProductionDraft,
  type ProductionDraftReviewCard,
  type ProductionDraftReviewDecision,
  type ProductionHandoff,
  type TrustedActor
} from "@catering/shared-core";
import type { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import {
  productionDecisionRepositoryFor,
  type ProductionStore,
  type ClarificationDraft,
  type ClarificationDraftQuestion,
  type ProductionFeedbackDraft
} from "../repositories/production-store.js";
import type { ProductionDecisionTargetScope } from "../repositories/production-decision-repository.js";
import { buildProductionArtifacts } from "../rules/planning.js";
import {
  canReadProductionCommercials,
  projectProductionDraft,
  projectProductionEventSpec
} from "./production-response-projection.js";
import {
  projectProductionPlanReadResponse,
  projectPurchaseListReadResponse
} from "./production-read-response-projection.js";
import type { ProductionHandoffReader } from "../ports/production-handoff-reader.js";
import type { IntakeRecordsPort } from "../ports/intake-records-port.js";
import type {
  SourceDocumentReader,
  StoredSourceDocument
} from "../ports/source-document-reader.js";

const operatorProductionDraftReviewDecisions = [
  "fits",
  "change_requested",
  "unclear",
  "blocked"
] as const satisfies readonly Exclude<ProductionDraftReviewDecision, "pending">[];

const productionDraftExtractionRevisionCardKinds = [
  "event_data",
  "menu_component",
  "open_question"
] as const satisfies readonly ProductionDraftReviewCard["kind"][];

function canAccessProductionFeedback(
  reader: TrustedActor,
  feedback: ProductionFeedbackDraft
): boolean {
  if (!hasMinimalMvpCapability(reader, "production")) return false;
  if (canReadProductionCommercials(reader)) return true;
  if (!isTrustedFinalApprovalSource(feedback.createdBy.source)) return false;

  // Die gespeicherte Ersteller-Provenienz reicht an dieser engen Grenze aus:
  // Nur ein vertrauenswürdiger Produktions-Ersteller ohne Preisrecht ist sichtbar.
  const creator: TrustedActor = {
    name: feedback.createdBy.name,
    businessId: reader.businessId,
    source: feedback.createdBy.source,
    trusted: true
  };
  return hasMinimalMvpCapability(creator, "production") && !canReadProductionCommercials(creator);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function processingPolicyAuditDetails(policy: ByoLlmProcessingPolicyMetadata | undefined) {
  if (!policy) return {};
  return {
    policyApprovalId: policy.approvalId,
    policyBusinessId: policy.businessId,
    policyProviderKind: policy.providerKind,
    policyProviderModel: policy.providerModel,
    policyCapability: policy.capability,
    policyRegion: policy.actualRegion,
    policyEndpoint: policy.endpoint,
    policyMaximumEstimatedCostEur: policy.maximumEstimatedCostEur,
    policyRetentionPolicy: policy.retentionPolicy,
    policyTrainingUse: policy.trainingUse,
    policyPurpose: policy.purpose,
    policyDataClass: policy.dataClass,
    policyInputHash: policy.inputHash,
    policySourceHash: policy.sourceHash,
    policyProjectionHash: policy.projectionHash,
    policyOutputHash: policy.outputHash,
    policySuccessClass: policy.successClass
  };
}

function productionDraftImportValidationMessage(errorMessage: string): string {
  if (errorMessage.includes("review coverage missing")) {
    return "ProductionDraft deckt nicht alle übernehmbaren Artefakte mit Review-Karten ab.";
  }

  return "ProductionDraft ist nicht schema-valide.";
}

interface ProductionDraftDocumentBody {
  caseId?: unknown;
  documentId?: unknown;
}

interface ProductionDraftDocumentInput {
  caseId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  content: Buffer;
  sha256: string;
  ingestedAt: string;
}

interface ProductionDraftFromSpecBody {
  caseId?: unknown;
  specId?: unknown;
}

interface ProductionDraftFromHandoffBody {
  caseId?: unknown;
}

interface ProductionDraftExtractionComponent {
  label: string;
  course?: string;
  category?: "classic" | "vegetarian" | "vegan";
  note?: string;
}

interface ProductionDraftExtractionQuestion {
  field: string;
  message: string;
  suggestedQuestion?: string;
}

interface ProductionDraftExtraction {
  eventType?: string;
  serviceForm?: string;
  eventDate?: string;
  attendeeCount?: number;
  customerName?: string;
  venueName?: string;
  components: ProductionDraftExtractionComponent[];
  openQuestions: ProductionDraftExtractionQuestion[];
}

export interface ProductionArtifactRouteDependencies {
  store: ProductionStore;
  intakeRecords: IntakeRecordsPort;
  sourceDocumentReader?: SourceDocumentReader;
  discoveryService: RecipeDiscoveryService;
  auditLog: AuditLogStore;
  buildLlmAdapter: () => BoundaryGuardedLlmAdapter;
  productionDraftDataMode: LlmReadinessDataMode;
  handoffReader?: ProductionHandoffReader;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  isProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  requireProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => unknown | undefined;
  requireProductionReader: (
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
}

function normalizeOptionalText(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

function strictReferenceBody(
  value: unknown,
  requiredKeys: readonly string[]
): Record<string, string> | undefined {
  if (!isPlainRecord(value) || Object.keys(value).length !== requiredKeys.length) return undefined;
  if (!requiredKeys.every((key) => Object.hasOwn(value, key))) return undefined;
  const normalized = Object.fromEntries(requiredKeys.map((key) => [key, normalizeOptionalText(value[key], 240)]));
  if (requiredKeys.some((key) => !normalized[key])) return undefined;
  return normalized as Record<string, string>;
}

function productionDocumentDraftId(
  businessId: TrustedActor["businessId"],
  caseId: string,
  documentId: string
): string {
  // The document import is one case-scoped command. A stable identity lets a
  // retried request recover its persisted result without asking the provider again.
  const identityHash = createHash("sha256")
    .update(`${businessId}\0${caseId}\0${documentId}`)
    .digest("hex");
  return `production-draft-document-${identityHash}`;
}

function acceptedEventSpecFingerprint(spec: AcceptedEventSpec): string {
  return createHash("sha256")
    .update(stableJson(validateAcceptedEventSpec(spec)))
    .digest("hex");
}

function productionDraftIdForSpecImport(
  businessId: string,
  caseId: string,
  specId: string,
  specFingerprint: string
): string {
  const fingerprint = createHash("sha256")
    .update(`${businessId}\0${caseId}\0${specId}\0${specFingerprint}`)
    .digest("hex");
  return `production-draft-spec-${fingerprint}`;
}

function preparedProductionDraftId(
  businessId: string,
  sourceDraft: Pick<ProductionDraft, "draftId" | "revision">
): string {
  const fingerprint = createHash("sha256")
    .update(`${businessId}\0${sourceDraft.draftId}\0${sourceDraft.revision}\0prepare`)
    .digest("hex");
  return `production-draft-prepared-${fingerprint}`;
}

function preparedProductionDraftMatchesSource(
  sourceDraft: ProductionDraft,
  preparedDraft: ProductionDraft,
  expectedDraftId: string
): boolean {
  return (
    preparedDraft.draftId === expectedDraftId &&
    preparedDraft.businessId === sourceDraft.businessId &&
    preparedDraft.revision === sourceDraft.revision + 1 &&
    preparedDraft.status === "pending_review" &&
    preparedDraft.supersedesDraftId === sourceDraft.draftId &&
    areJsonValuesEqual(preparedDraft.draftArtifacts.eventSpec, sourceDraft.draftArtifacts.eventSpec) &&
    Boolean(preparedDraft.draftArtifacts.productionPlan) &&
    Boolean(preparedDraft.draftArtifacts.purchaseList)
  );
}

function productionDraftRevisionCommandIdentity(
  businessId: string,
  sourceDraft: Pick<ProductionDraft, "draftId" | "revision">,
  contextHash: string
): { draftId: string; inputId: string; agentAuditId: string } {
  const fingerprint = createHash("sha256")
    .update(`${businessId}\0${sourceDraft.draftId}\0${sourceDraft.revision}\0${contextHash}`)
    .digest("hex");
  return {
    draftId: `production-draft-revision-${fingerprint}`,
    inputId: `input-production-draft-revision-${fingerprint}`,
    agentAuditId: `agent-audit-production-draft-revision-${fingerprint}`
  };
}

async function appendProductionDraftRevisionEvent(
  store: ProductionStore,
  actor: TrustedActor,
  sourceDraft: ProductionDraft,
  revision: ProductionDraft,
  text: string
): Promise<void> {
  const caseId = await store.findCaseIdForArtifact(actor, sourceDraft.draftId);
  // Drafts created through the case routes always have a timeline. Older persisted
  // drafts may predate cases, so their established prepare/revise behavior must not
  // fail merely because there is no history projection to extend.
  if (!caseId) return;
  await appendArtifactEvent(store, actor, sourceDraft.draftId, {
    at: revision.createdAt,
    role: "assistant",
    kind: "revision_created",
    text,
    artifactId: revision.draftId,
    revisionRef: {
      artifactType: "ProductionDraft",
      artifactId: revision.draftId,
      revision: revision.revision,
      createdAt: revision.createdAt,
      supersedesArtifactId: sourceDraft.draftId
    }
  }, `revision:${revision.draftId}`);
  const caseUpdate = await store.reopenCaseForDraftContinuation(actor, caseId, revision.draftId);
  if (caseUpdate === "missing") {
    throw new Error("ProductionCase wurde nicht gefunden.");
  }
}

async function appendDraftCreatedEvent(
  store: ProductionStore,
  actor: TrustedActor,
  caseId: string,
  draft: ProductionDraft
): Promise<void> {
  await store.appendEvent(actor, caseId, {
    at: draft.createdAt,
    role: "assistant",
    kind: "draft_created",
    text: "Produktionsentwurf erstellt.",
    artifactId: draft.draftId,
    revisionRef: {
      artifactType: "ProductionDraft",
      artifactId: draft.draftId,
      revision: draft.revision,
      createdAt: draft.createdAt,
      ...(draft.supersedesDraftId ? { supersedesArtifactId: draft.supersedesDraftId } : {})
    }
  }, draft.draftId);
  const caseUpdate = await store.reopenCaseForDraftContinuation(actor, caseId, draft.draftId);
  if (caseUpdate === "missing") {
    throw new Error("ProductionCase wurde nicht gefunden.");
  }
}

async function productionDocumentDraftMatchesCaseSource(
  store: ProductionStore,
  actor: TrustedActor,
  caseId: string,
  documentId: string,
  draft: ProductionDraft
): Promise<boolean> {
  if (
    draft.draftId !== productionDocumentDraftId(actor.businessId, caseId, documentId) ||
    draft.revision < 1
  ) {
    return false;
  }

  if (draft.supersedesDraftId) {
    const superseded = await store.getProductionDraft(actor, draft.supersedesDraftId);
    const supersededCaseId = await store.findCaseIdForArtifact(actor, draft.supersedesDraftId);
    if (
      !superseded ||
      supersededCaseId !== caseId ||
      draft.revision !== superseded.revision + 1
    ) {
      return false;
    }
    const inheritedLineage = draft.draftArtifacts.eventSpec?.sourceLineage ?? [];
    if (!(superseded.draftArtifacts.eventSpec?.sourceLineage ?? []).every((source) =>
      inheritedLineage.some((candidate) => areJsonValuesEqual(candidate, source))
    )) {
      return false;
    }
  } else if (draft.revision !== 1) {
    return false;
  }

  const sourceEvent = (await store.listEvents(actor, caseId)).find((event) =>
    event.kind === "source_added" &&
    event.sourceId === documentId &&
    event.sourceRef?.documentId === documentId
  );
  const sourceRef = sourceEvent?.sourceRef;
  if (!sourceRef) return false;

  const expectedHash = `sha256:${sourceRef.sha256}`;
  return (
    draft.source.inputHash === expectedHash &&
    draft.source.sourceRef === `upload:${sourceRef.filename}` &&
    (draft.draftArtifacts.eventSpec?.sourceLineage ?? []).some((source) =>
      source.sourceType === "pdf" && source.reference === expectedHash
    )
  );
}

async function latestProductionDraftForCase(
  store: ProductionStore,
  actor: TrustedActor,
  caseId: string
): Promise<ProductionDraft | undefined> {
  const events = (await store.listEvents(actor, caseId)).slice().reverse();
  for (const event of events) {
    if (event.kind !== "draft_created" && event.kind !== "revision_created") continue;
    const draftId = event.revisionRef?.artifactId ?? event.artifactId;
    if (!draftId) continue;
    const draft = await store.getProductionDraft(actor, draftId);
    if (draft) return draft;
  }
  return undefined;
}

async function appendProductionDocumentCreatedAudit(
  auditLog: AuditLogStore,
  actor: TrustedActor,
  caseId: string,
  documentId: string,
  draft: ProductionDraft
): Promise<void> {
  await auditLog.logFor(actor, {
    action: "production.production_draft_document_created",
    entityType: "ProductionDraft",
    entityId: draft.draftId,
    actor,
    at: draft.createdAt,
    idempotencyKey: `production-document-draft:${draft.draftId}`,
    summary: "ProductionDraft aus Dokumentextraktion angelegt.",
    details: compactAuditDetails({
      draftId: draft.draftId,
      caseId,
      documentId,
      sourceSha256: draft.source.inputHash?.replace(/^sha256:/, ""),
      providerId: draft.source.providerId,
      modelId: draft.source.modelId,
      runId: draft.source.runId,
      reviewCardCount: draft.reviewCards.length,
      componentCount: draft.draftArtifacts.eventSpec?.menuPlan.length ?? 0,
      openQuestionCount: draft.draftArtifacts.openQuestions?.length ?? 0,
      outputTextHash: draft.source.outputHash,
      ...processingPolicyAuditDetails(draft.source.processingPolicy),
      humanApprovalRequired: true,
      writesProductObject: false
    })
  });
}

async function finalizeProductionDraftRevision(
  store: ProductionStore,
  auditLog: AuditLogStore,
  actor: TrustedActor,
  sourceDraft: ProductionDraft,
  revision: ProductionDraft,
  commandIdentity: ReturnType<typeof productionDraftRevisionCommandIdentity>,
  changeRequestCount: number,
  changeRequestHash: string
): Promise<void> {
  await appendProductionDraftRevisionEvent(
    store,
    actor,
    sourceDraft,
    revision,
    "Überarbeitete Produktionsrevision erstellt."
  );
  await auditLog.logFor(actor, {
    action: "production.production_draft_revision_created",
    entityType: "ProductionDraft",
    entityId: revision.draftId,
    actor,
    at: revision.createdAt,
    idempotencyKey: `production-draft-revision:${revision.draftId}`,
    summary: "Neue ProductionDraft-Revision zur Prüfung angelegt.",
    details: compactAuditDetails({
      draftId: revision.draftId,
      supersedesDraftId: sourceDraft.draftId,
      agentAuditId: commandIdentity.agentAuditId,
      inputId: commandIdentity.inputId,
      providerId: revision.source.providerId,
      providerRequestId: revision.source.runId,
      changeRequestCount,
      changeRequestHash,
      reviewCardCount: revision.reviewCards.length,
      ...processingPolicyAuditDetails(revision.source.processingPolicy),
      humanApprovalRequired: true,
      writesProductObject: false
    })
  });
}

async function appendSourceAddedEvent(
  store: ProductionStore,
  actor: TrustedActor,
  caseId: string,
  source: StoredSourceDocument
): Promise<void> {
  await store.appendEvent(actor, caseId, {
    at: source.createdAt,
    role: "system",
    kind: "source_added",
    text: "Quelldokument zum Produktionsauftrag hinzugefügt.",
    sourceId: source.documentId,
    sourceRef: {
      sourceId: source.documentId,
      documentId: source.documentId,
      filename: source.filename,
      mimeType: source.mimeType,
      sha256: source.sha256,
      dataClass: source.dataClass,
      addedAt: source.createdAt
    }
  }, source.documentId);
}

async function appendCaseErrorEvent(
  store: ProductionStore,
  actor: TrustedActor,
  caseId: string,
  text: string,
  sourceId?: string,
  eventIdentity?: string,
  at = new Date().toISOString()
): Promise<void> {
  await store.appendEvent(actor, caseId, {
    at,
    role: "system",
    kind: "error",
    text,
    ...(sourceId ? { sourceId } : {})
  }, eventIdentity);
}

async function appendArtifactEvent(
  store: ProductionStore,
  actor: TrustedActor,
  sourceArtifactId: string,
  input: Parameters<ProductionStore["appendEvent"]>[2],
  eventIdentity?: string
): Promise<void> {
  await store.appendEventForArtifactCase(actor, sourceArtifactId, input, eventIdentity);
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.trunc(value);
}

function normalizeMenuCategory(value: unknown): ProductionDraftExtractionComponent["category"] | undefined {
  return value === "classic" || value === "vegetarian" || value === "vegan" ? value : undefined;
}

function normalizedEvidenceText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function categoryEvidenceSupports(
  category: NonNullable<ProductionDraftExtractionComponent["category"]>,
  evidence: string | undefined,
  componentLabel: string,
  normalizedSourceText: string
): boolean {
  if (!evidence) {
    return false;
  }

  const normalizedEvidence = normalizedEvidenceText(evidence);
  const normalizedLabel = normalizedEvidenceText(componentLabel);
  if (
    !normalizedEvidence ||
    !normalizedEvidence.includes(normalizedLabel) ||
    !normalizedSourceText.includes(normalizedEvidence)
  ) {
    return false;
  }

  const categoryTokens = {
    classic: ["classic", "klassisch", "traditionell"],
    vegetarian: ["vegetarian", "vegetarisch"],
    vegan: ["vegan"]
  } as const;
  const supportedCategories = Object.entries(categoryTokens)
    .filter(([, tokens]) => tokens.some((token) => normalizedEvidence.includes(token)))
    .map(([supportedCategory]) => supportedCategory);

  return supportedCategories.length === 1 && supportedCategories[0] === category;
}

function slugifyForDraft(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

function parseProductionDraftExtraction(
  outputCandidate: LlmReadinessModelOutputCandidate | undefined,
  sourceText: string
): {
  extraction?: ProductionDraftExtraction;
  errors: string[];
} {
  const errors = validateLlmReadinessModelOutputCandidate(outputCandidate).errors.map((error) =>
    `outputCandidate.${error}`
  );
  if (!outputCandidate) {
    return { errors };
  }
  if (outputCandidate.kind !== "production_draft_extraction") {
    errors.push("outputCandidate.kind must be production_draft_extraction");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputCandidate.text);
  } catch {
    errors.push("outputCandidate.text must be valid production draft extraction JSON");
  }

  if (!isPlainRecord(parsed)) {
    errors.push("outputCandidate.text must contain a JSON object");
    return { errors: [...new Set(errors)] };
  }

  const unsupportedCategoryLabels: string[] = [];
  const normalizedSourceText = normalizedEvidenceText(sourceText);
  const rawComponents = Array.isArray(parsed.components) ? parsed.components : [];
  const components = rawComponents.flatMap((component, index): ProductionDraftExtractionComponent[] => {
    if (!isPlainRecord(component)) {
      errors.push(`components[${index}] must be an object`);
      return [];
    }
    const label = normalizeOptionalText(component.label, 320);
    if (!label) {
      errors.push(`components[${index}].label must be non-empty`);
      return [];
    }

    const claimedCategory = normalizeMenuCategory(component.category);
    const categoryEvidence = normalizeOptionalText(component.categoryEvidence, 500);
    const category = claimedCategory && categoryEvidenceSupports(
      claimedCategory,
      categoryEvidence,
      label,
      normalizedSourceText
    )
      ? claimedCategory
      : undefined;
    if (claimedCategory && !category) {
      unsupportedCategoryLabels.push(label);
    }

    return [{
      label,
      course: normalizeOptionalText(component.course, 80),
      category,
      note: normalizeOptionalText(component.note, 500)
    }];
  });

  const rawQuestions = Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [];
  const openQuestions = rawQuestions.flatMap((question, index): ProductionDraftExtractionQuestion[] => {
    if (!isPlainRecord(question)) {
      errors.push(`openQuestions[${index}] must be an object`);
      return [];
    }
    const field = normalizeOptionalText(question.field, 120);
    const message = normalizeOptionalText(question.message, 500);
    if (!field || !message) {
      errors.push(`openQuestions[${index}] needs field and message`);
      return [];
    }

    return [{
      field,
      message,
      suggestedQuestion: normalizeOptionalText(question.suggestedQuestion, 500)
    }];
  });

  if (
    unsupportedCategoryLabels.length > 0 &&
    !openQuestions.some((question) => question.field === "components.category")
  ) {
    const visibleLabels = unsupportedCategoryLabels.slice(0, 6);
    const remainingCount = unsupportedCategoryLabels.length - visibleLabels.length;
    openQuestions.push({
      field: "components.category",
      message: [
        `Ernährungsformen sind nicht eindeutig durch eine einzelne Quellenstelle belegt: ${visibleLabels.join(", ")}.`,
        remainingCount > 0 ? `${remainingCount} weitere Komponenten sind ebenfalls betroffen.` : ""
      ].filter(Boolean).join(" "),
      suggestedQuestion: "Welche Ernährungsformen sind für diese Komponenten ausdrücklich bestätigt?"
    });
  }

  if (components.length === 0 && openQuestions.length === 0) {
    errors.push("production draft extraction must contain components or openQuestions");
  }

  if (errors.length > 0) {
    return { errors: [...new Set(errors)] };
  }

  return {
    extraction: {
      eventType: normalizeOptionalText(parsed.eventType, 120),
      serviceForm: normalizeOptionalText(parsed.serviceForm, 120),
      eventDate: normalizeOptionalText(parsed.eventDate, 40),
      attendeeCount: normalizeOptionalNumber(parsed.attendeeCount),
      customerName: normalizeOptionalText(parsed.customerName, 240),
      venueName: normalizeOptionalText(parsed.venueName, 240),
      components,
      openQuestions
    },
    errors: []
  };
}

function productionDraftExtractionFailureMessage(errors: readonly string[]): string {
  const providerUnavailable = errors.some((error) =>
    error.includes("no synthetic fixture matches input") ||
    error.includes("provider calls require explicit synthetic-live opt-in")
  );

  return providerUnavailable
    ? "Keine aktive KI-Verbindung für dieses Dokument. Bitte einen BYO-KI-Provider aktivieren und den Entwurf erneut erstellen."
    : "ProductionDraft-Extraktion ist nicht schema-valide.";
}

function buildProductionDraftFromExtraction(input: {
  businessId: TrustedActor["businessId"];
  draftId?: string;
  revision: number;
  extraction: ProductionDraftExtraction;
  source: {
    filename: string;
    sha256: string;
    ingestedAt: string;
    dataClass: ByoLlmDataClass;
  };
  outputCandidate: LlmReadinessModelOutputCandidate;
  adapterResponse: LlmReadinessProviderAdapterResponse;
  supersedesDraftId?: string;
  inheritedSourceLineage?: AcceptedEventSpec["sourceLineage"];
}): ProductionDraft {
  const requestId = `production-draft-source-${input.source.sha256.slice(0, 16)}`;
  const eventRequest = createEventRequestFromManualForm({
    requestId,
    eventType: input.extraction.eventType ?? "Buffet",
    eventDate: input.extraction.eventDate,
    attendeeCount: input.extraction.attendeeCount,
    serviceForm: input.extraction.serviceForm ?? "Buffet",
    menuItems: input.extraction.components.map((component) => component.label),
    customerName: input.extraction.customerName,
    venueName: input.extraction.venueName,
    notes: "KI-Extraktion aus operatorfreigegebenem Angebotsdokument; fachliche Prüfung erforderlich."
  });
  const eventSpec = normalizeEventRequestToSpec(eventRequest, {
    sourceType: "pdf",
    reference: `sha256:${input.source.sha256}`,
    commercialState: "provisional"
  });
  const inheritedLineageKeys = new Set(
    (input.inheritedSourceLineage ?? []).map((source) => stableJson(source))
  );
  const sourceLineage = [
    ...(input.inheritedSourceLineage ?? []),
    ...eventSpec.sourceLineage.filter((source) => !inheritedLineageKeys.has(stableJson(source)))
  ];
  const menuPlan = input.extraction.components.map((component, index) => {
    const normalizedComponent = { ...eventSpec.menuPlan[index] };
    delete normalizedComponent.menuCategory;

    return {
      ...normalizedComponent,
      componentId: `${slugifyForDraft(component.label)}-${index + 1}`,
      label: component.label,
      course: component.course ?? eventSpec.menuPlan[index]?.course,
      ...(component.category ? { menuCategory: component.category } : {}),
      serviceStyle: input.extraction.serviceForm ?? eventSpec.servicePlan.serviceForm,
      servings: input.extraction.attendeeCount ?? eventSpec.attendees.expected,
      ...(component.note
        ? {
            productionDecision: {
              notes: component.note
            }
          }
        : {})
    };
  });
  const openQuestions = input.extraction.openQuestions.map((question) => ({
    field: question.field,
    message: question.message,
    severity: "medium" as const,
    suggestedQuestion: question.suggestedQuestion
  }));
  const draftEventSpec = validateAcceptedEventSpec({
    ...eventSpec,
    sourceLineage,
    menuPlan,
    uncertainties: openQuestions.length > 0
      ? [...(eventSpec.uncertainties ?? []), ...openQuestions]
      : eventSpec.uncertainties
  });
  const reviewCards: ProductionDraftReviewCard[] = [
    {
      cardId: "card-event-data",
      kind: "event_data",
      title: "Eventdaten aus PDF prüfen",
      summary: `${input.extraction.eventType ?? "Event"} · ${input.extraction.attendeeCount ?? "Personenzahl offen"} Personen · ${input.extraction.eventDate ?? "Datum offen"}`,
      decision: "pending",
      targetPath: "$.draftArtifacts.eventSpec",
      targetId: draftEventSpec.specId,
      requiredApproval: true
    },
    ...draftEventSpec.menuPlan.map((component, index): ProductionDraftReviewCard => ({
      cardId: `card-menu-component-${index + 1}`,
      kind: "menu_component",
      title: component.label,
      summary: "Menükomponente aus PDF-Extraktion prüfen; keine automatische Rezeptzuordnung.",
      decision: "pending",
      targetPath: `$.draftArtifacts.eventSpec.menuPlan[${index}]`,
      targetId: component.componentId,
      requiredApproval: true
    })),
    ...openQuestions.map((question, index): ProductionDraftReviewCard => ({
      cardId: `card-open-question-${index + 1}`,
      kind: "open_question",
      title: question.field,
      summary: question.suggestedQuestion ?? question.message,
      decision: "pending",
      riskLevel: "medium",
      requiredApproval: true
    }))
  ];

  return validateProductionDraft({
    schemaVersion: draftEventSpec.schemaVersion,
    businessId: input.businessId,
    draftId: input.draftId ?? `production-draft-${randomUUID()}`,
    revision: input.revision,
    status: "pending_review",
    createdAt: new Date().toISOString(),
    ...(input.supersedesDraftId ? { supersedesDraftId: input.supersedesDraftId } : {}),
    source: {
      kind: input.adapterResponse.providerId === "codex-cli"
        ? "agent_cli"
        : input.adapterResponse.adapterMode === "fixture_only"
          ? "fixture"
          : "ai_provider",
      receivedAt: input.source.ingestedAt,
      sourceRef: `upload:${input.source.filename}`,
      providerId: input.adapterResponse.providerId ?? input.adapterResponse.adapterId,
      modelId: input.adapterResponse.adapterMode,
      inputHash: `sha256:${input.source.sha256}`,
      outputHash: hashText(input.outputCandidate.text),
      runId: input.adapterResponse.providerRequestId,
      dataClass: input.source.dataClass,
      ...(input.adapterResponse.processingPolicy
        ? { processingPolicy: input.adapterResponse.processingPolicy }
        : {})
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards,
    draftArtifacts: {
      eventSpec: draftEventSpec,
      openQuestions
    }
  });
}

function productionDraftRevisionPromptContext(
  draft: ProductionDraft,
  changeRequests: readonly ProductionDraftReviewCard[]
): string {
  const eventSpec = draft.draftArtifacts.eventSpec;
  return [
    "Revisionsauftrag für einen vorhandenen, menschlich zu prüfenden ProductionDraft.",
    "Gib den vollständigen überarbeiteten Stand im production_draft_extraction-Format zurück.",
    "Behalte alle nicht beanstandeten Eventdaten, Menükomponenten und offenen Fragen bei.",
    "Ändere nur Punkte, die durch einen Operator-Kommentar verlangt werden. Erfinde nichts hinzu.",
    "",
    "Ausgangsentwurf:",
    stableJson({
      event: eventSpec?.event,
      attendees: eventSpec?.attendees,
      servicePlan: eventSpec?.servicePlan,
      menuPlan: eventSpec?.menuPlan,
      openQuestions: draft.draftArtifacts.openQuestions ?? eventSpec?.uncertainties ?? []
    }),
    "",
    "Verbindliche Änderungswünsche:",
    stableJson(changeRequests.map((card) => ({
      cardId: card.cardId,
      kind: card.kind,
      title: card.title,
      targetId: card.targetId,
      operatorComment: card.operatorComment
    })))
  ].join("\n");
}

function productionDraftRevisionCoverageErrors(
  draft: ProductionDraft,
  changeRequests: readonly ProductionDraftReviewCard[],
  extraction: ProductionDraftExtraction
): string[] {
  const changedTargetIds = new Set(
    changeRequests.map((card) => card.targetId).filter((targetId): targetId is string => Boolean(targetId))
  );
  const revisedLabels = new Set(extraction.components.map((component) => normalizedEvidenceText(component.label)));

  return (draft.draftArtifacts.eventSpec?.menuPlan ?? [])
    .filter((component) => !changedTargetIds.has(component.componentId))
    .filter((component) => !revisedLabels.has(normalizedEvidenceText(component.label)))
    .map((component) => `revision missing unchanged component: ${component.label}`);
}

export function registerProductionArtifactRoutes(
  app: FastifyInstance,
  deps: ProductionArtifactRouteDependencies
) {
  const {
    store,
    intakeRecords,
    sourceDocumentReader,
    discoveryService,
    auditLog,
    buildLlmAdapter,
    productionDraftDataMode,
    handoffReader,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    requireProductionReader,
    actorForRequest
  } = deps;
  const decisionRepository = productionDecisionRepositoryFor(store);

  const mutableDraftInScope = async (
    scope: ProductionDecisionTargetScope,
    expected: ProductionDraft
  ): Promise<ProductionDraft | undefined> => {
    const current = await scope.getDraft(expected.draftId);
    if (!current || current.status !== "pending_review" || !areJsonValuesEqual(current, expected)) return undefined;
    const target = {
      kind: "production_draft" as const,
      artifactId: expected.draftId,
      revision: expected.revision
    };
    const aggregate = await scope.getDecisionAggregate(
      approvalRequestIdForTarget({ businessId: expected.businessId, target })
    );
    if (aggregate || (await scope.listApprovalsForTarget()).length > 0) return undefined;
    return current;
  };

  const sameProductionDocumentDraftIdentity = (
    existing: ProductionDraft,
    candidate: ProductionDraft
  ): boolean => (
    existing.draftId === candidate.draftId &&
    existing.revision === candidate.revision &&
    existing.supersedesDraftId === candidate.supersedesDraftId &&
    existing.source.sourceRef === candidate.source.sourceRef &&
    existing.source.inputHash === candidate.source.inputHash &&
    areJsonValuesEqual(
      existing.draftArtifacts.eventSpec,
      candidate.draftArtifacts.eventSpec
    )
  );

  const insertProductionDraftInScope = async (
    scope: ProductionDecisionTargetScope,
    draft: ProductionDraft
  ): Promise<
    | { status: "committed"; value: ProductionDraft }
    | { status: "conflict" }
  > => {
    const existing = await scope.getDraft(draft.draftId);
    if (existing) {
      return sameProductionDocumentDraftIdentity(existing, draft)
        ? { status: "committed", value: existing }
        : { status: "conflict" };
    }
    const target = {
      kind: "production_draft" as const,
      artifactId: draft.draftId,
      revision: draft.revision
    };
    const aggregate = await scope.getDecisionAggregate(
      approvalRequestIdForTarget({ businessId: draft.businessId, target })
    );
    if (aggregate || (await scope.listApprovalsForTarget()).length > 0) {
      return { status: "conflict" };
    }
    const inserted = await scope.insertDraft(draft);
    const persisted = inserted === "created" ? draft : await scope.getDraft(draft.draftId);
    return persisted && sameProductionDocumentDraftIdentity(persisted, draft)
      ? { status: "committed", value: persisted }
      : { status: "conflict" };
  };

  const finishExistingProductionDocumentDraftInScope = async (
    scope: ProductionDecisionTargetScope,
    expectedDraft: ProductionDraft,
    supersededDraft?: ProductionDraft
  ): Promise<
    | { status: "committed"; value: ProductionDraft }
    | { status: "conflict" }
  > => {
    const persisted = await scope.getDraft(expectedDraft.draftId);
    if (!persisted || !sameProductionDocumentDraftIdentity(persisted, expectedDraft)) {
      return { status: "conflict" };
    }
    if (!supersededDraft) return { status: "committed", value: persisted };

    const currentSource = await scope.getDraft(supersededDraft.draftId);
    if (!currentSource || !areJsonValuesEqual(currentSource, supersededDraft)) {
      return { status: "conflict" };
    }
    if (currentSource.status === "pending_review") {
      if (!await mutableDraftInScope(scope, supersededDraft)) {
        return { status: "conflict" };
      }
      await scope.setDraft(validateProductionDraft({ ...supersededDraft, status: "superseded" }));
    }
    return { status: "committed", value: persisted };
  };

  app.post<{ Params: { handoffId: string }; Body: ProductionDraftFromHandoffBody }>("/v1/production/drafts/from-handoff/:handoffId", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) return forbidden;
    const body = strictReferenceBody(request.body, ["caseId"]);
    if (!body) return reply.code(422).send({ message: "caseId ist als einzige Referenz erforderlich." });
    if (!handoffReader) return reply.code(503).send({ message: "Angebotsübergabe ist nicht konfiguriert." });
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const productionCase = await store.getCase(actor, body.caseId);
    if (!productionCase) return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
    if (productionCase.productionHandoffId !== request.params.handoffId) {
      return reply.code(409).send({ message: "Produktionsauftrag gehört nicht zu dieser Angebotsübergabe." });
    }
    let handoff: ProductionHandoff | undefined;
    try { handoff = await handoffReader.get(actor, request.params.handoffId); }
    catch { return reply.code(502).send({ message: "Angebotsübergabe konnte nicht geladen werden." }); }
    if (!handoff) return reply.code(404).send({ message: "Produktionsübergabe nicht gefunden." });
    if (handoff.businessId !== actor.businessId || handoff.handoffId !== request.params.handoffId) {
      return reply.code(502).send({ message: "Angebotsübergabe passt nicht zum angeforderten Betriebskontext." });
    }
    const draftId = `production-draft-handoff-${handoff.handoffId}`;
    const draft = validateProductionDraft({
      schemaVersion: handoff.eventSpecSnapshot.schemaVersion, businessId: actor.businessId, draftId, revision: 1, status: "pending_review", createdAt: handoff.createdAt,
      source: { kind: "manual_import", receivedAt: handoff.createdAt, sourceRef: `offer-handoff:${handoff.handoffId}` },
      guardrails: { draftOnly: true, humanApprovalRequired: true, writesProductObjects: false, rawProviderPayloadStored: false, knowledgeWritePolicy: "reviewed_only" },
      reviewCards: [{ cardId: "card-event-handoff", kind: "event_data", title: "Freigegebenes Angebot prüfen", summary: "Unveränderliche Angebotsübergabe für die Produktionsprüfung.", decision: "pending", targetPath: "$.draftArtifacts.eventSpec", targetId: handoff.eventSpecSnapshot.specId, requiredApproval: true }],
      draftArtifacts: { eventSpec: handoff.eventSpecSnapshot }
    });
    const inserted = await store.insertProductionDraft(actor, draft);
    if (inserted === "exists") {
      const existing = await store.getProductionDraft(actor, draftId);
      if (!areJsonValuesEqual(existing, draft)) {
        return reply.code(409).send({ message: "Bestehender ProductionDraft stimmt nicht mit der angeforderten Angebotsübergabe überein." });
      }
    }
    await appendDraftCreatedEvent(store, actor, body.caseId, draft);
    await auditLog.logFor(actor, {
      action: "production.draft_created_from_handoff", entityType: "ProductionDraft", entityId: draft.draftId,
      actor, at: draft.createdAt, idempotencyKey: `production-draft-from-handoff:${draft.draftId}`,
      summary: "ProductionDraft aus unveränderlicher Angebotsübergabe angelegt.",
      details: { handoffId: handoff.handoffId }
    });
    return reply.code(201).send({ draft: projectProductionDraft(actor, draft) });
  });

  app.get("/v1/production/plans", async (request, reply) => {
    const forbidden = requireProductionReader(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return reply.send({
      access: {
        canOperateProduction: hasMinimalMvpCapability(actor, "production")
      },
      items: (await store.listPlans(actor)).map((plan) => projectProductionPlanReadResponse(actor, plan))
    });
  });

  app.get<{ Params: { planId: string } }>("/v1/production/plans/:planId", async (request, reply) => {
    const forbidden = requireProductionReader(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const plan = await store.getPlan(actor, request.params.planId);
    if (!plan) {
      return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
    }

    return reply.send(projectProductionPlanReadResponse(actor, plan));
  });

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/production/purchase-lists/:purchaseListId",
    async (request, reply) => {
      const forbidden = requireProductionReader(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const list = await store.getPurchaseList(actor, request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList nicht gefunden." });
      }

      return reply.send(projectPurchaseListReadResponse(actor, list));
    }
  );

  app.get("/v1/production/purchase-lists", async (request, reply) => {
    const forbidden = requireProductionReader(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return reply.send({
      items: (await store.listPurchaseLists(actor)).map((list) => projectPurchaseListReadResponse(actor, list))
    });
  });

  app.post<{ Body: ProductionDraftDocumentBody }>(
    "/v1/production/drafts/from-document",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const body = strictReferenceBody(request.body, ["caseId", "documentId"]);
      if (!body) {
        return reply.code(422).send({ message: "caseId und documentId sind als einzige Referenzen erforderlich." });
      }
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const productionCase = await store.getCase(actor, body.caseId);
      if (!productionCase) {
        return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
      }
      const documentDraftId = productionDocumentDraftId(
        actor.businessId,
        body.caseId,
        body.documentId
      );
      const existingDraft = await store.getProductionDraft(actor, documentDraftId);
      if (existingDraft) {
        const nextSourceSpecId = existingDraft.draftArtifacts.eventSpec?.specId;
        const supersededDraft = existingDraft.supersedesDraftId
          ? await store.getProductionDraft(actor, existingDraft.supersedesDraftId)
          : undefined;
        if (!nextSourceSpecId || (existingDraft.supersedesDraftId && !supersededDraft)) {
          return reply.code(409).send({
            message: "Bestehender ProductionDraft besitzt keine eindeutige Spezifikationslinie."
          });
        }
        const caseCommit = await store.commitDraftForCaseSource(actor, {
          caseId: body.caseId,
          expectedSourceSpecId: supersededDraft?.draftArtifacts.eventSpec?.specId,
          nextSourceSpecId,
          at: existingDraft.createdAt,
          draftTarget: supersededDraft
            ? {
              kind: "production_draft",
              artifactId: supersededDraft.draftId,
              revision: supersededDraft.revision
            }
            : {
              kind: "production_draft",
              artifactId: existingDraft.draftId,
              revision: existingDraft.revision
            },
          commitDraft: (scope) => finishExistingProductionDocumentDraftInScope(
            scope,
            existingDraft,
            supersededDraft
          )
        });
        if (caseCommit.status === "case_missing") {
          return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
        }
        if (caseCommit.status === "case_conflict") {
          return reply.code(409).send({
            message: "Produktionsauftrag ist bereits an eine andere Spezifikation gebunden."
          });
        }
        if (caseCommit.status === "draft_conflict") {
          return reply.code(409).send({
            message: "Bestehender ProductionDraft stimmt nicht mit dem Quelldokument überein."
          });
        }
        if (!await productionDocumentDraftMatchesCaseSource(
          store,
          actor,
          body.caseId,
          body.documentId,
          existingDraft
        )) {
          return reply.code(409).send({
            message: "Bestehender ProductionDraft passt nicht zum Quelldokument dieses Auftrags."
          });
        }
        await appendDraftCreatedEvent(store, actor, body.caseId, existingDraft);
        await appendProductionDocumentCreatedAudit(
          auditLog,
          actor,
          body.caseId,
          body.documentId,
          existingDraft
        );
        return reply.code(201).send({ draft: projectProductionDraft(actor, existingDraft) });
      }
      if (!sourceDocumentReader) {
        return reply.code(503).send({ message: "Quelldokumente sind nicht konfiguriert." });
      }

      let document: ProductionDraftDocumentInput;
      let storedSource: StoredSourceDocument;
      try {
        const [metadata, contentBytes] = await Promise.all([
          sourceDocumentReader.getMetadata(actor, body.documentId),
          sourceDocumentReader.getContent(actor, body.documentId)
        ]);
        if (!metadata || !contentBytes) {
          return reply.code(404).send({ message: "Quelldokument nicht gefunden." });
        }
        storedSource = metadata;
        const content = Buffer.from(contentBytes);
        const observedSha256 = createHash("sha256").update(content).digest("hex");
        if (
          metadata.businessId !== actor.businessId ||
          metadata.documentId !== body.documentId ||
          metadata.sizeBytes !== content.byteLength ||
          metadata.sha256 !== observedSha256
        ) {
          return reply.code(502).send({ message: "Quelldokument stimmt nicht mit seinen Metadaten überein." });
        }
        document = {
          caseId: body.caseId,
          documentId: body.documentId,
          filename: metadata.filename,
          mimeType: metadata.mimeType,
          content,
          sha256: metadata.sha256,
          ingestedAt: metadata.createdAt
        };
        validateUploadedDocument(document, "intake");
      } catch (error) {
        if (error instanceof Error && error.message.includes("Quelldokument")) {
          return reply.code(502).send({ message: "Quelldokument konnte nicht geladen werden." });
        }
        const uploadError = uploadErrorResponse(error, "intake");
        return reply.code(uploadError.statusCode).send({ message: uploadError.message });
      }

      const sourceMetadata = createUploadSourceMetadata({
        filename: document.filename,
        mimeType: document.mimeType,
        content: document.content,
        uploadContext: "production",
        ingestedAt: document.ingestedAt
      });
      if (sourceMetadata.sha256 !== document.sha256) {
        return reply.code(502).send({ message: "Quelldokument stimmt nicht mit seinen Metadaten überein." });
      }
      const ingestion = await ingestDocument({
        document: {
          ...document,
          sourceMetadata
        },
        context: "production"
      });
      await appendSourceAddedEvent(store, actor, document.caseId, storedSource);

      if (ingestion.status !== "extracted" || !ingestion.extractedText?.trim()) {
        await appendCaseErrorEvent(
          store,
          actor,
          document.caseId,
          "Quelldokument konnte nicht sicher gelesen werden.",
          document.documentId,
          `document-ingestion:${document.documentId}`,
          document.ingestedAt
        );
        return reply.code(422).send({
          message: "Angebotsdokument konnte nicht sicher als Text gelesen werden.",
          errors: ingestion.warnings
        });
      }

      const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("production_draft_request");
      if (!promptSchema) {
        return reply.code(500).send({ message: "Prompt-Schema für ProductionDraft-Extraktion nicht registriert." });
      }

      const input: LlmReadinessModelInput = {
        contractVersion: llmReadinessContractVersion,
        inputId: `input-production-draft-${sourceMetadata.sha256.slice(0, 16)}`,
        kind: "production_draft_request",
        sourceRefs: [
          {
            objectType: "safe_source_anchor",
            objectId: `sha256:${sourceMetadata.sha256}`,
            label: sourceMetadata.filename
          }
        ],
        policy: {
          providerCalls: "disabled",
          dataMode: productionDraftDataMode,
          allowedToolEffects: ["read", "draft"]
        }
      };
      const adapterRequest: LlmReadinessProviderAdapterRequest = {
        input,
        promptSchemaId: promptSchema.promptSchemaId,
        promptContext: ingestion.extractedText
      };
      const draftSeed = documentDraftId;

      let adapter: BoundaryGuardedLlmAdapter;
      try {
        adapter = buildLlmAdapter();
      } catch (error) {
        await appendCaseErrorEvent(
          store,
          actor,
          document.caseId,
          "KI-Verbindung konnte nicht gestartet werden.",
          document.documentId,
          `document-adapter-startup:${document.documentId}`,
          document.ingestedAt
        );
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "BYO-LLM-Adapter konnte nicht gestartet werden."
        });
      }

      const adapterResponse = await adapter.execute(adapterRequest, {
        businessId: actor.businessId,
        dataClass: storedSource.dataClass,
        purpose: "production_draft_extraction"
      }).catch(async (error: unknown) => {
        await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
          action: "production.production_draft_document_rejected",
          entityType: "ProductionDraft",
          entityId: draftSeed,
          actor,
          summary: "ProductionDraft-Extraktion aus Dokument verworfen.",
          details: compactAuditDetails({
            inputId: input.inputId,
            adapterId: adapter.adapterId,
            adapterMode: adapter.adapterMode,
            promptSchemaId: promptSchema.promptSchemaId,
            dataMode: input.policy.dataMode,
            sourceSha256: sourceMetadata.sha256,
            errorCount: 1,
            errorType: error instanceof Error ? error.name : typeof error
          }),
          idempotencyKey: `production-document-draft-rejected:${documentDraftId}:provider`
        });
        await appendCaseErrorEvent(
          store,
          actor,
          document.caseId,
          "KI-Entwurf konnte nicht erstellt werden.",
          document.documentId,
          `document-provider-error:${document.documentId}`,
          document.ingestedAt
        );
        return undefined;
      });
      if (!adapterResponse) {
        return reply.code(422).send({
          message: "ProductionDraft-Extraktion konnte nicht erzeugt werden.",
          errors: ["BYO-LLM-Aufruf ist fehlgeschlagen."]
        });
      }

      const auditBuild = createLlmReadinessAgentAuditRecord({
        auditId: `agent-audit-${draftSeed}`,
        request: adapterRequest,
        response: adapterResponse
      });
      const extractionBuild = parseProductionDraftExtraction(
        adapterResponse.outputCandidate,
        ingestion.extractedText
      );
      const responseErrors = [
        ...(adapterResponse.ok ? [] : adapterResponse.errors),
        ...extractionBuild.errors,
        ...auditBuild.errors.map((error) => `agentAudit.${error}`)
      ];

      if (!adapterResponse.ok || responseErrors.length > 0 || !extractionBuild.extraction || !auditBuild.auditRecord) {
        await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
          action: "production.production_draft_document_rejected",
          entityType: "ProductionDraft",
          entityId: draftSeed,
          actor,
          summary: "ProductionDraft-Extraktion aus Dokument verworfen.",
          details: compactAuditDetails({
            inputId: input.inputId,
            adapterId: adapterResponse.adapterId,
            adapterMode: adapterResponse.adapterMode,
            promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
            dataMode: input.policy.dataMode,
            providerId: adapterResponse.providerId,
            providerRequestId: adapterResponse.providerRequestId,
            sourceSha256: sourceMetadata.sha256,
            errorCount: responseErrors.length,
            ...processingPolicyAuditDetails(adapterResponse.processingPolicy)
          }),
          idempotencyKey: `production-document-draft-rejected:${documentDraftId}:validation`
        });
        await appendCaseErrorEvent(
          store,
          actor,
          document.caseId,
          "KI-Entwurf war nicht prüfbar und wurde verworfen.",
          document.documentId,
          `document-validation-error:${document.documentId}`,
          document.ingestedAt
        );
        return reply.code(422).send({
          message: productionDraftExtractionFailureMessage(responseErrors),
          errors: [...new Set(responseErrors)]
        });
      }

      const previousDraft = await latestProductionDraftForCase(store, actor, document.caseId);
      const draft = validateProductionDraft({
        ...buildProductionDraftFromExtraction({
          businessId: actor.businessId,
          draftId: documentDraftId,
          revision: (previousDraft?.revision ?? 0) + 1,
          extraction: extractionBuild.extraction,
          source: {
            filename: sourceMetadata.filename,
            sha256: sourceMetadata.sha256,
            ingestedAt: sourceMetadata.ingestedAt,
            dataClass: storedSource.dataClass
          },
          outputCandidate: adapterResponse.outputCandidate!,
          adapterResponse,
          ...(previousDraft
            ? {
              supersedesDraftId: previousDraft.draftId,
              inheritedSourceLineage: previousDraft.draftArtifacts.eventSpec?.sourceLineage
            }
            : {})
        }),
        businessId: actor.businessId
      });
      const sourceSpecId = draft.draftArtifacts.eventSpec?.specId;
      if (!sourceSpecId) {
        return reply.code(422).send({
          message: "ProductionDraft enthält keine bindbare Veranstaltungsspezifikation."
        });
      }
      const draftTarget = previousDraft
        ? {
          kind: "production_draft" as const,
          artifactId: previousDraft.draftId,
          revision: previousDraft.revision
        }
        : {
          kind: "production_draft" as const,
          artifactId: draft.draftId,
          revision: draft.revision
        };
      const caseCommit = await store.commitDraftForCaseSource(actor, {
        caseId: document.caseId,
        expectedSourceSpecId: productionCase.sourceSpecId,
        nextSourceSpecId: sourceSpecId,
        at: draft.createdAt,
        draftTarget,
        commitDraft: async (scope) => {
          if (!previousDraft) return insertProductionDraftInScope(scope, draft);

          const existingContinuation = await scope.getDraft(draft.draftId);
          const currentSource = await scope.getDraft(previousDraft.draftId);
          if (!currentSource || !areJsonValuesEqual(currentSource, previousDraft)) {
            return { status: "conflict" as const };
          }
          if (existingContinuation) {
            return finishExistingProductionDocumentDraftInScope(scope, draft, previousDraft);
          }
          if (
            currentSource.status === "pending_review" &&
            !await mutableDraftInScope(scope, previousDraft)
          ) {
            return { status: "conflict" as const };
          }
          if (currentSource.status === "superseded") {
            return { status: "conflict" as const };
          }
          const inserted = await scope.insertDraft(draft);
          const persisted = inserted === "created" ? draft : await scope.getDraft(draft.draftId);
          if (!persisted || !sameProductionDocumentDraftIdentity(persisted, draft)) {
            return { status: "conflict" as const };
          }
          // Pending work is replaced by the correction. Approved or rejected history remains
          // immutable evidence and is only referenced by the new continuation.
          if (currentSource.status === "pending_review") {
            await scope.setDraft(validateProductionDraft({ ...previousDraft, status: "superseded" }));
          }
          return { status: "committed" as const, value: persisted };
        }
      });
      if (caseCommit.status === "case_missing") {
        return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
      }
      if (caseCommit.status === "case_conflict") {
        return reply.code(409).send({
          message: "Produktionsauftrag ist bereits an eine andere Spezifikation gebunden."
        });
      }
      if (caseCommit.status === "draft_conflict") {
        return reply.code(409).send({
          message: previousDraft
            ? "Der vorherige ProductionDraft wurde während der Dokumentkorrektur verändert oder entschieden."
            : "ProductionDraft konnte nicht eindeutig gespeichert werden."
        });
      }
      const persistedDraft = caseCommit.value;
      if (!await productionDocumentDraftMatchesCaseSource(
        store,
        actor,
        document.caseId,
        document.documentId,
        persistedDraft
      )) {
        return reply.code(409).send({
          message: "Bestehender ProductionDraft passt nicht zum Quelldokument dieses Auftrags."
        });
      }
      await appendDraftCreatedEvent(store, actor, document.caseId, persistedDraft);
      await appendProductionDocumentCreatedAudit(
        auditLog,
        actor,
        document.caseId,
        document.documentId,
        persistedDraft
      );

      return reply.code(201).send({ draft: projectProductionDraft(actor, persistedDraft) });
    }
  );

  app.post<{ Body: ProductionDraftFromSpecBody }>("/v1/production/drafts", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const body = strictReferenceBody(request.body, ["caseId", "specId"]);
    if (!body) {
      return reply.code(422).send({ message: "caseId und specId sind als einzige Referenzen erforderlich." });
    }
    if (!await store.getCase(actor, body.caseId)) {
      return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
    }

    let spec: AcceptedEventSpec | undefined;
    try {
      spec = await intakeRecords.getSpec(actor, body.specId);
    } catch {
      return reply.code(502).send({ message: "AcceptedEventSpec konnte nicht geladen werden." });
    }
    if (!spec) {
      return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
    }
    if (spec.specId !== body.specId) {
      return reply.code(502).send({ message: "AcceptedEventSpec passt nicht zur angeforderten Identität." });
    }

    const specFingerprint = acceptedEventSpecFingerprint(spec);
    const draftId = productionDraftIdForSpecImport(
      actor.businessId,
      body.caseId,
      spec.specId,
      specFingerprint
    );
    const now = new Date().toISOString();
    const candidate = validateProductionDraft({
      schemaVersion: spec.schemaVersion,
      businessId: actor.businessId,
      draftId,
      revision: 1,
      status: "pending_review",
      createdAt: now,
      source: {
        kind: "manual_import",
        receivedAt: now,
        sourceRef: `accepted-event-spec:${spec.specId}`,
        inputHash: `sha256:${specFingerprint}`
      },
      guardrails: {
        draftOnly: true,
        humanApprovalRequired: true,
        writesProductObjects: false,
        rawProviderPayloadStored: false,
        knowledgeWritePolicy: "reviewed_only"
      },
      reviewCards: [{
        cardId: "card-event-spec",
        kind: "event_data",
        title: "Veranstaltungsdaten prüfen",
        summary: "Kanonische Spezifikation für die Produktionsprüfung.",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: spec.specId,
        requiredApproval: true
      }],
      draftArtifacts: { eventSpec: spec }
    });
    const matchesSpecImport = (draft: ProductionDraft | undefined): draft is ProductionDraft => Boolean(
      draft &&
      draft.source.sourceRef === `accepted-event-spec:${spec.specId}` &&
      draft.source.inputHash === `sha256:${specFingerprint}` &&
      areJsonValuesEqual(draft.draftArtifacts.eventSpec, spec)
    );
    const caseCommit = await store.commitDraftForCaseSource<ProductionDraft>(actor, {
      caseId: body.caseId,
      expectedSourceSpecId: undefined,
      nextSourceSpecId: spec.specId,
      at: now,
      draftTarget: {
        kind: "production_draft",
        artifactId: candidate.draftId,
        revision: candidate.revision
      },
      commitDraft: async (scope) => {
        const existing = await scope.getDraft(candidate.draftId);
        if (existing) {
          return matchesSpecImport(existing)
            ? { status: "committed" as const, value: existing }
            : { status: "conflict" as const };
        }
        const target = {
          kind: "production_draft" as const,
          artifactId: candidate.draftId,
          revision: candidate.revision
        };
        const aggregate = await scope.getDecisionAggregate(
          approvalRequestIdForTarget({ businessId: actor.businessId, target })
        );
        if (aggregate || (await scope.listApprovalsForTarget()).length > 0) {
          return { status: "conflict" as const };
        }
        const inserted = await scope.insertDraft(candidate);
        const persisted = inserted === "created" ? candidate : await scope.getDraft(candidate.draftId);
        return matchesSpecImport(persisted)
          ? { status: "committed" as const, value: persisted }
          : { status: "conflict" as const };
      }
    });
    if (caseCommit.status === "case_missing") {
      return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
    }
    if (caseCommit.status === "case_conflict") {
      return reply.code(409).send({
        message: "Produktionsauftrag ist bereits an eine andere Spezifikation gebunden."
      });
    }
    if (caseCommit.status === "draft_conflict") {
      return reply.code(409).send({
        message: "AcceptedEventSpec stimmt nicht mit dem bestehenden Entwurf überein."
      });
    }
    const draft = caseCommit.value;
    await appendDraftCreatedEvent(store, actor, body.caseId, draft);
    await auditLog.logFor(actor, {
      action: "production.production_draft_imported",
      entityType: "ProductionDraft",
      entityId: draft.draftId,
      actor,
      at: draft.createdAt,
      idempotencyKey: `spec-import:${draft.draftId}`,
      summary: "ProductionDraft importiert und zur Review vorgemerkt.",
      details: compactAuditDetails({
        draftId: draft.draftId,
        status: draft.status,
        specId: spec.specId,
        specFingerprint,
        reviewCardCount: draft.reviewCards.length,
        humanApprovalRequired: draft.guardrails.humanApprovalRequired,
        writesProductObject: draft.guardrails.writesProductObjects
      })
    });

    return reply.code(201).send({ draft: projectProductionDraft(actor, draft) });
  });

  app.get<{ Querystring: { caseId?: string } }>("/v1/production/drafts", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const requestedCaseId = request.query?.caseId;
    const [items, approvedProductionSpecs, applyManifests] = await Promise.all([
      store.listProductionDrafts(actor, requestedCaseId),
      store.listApprovedProductionSpecs(actor),
      store.listApplyManifests(actor)
    ]);
    const scopedDraftIds = requestedCaseId === undefined
      ? undefined
      : new Set(items.map((draft) => draft.draftId));
    const appliedIds = new Set(applyManifests.map((manifest) => manifest.approvedProductionSpecId));
    return reply.send({
      items: items.map((item) => projectProductionDraft(actor, item)),
      approvedProductionSpecs: approvedProductionSpecs
        .filter((spec) => scopedDraftIds === undefined || scopedDraftIds.has(spec.sourceDraft.draftId))
        .map((spec) => ({
        approvedProductionSpecId: spec.approvedProductionSpecId,
        sourceDraft: spec.sourceDraft,
        applied: appliedIds.has(spec.approvedProductionSpecId)
        }))
    });
  });

  app.post<{ Params: { draftId: string } }>(
    "/v1/production/drafts/:draftId/prepare",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) return forbidden;
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft = await store.getProductionDraft(actor, request.params.draftId);
      if (!draft) return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      const eventSpec = draft.draftArtifacts.eventSpec;
      if (!eventSpec) {
        return reply.code(422).send({
          message: "ProductionDraft benötigt vor der Vorbereitung vollständige Eventdaten.",
          errors: ["draftArtifacts.eventSpec is required"]
        });
      }
      const target = {
        kind: "production_draft" as const,
        artifactId: draft.draftId,
        revision: draft.revision
      };
      const preparedDraftId = preparedProductionDraftId(actor.businessId, draft);
      const existingPreparedDraft = await store.getProductionDraft(actor, preparedDraftId);
      if (existingPreparedDraft) {
        if (!preparedProductionDraftMatchesSource(draft, existingPreparedDraft, preparedDraftId)) {
          return reply.code(409).send({
            message: "Die gespeicherte Produktionsvorbereitung passt nicht eindeutig zum Ausgangsentwurf."
          });
        }
        const recovered = await decisionRepository.withTargetCriticalSection(actor, target, async (scope) => {
          const current = await scope.getDraft(draft.draftId);
          if (current?.status === "superseded") return true;
          if (!await mutableDraftInScope(scope, draft)) return false;
          await scope.setDraft(validateProductionDraft({ ...draft, status: "superseded" }));
          return true;
        });
        if (!recovered) {
          return reply.code(409).send({
            message: "ProductionDraft wurde während der Vorbereitung verändert oder entschieden."
          });
        }
        await appendProductionDraftRevisionEvent(
          store,
          actor,
          draft,
          existingPreparedDraft,
          "Vollständige Produktionsrevision zur Prüfung erstellt."
        );
        return reply.code(201).send({ draft: projectProductionDraft(actor, existingPreparedDraft) });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "Nur ein offener ProductionDraft kann vorbereitet werden." });
      }

      const artifacts = await buildProductionArtifacts(eventSpec, discoveryService, {
        context: actor,
        persistDiscoveredRecipes: false
      });
      const selectedRecipeIds = [...new Set(
        artifacts.productionPlan.recipeSelections
          .map((selection) => selection.recipeId)
          .filter((recipeId): recipeId is string => Boolean(recipeId))
      )];
      const recipes = artifacts.recipes;
      const missingRecipeIds = selectedRecipeIds.filter((recipeId) =>
        !recipes.some((recipe) => recipe.recipeId === recipeId)
      );
      const planningBlockingIssues = [...new Set(artifacts.productionPlan.blockingIssues ?? [])];
      const prepared = validateProductionDraft({
        ...draft,
        draftId: preparedDraftId,
        revision: draft.revision + 1,
        status: "pending_review",
        createdAt: new Date().toISOString(),
        supersedesDraftId: draft.draftId,
        approvalRequestId: undefined,
        approvedBy: undefined,
        approvedAt: undefined,
        reviewCards: [
          {
            cardId: "card-prepared-event-spec",
            kind: "event_data",
            title: "Eventdaten prüfen",
            summary: "Eventdaten des vollständigen Produktions-Snapshots prüfen.",
            decision: "pending",
            targetPath: "$.draftArtifacts.eventSpec",
            targetId: eventSpec.specId,
            requiredApproval: true
          },
          {
            cardId: "card-prepared-production-plan",
            kind: "timeline",
            title: "Produktionsplan prüfen",
            summary: "Mengen, Ablauf und Produktionsblätter prüfen.",
            decision: "pending",
            targetPath: "$.draftArtifacts.productionPlan",
            targetId: artifacts.productionPlan.planId,
            requiredApproval: true
          },
          {
            cardId: "card-prepared-purchase-list",
            kind: "purchase_item",
            title: "Einkaufsliste prüfen",
            summary: "Aggregierte Einkaufsmengen prüfen.",
            decision: "pending",
            targetPath: "$.draftArtifacts.purchaseList",
            targetId: artifacts.purchaseList.purchaseListId,
            requiredApproval: true
          },
          ...recipes.map((recipe, index): ProductionDraftReviewCard => ({
            cardId: `card-prepared-recipe-${index + 1}`,
            kind: "recipe",
            title: recipe.name,
            summary: "Rezept-Snapshot und Skalierung prüfen.",
            decision: "pending",
            targetPath: `$.draftArtifacts.recipes[${index}]`,
            targetId: recipe.recipeId,
            requiredApproval: true
          })),
          ...missingRecipeIds.map((recipeId, index): ProductionDraftReviewCard => ({
            cardId: `card-missing-recipe-${index + 1}`,
            kind: "recipe",
            title: "Rezept-Snapshot fehlt",
            summary: `Rezept ${recipeId} muss vor der Freigabe als vollständiger Snapshot vorliegen.`,
            decision: "pending",
            targetId: recipeId,
            riskLevel: "blocking",
            requiredApproval: true
          })),
          ...planningBlockingIssues.map((issue, index): ProductionDraftReviewCard => ({
            cardId: `card-planning-blocker-${index + 1}`,
            kind: "risk",
            title: "Planungshindernis prüfen",
            summary: issue,
            decision: "pending",
            targetPath: `$.draftArtifacts.productionPlan.blockingIssues[${index}]`,
            riskLevel: "blocking",
            requiredApproval: true
          }))
        ],
        draftArtifacts: {
          eventSpec,
          productionPlan: artifacts.productionPlan,
          purchaseList: artifacts.purchaseList,
          recipes,
          ...(missingRecipeIds.length > 0 || planningBlockingIssues.length > 0
            ? {
              openQuestions: [
                ...missingRecipeIds.map((recipeId) => ({
                  field: `recipe.${recipeId}`,
                  message: "Vollständiger Rezept-Snapshot fehlt.",
                  severity: "high" as const,
                  suggestedQuestion: `Welches geprüfte Rezept soll ${recipeId} ersetzen?`
                })),
                ...planningBlockingIssues.map((issue, index) => ({
                  field: `productionPlan.blockingIssues.${index}`,
                  message: issue,
                  severity: "high" as const,
                  suggestedQuestion: "Wie soll dieses Planungshindernis fachlich aufgelöst werden?"
                }))
              ]
            }
            : {})
        }
      });
      const committed = await decisionRepository.withTargetCriticalSection(actor, target, async (scope) => {
        if (!await mutableDraftInScope(scope, draft)) return false;
        const inserted = await scope.insertDraft(prepared);
        if (inserted === "exists") {
          const existing = await scope.getDraft(prepared.draftId);
          if (!areJsonValuesEqual(existing, prepared)) return false;
        }
        await scope.setDraft(validateProductionDraft({ ...draft, status: "superseded" }));
        return true;
      });
      if (!committed) {
        const racedPreparedDraft = await store.getProductionDraft(actor, preparedDraftId);
        if (racedPreparedDraft && preparedProductionDraftMatchesSource(draft, racedPreparedDraft, preparedDraftId)) {
          await appendProductionDraftRevisionEvent(
            store,
            actor,
            draft,
            racedPreparedDraft,
            "Vollständige Produktionsrevision zur Prüfung erstellt."
          );
          return reply.code(201).send({ draft: projectProductionDraft(actor, racedPreparedDraft) });
        }
        return reply.code(409).send({
          message: "ProductionDraft wurde während der Vorbereitung verändert oder entschieden."
        });
      }
      await appendProductionDraftRevisionEvent(
        store,
        actor,
        draft,
        prepared,
        "Vollständige Produktionsrevision zur Prüfung erstellt."
      );
      return reply.code(201).send({ draft: projectProductionDraft(actor, prepared) });
    }
  );

  app.patch<{
    Params: { draftId: string; cardId: string };
    Body: { decision?: unknown; operatorComment?: unknown };
  }>(
    "/v1/production/drafts/:draftId/review-cards/:cardId",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const decision = productionDraftReviewDecisionFromBody(request.body?.decision);
      if (!decision) {
        return reply.code(400).send({
          message: "decision muss fits, change_requested, unclear oder blocked sein."
        });
      }

      const operatorComment = operatorCommentFromBody(request.body?.operatorComment);
      if (operatorComment === false) {
        return reply.code(400).send({
          message: "operatorComment muss Text mit maximal 1000 Zeichen sein."
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft = await store.getProductionDraft(actor, request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ProductionDraft wurde bereits entschieden." });
      }

      const target = {
        kind: "production_draft" as const,
        artifactId: draft.draftId,
        revision: draft.revision
      };
      const reviewResult = await decisionRepository.withTargetCriticalSection(actor, target, async (scope) => {
        const current = await mutableDraftInScope(scope, draft);
        if (!current) return { kind: "conflict" as const };
        const cardIndex = current.reviewCards.findIndex((card) => card.cardId === request.params.cardId);
        if (cardIndex < 0) return { kind: "not_found" as const };

        const currentCard = current.reviewCards[cardIndex];
        const effectiveOperatorComment = operatorComment ?? currentCard.operatorComment;
        if (
          currentCard.decision === decision &&
          currentCard.operatorComment === effectiveOperatorComment &&
          currentCard.decidedAt
        ) {
          return { kind: "reviewed" as const, reviewedDraft: current, cardIndex };
        }

        const decidedAt = new Date().toISOString();
        const replacesOperatorComment = operatorComment !== undefined &&
          operatorComment !== currentCard.operatorComment;
        const reviewCards = current.reviewCards.map((card, index) =>
          index === cardIndex
            ? {
              ...card,
              decision,
              decidedBy: actor.name,
              decidedAt,
              ...(replacesOperatorComment
                ? {
                    operatorComment,
                    operatorCommentVisibility: canReadProductionCommercials(actor)
                      ? "commercial" as const
                      : "operational" as const
                  }
                : {})
            }
            : card
        );
        const reviewedDraft = validateProductionDraft({ ...current, reviewCards });
        await scope.setDraft(reviewedDraft);
        return { kind: "reviewed" as const, reviewedDraft, cardIndex };
      });
      if (reviewResult.kind === "not_found") {
        return reply.code(404).send({ message: "Review-Karte nicht gefunden." });
      }
      if (reviewResult.kind === "conflict") {
        return reply.code(409).send({ message: "ProductionDraft wurde gleichzeitig verändert oder entschieden." });
      }
      const { reviewedDraft, cardIndex } = reviewResult;
      const card = reviewedDraft.reviewCards[cardIndex];
      const decisionLabel = {
        pending: "Offen",
        fits: "Passt",
        change_requested: "Änderung nötig",
        unclear: "Unklar",
        blocked: "Blockiert"
      }[card.decision];
      await appendArtifactEvent(store, actor, reviewedDraft.draftId, {
        at: card.decidedAt!,
        role: "user",
        kind: "review_decision",
        text: `Prüfpunkt als „${decisionLabel}“ bewertet.`,
        artifactId: reviewedDraft.draftId
      }, `review:${reviewedDraft.draftId}:${card.cardId}:${card.decidedAt}`);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "production.production_draft_review_card_decided",
        entityType: "ProductionDraft",
        entityId: reviewedDraft.draftId,
        actor,
        idempotencyKey: `review:${reviewedDraft.draftId}:${card.cardId}:${card.decidedAt}`,
        summary: "ProductionDraft-Review-Karte entschieden.",
        details: compactAuditDetails({
          draftId: reviewedDraft.draftId,
          cardId: card.cardId,
          cardKind: card.kind,
          decision: card.decision,
          targetId: card.targetId,
          riskLevel: card.riskLevel,
          requiredApproval: card.requiredApproval
        })
      });

      const projectedDraft = projectProductionDraft(actor, reviewedDraft);
      return reply.send({
        draft: projectedDraft,
        reviewCard: projectedDraft.reviewCards[cardIndex]
      });
    }
  );

  app.post<{ Params: { draftId: string } }>(
    "/v1/production/drafts/:draftId/revise",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft = await store.getProductionDraft(actor, request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }

      const requestedChanges = draft.reviewCards.filter((card) => card.decision === "change_requested");
      const missingComments = requestedChanges.filter((card) => !card.operatorComment?.trim());
      if (requestedChanges.length === 0 || missingComments.length > 0) {
        return reply.code(422).send({
          message: "Für eine Überarbeitung ist mindestens ein konkret kommentierter Änderungswunsch erforderlich.",
          errors: missingComments.map((card) => `reviewCard ${card.cardId} needs operatorComment`)
        });
      }
      const unsupportedChanges = requestedChanges.filter((card) =>
        !productionDraftExtractionRevisionCardKinds.includes(
          card.kind as typeof productionDraftExtractionRevisionCardKinds[number]
        )
      );
      if (unsupportedChanges.length > 0) {
        return reply.code(422).send({
          message: "Rezept- und Planänderungen können mit dem Extraktions-Revisionsweg noch nicht sicher eingearbeitet werden.",
          errors: unsupportedChanges.map((card) => `reviewCard ${card.cardId} kind ${card.kind} is not revision-supported`)
        });
      }
      if (
        !canReadProductionCommercials(actor) &&
        requestedChanges.some((card) => card.operatorCommentVisibility !== "operational")
      ) {
        return reply.code(422).send({
          message: "Für eine Überarbeitung ist ein operativ freigegebener Änderungswunsch erforderlich."
        });
      }

      const target = {
        kind: "production_draft" as const,
        artifactId: draft.draftId,
        revision: draft.revision
      };

      const promptContext = productionDraftRevisionPromptContext(draft, requestedChanges);
      const contextHash = hashText(promptContext);
      const changeRequestHash = hashText(requestedChanges.map((card) => card.operatorComment).join("\n"));
      const commandAt = requestedChanges
        .map((card) => card.decidedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? draft.createdAt;
      const commandIdentity = productionDraftRevisionCommandIdentity(
        actor.businessId,
        draft,
        contextHash
      );
      const existingRevision = await store.getProductionDraft(actor, commandIdentity.draftId);
      if (existingRevision) {
        const matchesCommand =
          existingRevision.supersedesDraftId === draft.draftId &&
          existingRevision.revision === draft.revision + 1 &&
          existingRevision.source.inputHash === `sha256:${contextHash}`;
        if (!matchesCommand) {
          return reply.code(409).send({
            message: "Die gespeicherte Produktionsrevision passt nicht eindeutig zum Überarbeitungsauftrag."
          });
        }
        await finalizeProductionDraftRevision(
          store,
          auditLog,
          actor,
          draft,
          existingRevision,
          commandIdentity,
          requestedChanges.length,
          changeRequestHash
        );
        return reply.code(201).send({ draft: projectProductionDraft(actor, existingRevision) });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "Nur ein offener ProductionDraft kann überarbeitet werden." });
      }

      const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("production_draft_request");
      if (!promptSchema) {
        return reply.code(500).send({ message: "Prompt-Schema für ProductionDraft-Extraktion nicht registriert." });
      }

      const input: LlmReadinessModelInput = {
        contractVersion: llmReadinessContractVersion,
        inputId: commandIdentity.inputId,
        kind: "production_draft_request",
        sourceRefs: [
          {
            objectType: "safe_source_anchor",
            objectId: draft.draftId,
            label: "production draft revision source"
          }
        ],
        policy: {
          providerCalls: "disabled",
          dataMode: productionDraftDataMode,
          allowedToolEffects: ["read", "draft"]
        }
      };
      const adapterRequest: LlmReadinessProviderAdapterRequest = {
        input,
        promptSchemaId: promptSchema.promptSchemaId,
        promptContext
      };

      let adapter: BoundaryGuardedLlmAdapter;
      try {
        adapter = buildLlmAdapter();
      } catch (error) {
        await appendArtifactEvent(store, actor, draft.draftId, {
          at: commandAt,
          role: "system",
          kind: "error",
          text: "KI-Verbindung für die Produktionsrevision konnte nicht gestartet werden.",
          artifactId: draft.draftId
        }, `revision-startup-error:${input.inputId}`);
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "BYO-LLM-Adapter konnte nicht gestartet werden."
        });
      }

      const adapterResponse = await adapter.execute(adapterRequest, {
        businessId: actor.businessId,
        dataClass: draft.source.dataClass ?? "personal_confidential",
        purpose: "production_draft_revision"
      }).catch(async (error: unknown) => {
        await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
          action: "production.production_draft_revision_rejected",
          entityType: "ProductionDraft",
          entityId: draft.draftId,
          actor,
          summary: "ProductionDraft-Revision verworfen.",
          details: compactAuditDetails({
            draftId: draft.draftId,
            inputId: input.inputId,
            adapterId: adapter.adapterId,
            adapterMode: adapter.adapterMode,
            promptSchemaId: promptSchema.promptSchemaId,
            dataMode: input.policy.dataMode,
            changeRequestCount: requestedChanges.length,
            changeRequestHash,
            errorCount: 1,
            errorType: error instanceof Error ? error.name : typeof error
          }),
          idempotencyKey: `production-draft-revision-rejected:${input.inputId}:provider`
        });
        await appendArtifactEvent(store, actor, draft.draftId, {
          at: commandAt,
          role: "system",
          kind: "error",
          text: "Produktionsrevision konnte nicht erstellt werden.",
          artifactId: draft.draftId
        }, `revision-provider-error:${input.inputId}`);
        return undefined;
      });
      if (!adapterResponse) {
        return reply.code(422).send({
          message: "ProductionDraft-Revision konnte nicht erzeugt werden.",
          errors: ["BYO-LLM-Aufruf ist fehlgeschlagen."]
        });
      }

      const auditBuild = createLlmReadinessAgentAuditRecord({
        auditId: commandIdentity.agentAuditId,
        request: adapterRequest,
        response: adapterResponse
      });
      const extractionBuild = parseProductionDraftExtraction(
        adapterResponse.outputCandidate,
        promptContext
      );
      const coverageErrors = extractionBuild.extraction
        ? productionDraftRevisionCoverageErrors(draft, requestedChanges, extractionBuild.extraction)
        : [];
      const responseErrors = [
        ...(adapterResponse.ok ? [] : adapterResponse.errors),
        ...extractionBuild.errors,
        ...coverageErrors,
        ...auditBuild.errors.map((error) => `agentAudit.${error}`)
      ];
      if (!adapterResponse.ok || responseErrors.length > 0 || !extractionBuild.extraction || !auditBuild.auditRecord) {
        await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
          action: "production.production_draft_revision_rejected",
          entityType: "ProductionDraft",
          entityId: draft.draftId,
          actor,
          summary: "ProductionDraft-Revision verworfen.",
          details: compactAuditDetails({
            draftId: draft.draftId,
            inputId: input.inputId,
            providerId: adapterResponse.providerId,
            providerRequestId: adapterResponse.providerRequestId,
            changeRequestCount: requestedChanges.length,
            changeRequestHash,
            errorCount: responseErrors.length,
            ...processingPolicyAuditDetails(adapterResponse.processingPolicy)
          }),
          idempotencyKey: `production-draft-revision-rejected:${input.inputId}:validation`
        });
        // The case history records the failed attempt without exposing the operator comment,
        // prompt or provider response that caused the rejection.
        await appendArtifactEvent(store, actor, draft.draftId, {
          at: commandAt,
          role: "system",
          kind: "error",
          text: "Produktionsrevision war nicht prüfbar und wurde verworfen.",
          artifactId: draft.draftId
        }, `revision-validation-error:${input.inputId}`);
        return reply.code(422).send({
          message: productionDraftExtractionFailureMessage(responseErrors),
          errors: [...new Set(responseErrors)]
        });
      }

      const sourceFilename = draft.source.sourceRef?.replace(/^upload:/, "") || "production-draft-revision.json";
      const revision = validateProductionDraft({
        ...buildProductionDraftFromExtraction({
          businessId: actor.businessId,
          draftId: commandIdentity.draftId,
          revision: draft.revision + 1,
          extraction: extractionBuild.extraction,
          source: {
            filename: sourceFilename,
            sha256: contextHash,
            ingestedAt: new Date().toISOString(),
            dataClass: draft.source.dataClass ?? "personal_confidential"
          },
          outputCandidate: adapterResponse.outputCandidate!,
          adapterResponse,
          supersedesDraftId: draft.draftId,
          inheritedSourceLineage: draft.draftArtifacts.eventSpec?.sourceLineage
        }),
        businessId: actor.businessId
      });
      const committed = await decisionRepository.withTargetCriticalSection(actor, target, async (scope) => {
        if (!await mutableDraftInScope(scope, draft)) return false;
        const inserted = await scope.insertDraft(revision);
        if (inserted === "exists") {
          const existing = await scope.getDraft(revision.draftId);
          if (!areJsonValuesEqual(existing, revision)) return false;
        }
        await scope.setDraft(validateProductionDraft({ ...draft, status: "superseded" }));
        return true;
      });
      if (!committed) {
        const racedRevision = await store.getProductionDraft(actor, commandIdentity.draftId);
        if (
          racedRevision?.supersedesDraftId === draft.draftId &&
          racedRevision.revision === draft.revision + 1 &&
          racedRevision.source.inputHash === `sha256:${contextHash}`
        ) {
          await finalizeProductionDraftRevision(
            store,
            auditLog,
            actor,
            draft,
            racedRevision,
            commandIdentity,
            requestedChanges.length,
            changeRequestHash
          );
          return reply.code(201).send({ draft: projectProductionDraft(actor, racedRevision) });
        }
        return reply.code(409).send({
          message: "ProductionDraft wurde während der Überarbeitung verändert oder entschieden."
        });
      }
      await finalizeProductionDraftRevision(
        store,
        auditLog,
        actor,
        draft,
        revision,
        commandIdentity,
        requestedChanges.length,
        changeRequestHash
      );

      return reply.code(201).send({ draft: projectProductionDraft(actor, revision) });
    }
  );

  app.post<{
    Body: {
      target?: unknown;
      feedback?: unknown;
      summary?: unknown;
      observations?: unknown;
      changeRequests?: unknown;
    };
  }>(
    "/v1/production/feedback-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const parsed = productionFeedbackFromBody(request.body);
      if (parsed.errors.length > 0 || !parsed.feedback) {
        return reply.code(422).send({
          message: "Produktionsfeedback-Entwurf ist nicht valide.",
          errors: [...new Set(parsed.errors)]
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const now = new Date().toISOString();
      const draft: ProductionFeedbackDraft = {
        feedbackId: `production-feedback-${randomUUID()}`,
        status: "pending_review",
        createdAt: now,
        updatedAt: now,
        createdBy: {
          name: actor.name,
          source: actor.source
        },
        ...(parsed.target ? { target: parsed.target } : {}),
        feedback: parsed.feedback,
        guardrails: {
          draftOnly: true,
          humanApprovalRequired: true,
          rawProviderPayloadStored: false,
          knowledgeWritePolicy: "reviewed_only"
        }
      };

      try {
        await store.saveProductionFeedbackDraft(actor, draft);
      } catch (error) {
        return reply.code(422).send({
          message: "Produktionsfeedback-Entwurf ist nicht valide.",
          errors: [error instanceof Error ? error.message : "Unbekannter Validierungsfehler."]
        });
      }

      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "production.feedback_draft_created",
        entityType: "ProductionFeedbackDraft",
        entityId: draft.feedbackId,
        actor,
        summary: "Produktionsfeedback als prüfpflichtiger Entwurf angelegt.",
        details: compactAuditDetails({
          feedbackId: draft.feedbackId,
          status: draft.status,
          targetSpecId: draft.target?.specId,
          targetPlanId: draft.target?.planId,
          targetRecipeId: draft.target?.recipeId,
          targetComponentId: draft.target?.componentId,
          feedbackTextHash: hashText(draft.feedback.summary),
          observationCount: draft.feedback.observations.length,
          changeRequestCount: draft.feedback.changeRequests.length,
          humanApprovalRequired: true,
          writesProductObject: false
        })
      });

      return reply.code(201).send({ draft });
    }
  );

  app.post<{ Params: { feedbackId: string }; Body: { approve?: unknown } }>(
    "/v1/production/feedback-drafts/:feedbackId/decision",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      if (typeof request.body?.approve !== "boolean") {
        return reply.code(400).send({ message: "approve muss true oder false sein." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft = await store.getProductionFeedbackDraft(actor, request.params.feedbackId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionFeedbackDraft nicht gefunden." });
      }
      if (!canAccessProductionFeedback(actor, draft)) {
        return reply.code(403).send({ message: "ProductionFeedbackDraft ist nicht zugänglich." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ProductionFeedbackDraft wurde bereits entschieden." });
      }

      const now = new Date().toISOString();
      const decidedDraft: ProductionFeedbackDraft = request.body.approve
        ? {
          ...draft,
          status: "approved",
          updatedAt: now,
          approvedBy: {
            name: actor.name,
            source: actor.source
          },
          approvedAt: now
        }
        : {
          ...draft,
          status: "rejected",
          updatedAt: now,
          rejectedBy: {
            name: actor.name,
            source: actor.source
          },
          rejectedAt: now
        };

      await store.saveProductionFeedbackDraft(actor, decidedDraft);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: request.body.approve
          ? "production.feedback_draft_approved"
          : "production.feedback_draft_rejected",
        entityType: "ProductionFeedbackDraft",
        entityId: decidedDraft.feedbackId,
        actor,
        summary: request.body.approve
          ? "Produktionsfeedback nach Review als Wissen freigegeben."
          : "Produktionsfeedback nach Review verworfen.",
        details: compactAuditDetails({
          feedbackId: decidedDraft.feedbackId,
          status: decidedDraft.status,
          feedbackTextHash: hashText(decidedDraft.feedback.summary),
          writesReviewedKnowledge: request.body.approve
        })
      });

      return reply.send({ draft: decidedDraft });
    }
  );

  app.get("/v1/production/knowledge/production-feedback", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const items = await store.listReviewedProductionFeedbackKnowledge(actor);
    return reply.send({ items: items.filter((feedback) => canAccessProductionFeedback(actor, feedback)) });
  });

  app.get<{ Params: { specId: string } }>(
    "/v1/production/specs/:specId/clarification-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const spec = await intakeRecords.getSpec(actor, request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      return reply.send({
        items: await store.listClarificationDrafts(
          actor,
          request.params.specId
        )
      });
    }
  );

  app.post<{ Params: { specId: string } }>(
    "/v1/production/specs/:specId/clarification-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const spec = await intakeRecords.getSpec(
        actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        request.params.specId
      );
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("clarification_draft_request");
      if (!promptSchema) {
        return reply.code(500).send({ message: "Prompt-Schema für Rückfragen-Entwurf nicht registriert." });
      }

      const input = buildClarificationDraftInput(spec);
      const adapterRequest: LlmReadinessProviderAdapterRequest = {
        input,
        promptSchemaId: promptSchema.promptSchemaId
      };
      const draftSeed = `draft-${spec.specId}-${randomUUID()}`;
      let adapter: BoundaryGuardedLlmAdapter;
      try {
        adapter = buildLlmAdapter();
      } catch (error) {
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "BYO-LLM-Adapter konnte nicht gestartet werden."
        });
      }

      const adapterResponse = await adapter.execute(adapterRequest, {
        businessId: actorForRequest(request, trustedActorSecret, allowDevActorHeader).businessId,
        // AcceptedEventSpec predates source data classification. Treat old specs
        // as confidential until a stored source classification is available.
        dataClass: "personal_confidential",
        purpose: "clarification_draft"
      }).catch(async (error: unknown) => {
        await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
          action: "production.clarification_draft_rejected",
          entityType: "ClarificationDraft",
          entityId: draftSeed,
          actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
          summary: `KI-Rückfragen-Entwurf für ${spec.specId} verworfen.`,
          details: compactAuditDetails({
            specId: spec.specId,
            inputId: input.inputId,
            adapterId: adapter.adapterId,
            adapterMode: adapter.adapterMode,
            promptSchemaId: promptSchema.promptSchemaId,
            errorCount: 1,
            errorType: error instanceof Error ? error.name : typeof error
          })
        });
        return undefined;
      });
      if (!adapterResponse) {
        return reply.code(422).send({
          message: "KI-Rückfragen-Entwurf konnte nicht erzeugt werden.",
          errors: ["BYO-LLM-Aufruf ist fehlgeschlagen."]
        });
      }
      const auditBuild = createLlmReadinessAgentAuditRecord({
        auditId: `agent-audit-${draftSeed}`,
        request: adapterRequest,
        response: adapterResponse
      });
      const questionsBuild = questionsFromOutput(adapterResponse.outputCandidate);
      const responseErrors = [
        ...(adapterResponse.ok ? [] : adapterResponse.errors),
        ...questionsBuild.errors,
        ...auditBuild.errors.map((error) => `agentAudit.${error}`)
      ];

      if (!adapterResponse.ok || responseErrors.length > 0 || !questionsBuild.questions || !auditBuild.auditRecord) {
        await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
          action: "production.clarification_draft_rejected",
          entityType: "ClarificationDraft",
          entityId: draftSeed,
          actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
          summary: `KI-Rückfragen-Entwurf für ${spec.specId} verworfen.`,
          details: compactAuditDetails({
            specId: spec.specId,
            inputId: input.inputId,
            adapterId: adapterResponse.adapterId,
            adapterMode: adapterResponse.adapterMode,
            promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
            fixtureId: adapterResponse.fixtureId,
            providerId: adapterResponse.providerId,
            providerRequestId: adapterResponse.providerRequestId,
            errorCount: responseErrors.length,
            ...processingPolicyAuditDetails(adapterResponse.processingPolicy)
          })
        });
        return reply.code(422).send({
          message: "KI-Rückfragen-Entwurf ist nicht schema-valide.",
          errors: [...new Set(responseErrors)]
        });
      }

      const now = new Date().toISOString();
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft: ClarificationDraft = {
        draftId: draftSeed,
        specId: spec.specId,
        questions: questionsBuild.questions,
        status: "pending_review",
        createdAt: now,
        updatedAt: now,
        createdBy: {
          name: actor.name,
          source: actor.source
        },
        modelMetadata: {
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          inputId: input.inputId,
          outputId: adapterResponse.outputCandidate?.outputId,
          outputKind: adapterResponse.outputCandidate?.kind,
          promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
          fixtureId: adapterResponse.fixtureId,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId
        },
        agentAudit: auditBuild.auditRecord
      };
      await store.saveClarificationDraft(actor, draft);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "production.clarification_draft_created",
        entityType: "ClarificationDraft",
        entityId: draft.draftId,
        actor,
        summary: `KI-Rückfragen-Entwurf für ${spec.specId} angelegt.`,
        details: compactAuditDetails({
          specId: spec.specId,
          draftId: draft.draftId,
          agentAuditId: auditBuild.auditRecord.auditId,
          inputId: input.inputId,
          outputId: adapterResponse.outputCandidate?.outputId,
          outputTextHash: hashText(questionsBuild.questions.map((question) => question.text).join("\n")),
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          promptSchemaId: draft.modelMetadata.promptSchemaId,
          fixtureId: adapterResponse.fixtureId,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId,
          ...processingPolicyAuditDetails(adapterResponse.processingPolicy),
          humanApprovalRequired: true,
          writesProductObject: false
        })
      });

      return reply.code(201).send({ draft });
    }
  );

  app.post<{ Params: { draftId: string }; Body: { approve?: unknown } }>(
    "/v1/production/clarification-drafts/:draftId/decision",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      if (typeof request.body?.approve !== "boolean") {
        return reply.code(400).send({ message: "approve muss true oder false sein." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft = await store.getClarificationDraft(actor, request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ClarificationDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ClarificationDraft wurde bereits entschieden." });
      }

      const now = new Date().toISOString();
      const decidedDraft: ClarificationDraft = {
        ...draft,
        status: request.body.approve ? "approved" : "rejected",
        updatedAt: now,
        decidedAt: now,
        decisionBy: {
          name: actor.name,
          source: actor.source
        }
      };

      let acceptedEventSpec: AcceptedEventSpec | undefined;
      if (request.body.approve) {
        const spec = await intakeRecords.getSpec(actor, draft.specId);
        if (!spec) {
          return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
        }
        acceptedEventSpec = applyApprovedDraftToSpec(spec, draft);
        try {
          await intakeRecords.replaceSpec(actor, spec, acceptedEventSpec);
        } catch {
          return reply.code(409).send({ message: "AcceptedEventSpec wurde zwischenzeitlich geändert." });
        }
      }

      await store.saveClarificationDraft(actor, decidedDraft);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: request.body.approve
          ? "production.clarification_draft_approved"
          : "production.clarification_draft_rejected_by_operator",
        entityType: "ClarificationDraft",
        entityId: draft.draftId,
        actor,
        summary: request.body.approve
          ? `KI-Rückfragen-Entwurf für ${draft.specId} übernommen.`
          : `KI-Rückfragen-Entwurf für ${draft.specId} verworfen.`,
        details: compactAuditDetails({
          specId: draft.specId,
          draftId: draft.draftId,
          questionCount: draft.questions.length,
          status: decidedDraft.status,
          outputTextHash: hashText(draft.questions.map((question) => question.text).join("\n"))
        })
      });

      return reply.send({
        draft: decidedDraft,
        ...(acceptedEventSpec
          ? { acceptedEventSpec: projectProductionEventSpec(actor, acceptedEventSpec) }
          : {})
      });
    }
  );
}

function productionDraftReviewDecisionFromBody(
  value: unknown
): Exclude<ProductionDraftReviewDecision, "pending"> | undefined {
  return typeof value === "string" &&
    operatorProductionDraftReviewDecisions.includes(value as Exclude<ProductionDraftReviewDecision, "pending">)
    ? value as Exclude<ProductionDraftReviewDecision, "pending">
    : undefined;
}

function operatorCommentFromBody(value: unknown): string | false | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.length <= 1000 ? trimmed : false;
}

function buildClarificationDraftInput(spec: AcceptedEventSpec): LlmReadinessModelInput {
  return {
    contractVersion: llmReadinessContractVersion,
    inputId: `input-${spec.specId}-clarification-draft`,
    kind: "clarification_draft_request",
    sourceRefs: [
      {
        objectType: "accepted_event_spec",
        objectId: spec.specId,
        label: "accepted event spec"
      }
    ],
    policy: {
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      allowedToolEffects: ["read", "draft"]
    }
  };
}

function questionsFromOutput(outputCandidate?: LlmReadinessModelOutputCandidate): {
  questions?: ClarificationDraftQuestion[];
  errors: string[];
} {
  const errors = validateLlmReadinessModelOutputCandidate(outputCandidate).errors.map((error) =>
    `outputCandidate.${error}`
  );
  if (!outputCandidate) {
    return { errors };
  }

  if (outputCandidate.kind !== "clarification_question_draft") {
    errors.push("outputCandidate.kind must be clarification_question_draft");
  }
  if (outputCandidate.humanApprovalRequired !== true) {
    errors.push("outputCandidate.humanApprovalRequired must be true");
  }
  if (outputCandidate.writesProductObject !== false) {
    errors.push("outputCandidate.writesProductObject must be false");
  }

  const text = outputCandidate.text.trim();
  const reason = outputCandidate.structuredCandidate?.reason;
  const reasonCode = outputCandidate.structuredCandidate?.reasonCode;
  if (!text) {
    errors.push("outputCandidate.text must be non-empty");
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    errors.push("outputCandidate.structuredCandidate.reason must be a non-empty string");
  }
  if (typeof reasonCode !== "string" || reasonCode.trim().length === 0) {
    errors.push("outputCandidate.structuredCandidate.reasonCode must be a non-empty string");
  }

  if (errors.length > 0 || typeof reason !== "string" || typeof reasonCode !== "string") {
    return { errors: [...new Set(errors)] };
  }

  return {
    questions: [
      {
        text,
        reason: reason.trim(),
        reasonCode: reasonCode.trim()
      }
    ],
    errors: []
  };
}

function applyApprovedDraftToSpec(spec: AcceptedEventSpec, draft: ClarificationDraft): AcceptedEventSpec {
  const existing = spec.uncertainties ?? [];
  const additions = draft.questions.map((question) => ({
    field: question.reasonCode,
    message: `KI-Rückfragen-Entwurf: ${question.reason}`,
    severity: "medium" as const,
    suggestedQuestion: question.text
  }));
  const deduped = new Map<string, (typeof additions)[number] | (typeof existing)[number]>();

  for (const uncertainty of existing) {
    const key = [uncertainty.field, uncertainty.suggestedQuestion ?? uncertainty.message].join("::");
    deduped.set(key, uncertainty);
  }
  for (const uncertainty of additions) {
    const key = [uncertainty.field, uncertainty.suggestedQuestion ?? uncertainty.message].join("::");
    if (!deduped.has(key)) {
      deduped.set(key, uncertainty);
    }
  }

  return {
    ...spec,
    uncertainties: [...deduped.values()]
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectForbiddenProductionFeedbackBodyKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenProductionFeedbackBodyKeys(item, `${path}[${index}]`));
  }
  if (!isPlainRecord(value)) {
    return [];
  }

  const errors: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (llmReadinessForbiddenPayloadKeys.includes(key as (typeof llmReadinessForbiddenPayloadKeys)[number])) {
      errors.push(`${path}.${key} ist in Produktionsfeedback nicht erlaubt.`);
    }
    errors.push(...collectForbiddenProductionFeedbackBodyKeys(nested, `${path}.${key}`));
  }
  return errors;
}

function productionFeedbackText(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} muss Text enthalten.`);
    return "";
  }

  const text = value.trim();
  if (text.length > 1000) {
    errors.push(`${field} darf maximal 1000 Zeichen enthalten.`);
  }
  return text;
}

function productionFeedbackTextList(value: unknown, field: string, errors: string[]): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} muss eine Textliste sein.`);
    return [];
  }
  if (value.length > 50) {
    errors.push(`${field} darf maximal 50 Einträge enthalten.`);
  }

  return value
    .map((item, index) => productionFeedbackText(item, `${field}[${index}]`, errors))
    .filter(Boolean);
}

function productionFeedbackTarget(
  value: unknown,
  errors: string[]
): ProductionFeedbackDraft["target"] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainRecord(value)) {
    errors.push("target muss ein Objekt sein.");
    return undefined;
  }

  const target: NonNullable<ProductionFeedbackDraft["target"]> = {};
  for (const key of ["specId", "planId", "recipeId", "componentId"] as const) {
    if (value[key] !== undefined) {
      target[key] = productionFeedbackText(value[key], `target.${key}`, errors);
    }
  }
  if (Object.keys(target).length === 0) {
    errors.push("target muss mindestens eine stabile Referenz enthalten.");
  }
  return target;
}

function productionFeedbackFromBody(body: unknown): {
  target?: ProductionFeedbackDraft["target"];
  feedback?: ProductionFeedbackDraft["feedback"];
  errors: string[];
} {
  const errors = collectForbiddenProductionFeedbackBodyKeys(body);
  if (!isPlainRecord(body)) {
    return {
      errors: [...errors, "Body muss ein Objekt sein."]
    };
  }

  const feedbackBody = isPlainRecord(body.feedback) ? body.feedback : body;
  const feedback: ProductionFeedbackDraft["feedback"] = {
    summary: productionFeedbackText(feedbackBody.summary, "feedback.summary", errors),
    observations: productionFeedbackTextList(feedbackBody.observations, "feedback.observations", errors),
    changeRequests: productionFeedbackTextList(feedbackBody.changeRequests, "feedback.changeRequests", errors)
  };
  const target = productionFeedbackTarget(body.target, errors);

  return {
    ...(target ? { target } : {}),
    feedback,
    errors
  };
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compactAuditDetails(details: Record<string, string | number | boolean | undefined>) {
  return Object.fromEntries(
    Object.entries(details).filter((entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined
    )
  );
}
