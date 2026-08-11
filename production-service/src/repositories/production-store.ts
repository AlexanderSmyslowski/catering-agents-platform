import { createHash, randomUUID } from "node:crypto";
import {
  createBusinessScopedPersistentCollection,
  areJsonValuesEqual,
  approvalRequestIdForTarget,
  initialCaseEventForCase,
  llmReadinessForbiddenPayloadKeys,
  productionClarificationAnswerTextMaxLength,
  normalizeCaseSearchText,
  persistCaseWithInitialEvent,
  sortCasesByLatestActivity,
  withBusinessTargetCriticalSection,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type CaseEvent,
  type LlmReadinessAgentAuditRecord,
  type LlmReadinessProviderAdapterMode,
  type ApprovedProductionSpec,
  type ApprovalRequestRecord,
  type ProductionApplyManifest,
  type ProductionClarificationAnswer,
  type ProductionDraft,
  type ProductionDraftGuardrails,
  type ProductionPlan,
  type ProductionCase,
  type PurchaseList,
  type TrustedActor,
  approvedProductionSpecIdForApproval,
  validateApprovedProductionSpec,
  validateApprovalRequestRecord,
  validateCaseEvent,
  validateCaseEventForProduct,
  validateProductionCase,
  validateProductionDraft
} from "@catering/shared-core";
import { validateProductionDecisionAggregate } from "../production-decision-aggregate.js";
import {
  createProductionDecisionCollections,
  productionDecisionTargetScopeFor,
  productionDecisionRepositoryFor,
  registerProductionDecisionRepository,
  type ProductionDecisionTargetScope
} from "./production-decision-repository.js";

export { productionDecisionRepositoryFor } from "./production-decision-repository.js";

export type ClarificationDraftStatus = "pending_review" | "approved" | "rejected";
export type ProductionFeedbackStatus = "pending_review" | "approved" | "rejected";

interface ProductionFeedbackActor {
  name: string;
  source: TrustedActor["source"];
}

export interface ProductionFeedbackTarget {
  specId?: string;
  planId?: string;
  recipeId?: string;
  componentId?: string;
}

export interface ProductionFeedbackContent {
  summary: string;
  observations: string[];
  changeRequests: string[];
}

export interface ProductionFeedbackDraft {
  feedbackId: string;
  status: ProductionFeedbackStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: ProductionFeedbackActor;
  target?: ProductionFeedbackTarget;
  feedback: ProductionFeedbackContent;
  guardrails: Pick<
    ProductionDraftGuardrails,
    "draftOnly" | "humanApprovalRequired" | "rawProviderPayloadStored" | "knowledgeWritePolicy"
  >;
  approvedBy?: ProductionFeedbackActor;
  approvedAt?: string;
  rejectedBy?: ProductionFeedbackActor;
  rejectedAt?: string;
}

export type ReviewedProductionFeedbackKnowledge = ProductionFeedbackDraft & {
  status: "approved";
  approvedBy: ProductionFeedbackActor;
  approvedAt: string;
};

export interface ClarificationDraftQuestion {
  text: string;
  reason: string;
  reasonCode: string;
}

export interface ClarificationDraft {
  draftId: string;
  specId: string;
  questions: ClarificationDraftQuestion[];
  status: ClarificationDraftStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    name: string;
    source: string;
  };
  decisionBy?: {
    name: string;
    source: string;
  };
  decidedAt?: string;
  modelMetadata: {
    adapterId: string;
    adapterMode: LlmReadinessProviderAdapterMode;
    inputId: string;
    outputId?: string;
    outputKind?: string;
    promptSchemaId?: string;
    fixtureId?: string;
    providerId?: string;
    providerRequestId?: string;
  };
  agentAudit?: LlmReadinessAgentAuditRecord;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeClarificationAnswerForStorage(answer: ProductionClarificationAnswer): ProductionClarificationAnswer {
  return {
    ...answer,
    answerText: {
      ...answer.answerText,
      value: escapeHtml(answer.answerText.value.trim())
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectForbiddenProductionFeedbackKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenProductionFeedbackKeys(item, `${path}[${index}]`));
  }

  if (!isRecord(value)) {
    return [];
  }

  const errors: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (llmReadinessForbiddenPayloadKeys.includes(key as (typeof llmReadinessForbiddenPayloadKeys)[number])) {
      errors.push(`${path}.${key} is not allowed in ProductionFeedbackDraft`);
    }
    errors.push(...collectForbiddenProductionFeedbackKeys(nested, `${path}.${key}`));
  }
  return errors;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeProductionFeedbackText(value: unknown, field: string, errors: string[]): string {
  if (!isNonEmptyString(value)) {
    errors.push(`${field} muss Text enthalten.`);
    return "";
  }

  const text = value.trim();
  if (text.length > 1000) {
    errors.push(`${field} darf maximal 1000 Zeichen enthalten.`);
  }
  return text;
}

function normalizeProductionFeedbackTextList(value: unknown, field: string, errors: string[]): string[] {
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
    .map((item, index) => normalizeProductionFeedbackText(item, `${field}[${index}]`, errors))
    .filter(Boolean);
}

function normalizeProductionFeedbackActor(value: unknown, field: string, errors: string[]): ProductionFeedbackActor {
  if (!isRecord(value)) {
    errors.push(`${field} muss Actor-Provenienz enthalten.`);
    return {
      name: "",
      source: "untrusted"
    };
  }

  return {
    name: normalizeProductionFeedbackText(value.name, `${field}.name`, errors),
    source: isNonEmptyString(value.source) ? value.source as TrustedActor["source"] : "untrusted"
  };
}

function normalizeProductionFeedbackTarget(
  value: unknown,
  errors: string[]
): ProductionFeedbackTarget | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    errors.push("target muss ein Objekt sein.");
    return undefined;
  }

  const target: ProductionFeedbackTarget = {};
  for (const key of ["specId", "planId", "recipeId", "componentId"] as const) {
    const rawValue = value[key];
    if (rawValue !== undefined) {
      target[key] = normalizeProductionFeedbackText(rawValue, `target.${key}`, errors);
    }
  }

  if (Object.keys(target).length === 0) {
    errors.push("target muss mindestens eine stabile Referenz enthalten.");
  }
  return target;
}

export function validateProductionFeedbackDraftForStorage(value: ProductionFeedbackDraft): ProductionFeedbackDraft {
  const errors = collectForbiddenProductionFeedbackKeys(value);
  const status = value.status;
  if (status !== "pending_review" && status !== "approved" && status !== "rejected") {
    errors.push("status muss pending_review, approved oder rejected sein.");
  }

  const guardrails = value.guardrails;
  if (
    guardrails?.draftOnly !== true ||
    guardrails?.humanApprovalRequired !== true ||
    guardrails?.rawProviderPayloadStored !== false ||
    guardrails?.knowledgeWritePolicy !== "reviewed_only"
  ) {
    errors.push("guardrails müssen draft-only, human-reviewed und reviewed_only sein.");
  }

  const normalized: ProductionFeedbackDraft = {
    feedbackId: normalizeProductionFeedbackText(value.feedbackId, "feedbackId", errors),
    status,
    createdAt: normalizeProductionFeedbackText(value.createdAt, "createdAt", errors),
    updatedAt: normalizeProductionFeedbackText(value.updatedAt, "updatedAt", errors),
    createdBy: normalizeProductionFeedbackActor(value.createdBy, "createdBy", errors),
    ...(value.target ? { target: normalizeProductionFeedbackTarget(value.target, errors) } : {}),
    feedback: {
      summary: normalizeProductionFeedbackText(value.feedback?.summary, "feedback.summary", errors),
      observations: normalizeProductionFeedbackTextList(value.feedback?.observations, "feedback.observations", errors),
      changeRequests: normalizeProductionFeedbackTextList(
        value.feedback?.changeRequests,
        "feedback.changeRequests",
        errors
      )
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    ...(value.approvedBy ? { approvedBy: normalizeProductionFeedbackActor(value.approvedBy, "approvedBy", errors) } : {}),
    ...(value.approvedAt ? { approvedAt: normalizeProductionFeedbackText(value.approvedAt, "approvedAt", errors) } : {}),
    ...(value.rejectedBy ? { rejectedBy: normalizeProductionFeedbackActor(value.rejectedBy, "rejectedBy", errors) } : {}),
    ...(value.rejectedAt ? { rejectedAt: normalizeProductionFeedbackText(value.rejectedAt, "rejectedAt", errors) } : {})
  };

  if (status === "pending_review" && (value.approvedBy || value.approvedAt || value.rejectedBy || value.rejectedAt)) {
    errors.push("pending_review ProductionFeedbackDraft darf keine Entscheidung tragen.");
  }
  if (status === "approved" && (!value.approvedBy || !value.approvedAt)) {
    errors.push("approved ProductionFeedbackDraft braucht approvedBy und approvedAt.");
  }
  if (status === "rejected" && (!value.rejectedBy || !value.rejectedAt)) {
    errors.push("rejected ProductionFeedbackDraft braucht rejectedBy und rejectedAt.");
  }

  if (errors.length > 0) {
    throw new Error(`Ungültiger ProductionFeedbackDraft: ${[...new Set(errors)].join("; ")}`);
  }
  return normalized;
}

function isSubmittedShortTextAnswer(answer: ProductionClarificationAnswer): boolean {
  const specId = typeof answer.context?.specId === "string" ? answer.context.specId.trim() : "";
  const productionSessionId = typeof answer.context?.productionSessionId === "string"
    ? answer.context.productionSessionId.trim()
    : "";

  return typeof answer.answerId === "string" &&
    Boolean(answer.answerId.trim()) &&
    Boolean(specId) &&
    productionSessionId === `production-session-${specId}` &&
    typeof answer.questionId === "string" &&
    Boolean(answer.questionId.trim()) &&
    typeof answer.questionKey?.reason === "string" &&
    Boolean(answer.questionKey.reason.trim()) &&
    typeof answer.questionKey?.reasonCode === "string" &&
    Boolean(answer.questionKey.reasonCode.trim()) &&
    answer.status === "submitted" &&
    answer.answerType === "shortText" &&
    answer.answerText?.kind === "shortText" &&
    typeof answer.answerText.value === "string" &&
    Boolean(answer.answerText.value.trim()) &&
    answer.answerText.value.trim().length <= productionClarificationAnswerTextMaxLength;
}

interface ProductionCaseCollections {
  cases: BusinessScopedPersistentCollection<ProductionCase>;
  events: BusinessScopedPersistentCollection<CaseEvent>;
}

type CaseEventInput = Omit<CaseEvent, "businessId" | "eventId" | "caseId" | "sequence">;

function createProductionCaseCollections(options: CollectionStorageOptions): ProductionCaseCollections {
  return {
    cases: createBusinessScopedPersistentCollection({
      collectionName: "production/cases",
      getId: (item: ProductionCase) => item.caseId,
      getVersion: (item: ProductionCase) => item.version,
      validate: validateProductionCase,
      ...options
    }),
    events: createBusinessScopedPersistentCollection({
      collectionName: "production/case-events",
      getId: (item: CaseEvent) => item.eventId,
      validate: validateCaseEvent,
      ...options
    })
  };
}

async function createProductionCaseInCollections(
  collections: ProductionCaseCollections,
  context: BusinessContext,
  input: ProductionCase
): Promise<"created" | "exists"> {
  const item = validateProductionCase(input);
  const initialEvent = validateCaseEventForProduct(initialCaseEventForCase(item), "production");
  return persistCaseWithInitialEvent(collections, context, item, initialEvent);
}

function assertProductionCaseUpdate(
  existing: ProductionCase,
  next: ProductionCase,
  expectedVersion: number
): void {
  if (
    next.businessId !== existing.businessId ||
    next.caseId !== existing.caseId ||
    next.product !== existing.product ||
    next.schemaVersion !== existing.schemaVersion ||
    next.createdAt !== existing.createdAt ||
    next.copiedFromCaseId !== existing.copiedFromCaseId
  ) {
    throw new Error("Die Identität eines ProductionCase darf nicht verändert werden.");
  }
  if (next.version !== expectedVersion + 1) {
    throw new Error("Eine ProductionCase-Aktualisierung muss die Version genau um eins erhöhen.");
  }
  if (existing.sourceSpecId && next.sourceSpecId !== existing.sourceSpecId) {
    throw new Error("Die Quellspezifikation eines ProductionCase darf nicht verändert werden.");
  }
}

type ProductionCaseDraftMutation<T> =
  | { status: "committed"; value: T }
  | { status: "conflict" };
type ProductionCaseDraftCommitResult<T> =
  | { status: "committed"; value: T }
  | { status: "case_missing" }
  | { status: "case_conflict" }
  | { status: "draft_conflict" };

export class ProductionStore {
  private readonly plans: BusinessScopedPersistentCollection<ProductionPlan>;
  private readonly purchaseLists: BusinessScopedPersistentCollection<PurchaseList>;
  private readonly clarificationAnswers: BusinessScopedPersistentCollection<ProductionClarificationAnswer>;
  private readonly clarificationDrafts: BusinessScopedPersistentCollection<ClarificationDraft>;
  private readonly productionDrafts: BusinessScopedPersistentCollection<ProductionDraft>;
  private readonly productionFeedbackDrafts: BusinessScopedPersistentCollection<ProductionFeedbackDraft>;
  private readonly approvals: BusinessScopedPersistentCollection<ApprovalRequestRecord>;
  private readonly approvedProductionSpecs: BusinessScopedPersistentCollection<ApprovedProductionSpec>;
  private readonly applyManifests: BusinessScopedPersistentCollection<ProductionApplyManifest>;
  private readonly cases: BusinessScopedPersistentCollection<ProductionCase>;
  private readonly caseEvents: BusinessScopedPersistentCollection<CaseEvent>;
  private readonly storageOptions: CollectionStorageOptions;

  constructor(options?: CollectionStorageOptions) {
    this.storageOptions = options ?? {};
    const storage = {
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    };
    this.plans = createBusinessScopedPersistentCollection<ProductionPlan>({
      collectionName: "production/plans",
      getId: (plan) => plan.planId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.purchaseLists = createBusinessScopedPersistentCollection<PurchaseList>({
      collectionName: "production/purchase-lists",
      getId: (list) => list.purchaseListId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.clarificationAnswers = createBusinessScopedPersistentCollection<ProductionClarificationAnswer>({
      collectionName: "production/clarification-answers",
      getId: (answer) => answer.answerId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.clarificationDrafts = createBusinessScopedPersistentCollection<ClarificationDraft>({
      collectionName: "production/clarification-drafts",
      getId: (draft) => draft.draftId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    const decisionCollections = createProductionDecisionCollections(storage);
    this.productionDrafts = decisionCollections.drafts;
    this.productionFeedbackDrafts = createBusinessScopedPersistentCollection<ProductionFeedbackDraft>({
      collectionName: "production/feedback-drafts",
      getId: (draft) => draft.feedbackId,
      validate: validateProductionFeedbackDraftForStorage,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.approvals = decisionCollections.approvals;
    this.approvedProductionSpecs = decisionCollections.approvedProductionSpecs;
    this.applyManifests = createBusinessScopedPersistentCollection<ProductionApplyManifest>({
      collectionName: "production/apply-manifests",
      getId: (manifest) => manifest.approvedProductionSpecId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    const caseCollections = createProductionCaseCollections(storage);
    this.cases = caseCollections.cases;
    this.caseEvents = caseCollections.events;
    registerProductionDecisionRepository(this, storage, decisionCollections);
  }

  async savePlan(context: BusinessContext, plan: ProductionPlan): Promise<void> {
    assertBusinessContext(context);
    await this.plans.set(context, plan);
  }

  async insertPlan(context: BusinessContext, plan: ProductionPlan): Promise<"created" | "exists"> {
    assertBusinessContext(context);
    return this.plans.insert(context, plan);
  }

  async getPlan(context: BusinessContext, id: string): Promise<ProductionPlan | undefined> {
    assertBusinessContext(context);
    return this.plans.get(context, id);
  }

  async savePurchaseList(context: BusinessContext, list: PurchaseList): Promise<void> {
    assertBusinessContext(context);
    await this.purchaseLists.set(context, list);
  }

  async insertPurchaseList(context: BusinessContext, list: PurchaseList): Promise<"created" | "exists"> {
    assertBusinessContext(context);
    return this.purchaseLists.insert(context, list);
  }

  async getPurchaseList(context: BusinessContext, id: string): Promise<PurchaseList | undefined> {
    assertBusinessContext(context);
    return this.purchaseLists.get(context, id);
  }

  async listPlans(context: BusinessContext): Promise<ProductionPlan[]> {
    assertBusinessContext(context);
    return this.plans.list(context);
  }

  async listPurchaseLists(context: BusinessContext): Promise<PurchaseList[]> {
    assertBusinessContext(context);
    return this.purchaseLists.list(context);
  }

  async saveClarificationAnswer(
    context: BusinessContext,
    answer: ProductionClarificationAnswer
  ): Promise<void> {
    assertBusinessContext(context);
    await this.clarificationAnswers.set(context, validateProductionClarificationAnswerForStorage(answer));
  }

  async getClarificationAnswer(
    context: BusinessContext,
    id: string
  ): Promise<ProductionClarificationAnswer | undefined> {
    assertBusinessContext(context);
    return this.clarificationAnswers.get(context, id);
  }

  async listClarificationAnswers(context: BusinessContext): Promise<ProductionClarificationAnswer[]> {
    assertBusinessContext(context);
    return this.clarificationAnswers.list(context);
  }

  async saveClarificationDraft(
    context: BusinessContext,
    draft: ClarificationDraft
  ): Promise<void> {
    assertBusinessContext(context);
    await this.clarificationDrafts.set(context, validateClarificationDraftForStorage(draft));
  }

  async getClarificationDraft(context: BusinessContext, id: string): Promise<ClarificationDraft | undefined> {
    assertBusinessContext(context);
    return this.clarificationDrafts.get(context, id);
  }

  async listClarificationDrafts(
    context: BusinessContext,
    specId?: string
  ): Promise<ClarificationDraft[]> {
    assertBusinessContext(context);
    const drafts = await this.clarificationDrafts.list(context);
    return drafts
      .filter((draft) => !specId || draft.specId === specId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async saveProductionDraft(context: BusinessContext, draft: ProductionDraft): Promise<void> {
    assertBusinessContext(context);
    const normalized = productionDraftForContext(context, draft);
    const target = productionDraftTarget(normalized);
    await productionDecisionRepositoryFor(this).withTargetCriticalSection(context, target, async (scope) => {
      const existing = await scope.getDraft(normalized.draftId);
      if (existing && existing.revision !== normalized.revision) {
        throw new Error("ProductionDraft-ID und Revision bilden eine unveränderliche Identität.");
      }
      const aggregate = await scope.getDecisionAggregate(
        approvalRequestIdForTarget({ businessId: context.businessId, target })
      );
      if (aggregate) {
        validateProductionDecisionAggregate(aggregate);
        if (!areJsonValuesEqual(normalized, aggregate.decidedDraft)) {
          throw new Error("Eine entschiedene ProductionDraft-Revision ist unveränderlich.");
        }
        await scope.setDraft(normalized);
        return;
      }
      const approvals = await scope.listApprovalsForTarget();
      if (approvals.length > 0) {
        if (existing && areJsonValuesEqual(existing, normalized)) return;
        throw new Error("ProductionDraft-Revision ist durch persistierte Freigabeevidenz eingefroren.");
      }
      await scope.setDraft(normalized);
    });
  }

  async insertProductionDraft(
    context: BusinessContext,
    draft: ProductionDraft
  ): Promise<"created" | "exists"> {
    assertBusinessContext(context);
    const normalized = productionDraftForContext(context, draft);
    const target = productionDraftTarget(normalized);
    return productionDecisionRepositoryFor(this).withTargetCriticalSection(context, target, async (scope) => {
      const aggregate = await scope.getDecisionAggregate(
        approvalRequestIdForTarget({ businessId: context.businessId, target })
      );
      const approvals = await scope.listApprovalsForTarget();
      if (aggregate || approvals.length > 0) {
        const existing = await scope.getDraft(normalized.draftId);
        if (existing && areJsonValuesEqual(existing, normalized)) return "exists";
        throw new Error("ProductionDraft-Revision ist durch persistierte Freigabeevidenz eingefroren.");
      }
      return scope.insertDraft(normalized);
    });
  }

  async getProductionDraft(
    context: BusinessContext,
    draftId: string
  ): Promise<ProductionDraft | undefined> {
    assertBusinessContext(context);
    const draft = await this.productionDrafts.get(context, draftId);
    return draft ? productionDraftForContext(context, draft) : undefined;
  }

  async listProductionDrafts(context: BusinessContext): Promise<ProductionDraft[]> {
    assertBusinessContext(context);
    const drafts = await this.productionDrafts.list(context);
    return drafts
      .map((draft) => productionDraftForContext(context, draft))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async saveProductionFeedbackDraft(
    context: BusinessContext,
    draft: ProductionFeedbackDraft
  ): Promise<void> {
    assertBusinessContext(context);
    await this.productionFeedbackDrafts.set(context, validateProductionFeedbackDraftForStorage(draft));
  }

  async getProductionFeedbackDraft(
    context: BusinessContext,
    id: string
  ): Promise<ProductionFeedbackDraft | undefined> {
    assertBusinessContext(context);
    return this.productionFeedbackDrafts.get(context, id);
  }

  async listProductionFeedbackDrafts(context: BusinessContext): Promise<ProductionFeedbackDraft[]> {
    assertBusinessContext(context);
    const drafts = await this.productionFeedbackDrafts.list(context);
    return drafts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listReviewedProductionFeedbackKnowledge(
    context: BusinessContext
  ): Promise<ReviewedProductionFeedbackKnowledge[]> {
    assertBusinessContext(context);
    const drafts = await this.listProductionFeedbackDrafts(context);
    return drafts.filter((draft): draft is ReviewedProductionFeedbackKnowledge =>
      draft.status === "approved" && Boolean(draft.approvedBy) && Boolean(draft.approvedAt)
    );
  }

  async insertApproval(context: BusinessContext, record: ApprovalRequestRecord): Promise<"created" | "exists"> {
    assertBusinessContext(context);
    return productionDecisionRepositoryFor(this).withTargetCriticalSection(
      context,
      record.target,
      (scope) => scope.insertApproval(record)
    );
  }

  async getApproval(context: BusinessContext, id: string): Promise<ApprovalRequestRecord | undefined> {
    assertBusinessContext(context);
    return this.approvals.get(context, id);
  }

  async listApprovalsForTarget(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"]
  ): Promise<ApprovalRequestRecord[]> {
    assertBusinessContext(context);
    return (await this.approvals.list(context)).filter((record) =>
      record.target.kind === target.kind &&
      record.target.artifactId === target.artifactId &&
      record.target.revision === target.revision
    );
  }

  async insertApprovedProductionSpec(
    context: BusinessContext,
    value: ApprovedProductionSpec
  ): Promise<"created" | "exists"> {
    assertBusinessContext(context);
    const spec = validateApprovedProductionSpec(value);
    const target = {
      kind: "production_draft" as const,
      artifactId: spec.sourceDraft.draftId,
      revision: spec.sourceDraft.revision
    };
    return productionDecisionRepositoryFor(this).withTargetCriticalSection(context, target, async (scope) => {
      const approval = await scope.getApproval(spec.approvalRequestId);
      if (
        !approval ||
        approval.decision !== "approved" ||
        approval.businessId !== context.businessId ||
        spec.businessId !== context.businessId ||
        approval.target.kind !== target.kind ||
        approval.target.artifactId !== target.artifactId ||
        approval.target.revision !== target.revision
      ) {
        throw new Error(
          "ApprovedProductionSpec benötigt eine persistierte, freigegebene ApprovalRequestRecord für denselben Betrieb, dasselbe Ziel und dieselbe Revision."
        );
      }
      if (
        spec.approvalRequestId !== approval.approvalRequestId ||
        spec.approvedProductionSpecId !== approvedProductionSpecIdForApproval(approval.approvalRequestId) ||
        spec.approvedAt !== approval.decidedAt
      ) {
        throw new Error("ApprovedProductionSpec stimmt nicht exakt mit der persistierten Freigabe überein.");
      }
      const aggregate = await scope.getDecisionAggregate(approval.approvalRequestId);
      try {
        if (!aggregate) throw new Error("missing aggregate");
        validateProductionDecisionAggregate(aggregate);
      } catch {
        throw new Error("ApprovedProductionSpec benötigt ein exakt passendes autoritatives Produktionsentscheidungsaggregat.");
      }
      if (!areJsonValuesEqual(aggregate.approvedProductionSpec, spec)) {
        throw new Error("ApprovedProductionSpec stimmt nicht exakt mit der persistierten Freigabe überein.");
      }
      return scope.insertApprovedProductionSpec(spec);
    });
  }

  async getApprovedProductionSpec(
    context: BusinessContext,
    id: string
  ): Promise<ApprovedProductionSpec | undefined> {
    assertBusinessContext(context);
    return this.approvedProductionSpecs.get(context, id);
  }

  async listApprovedProductionSpecs(context: BusinessContext): Promise<ApprovedProductionSpec[]> {
    assertBusinessContext(context);
    return this.approvedProductionSpecs.list(context);
  }

  async insertApplyManifest(
    context: BusinessContext,
    value: ProductionApplyManifest
  ): Promise<"created" | "exists"> {
    assertBusinessContext(context);
    return this.applyManifests.insert(context, value);
  }

  async getApplyManifest(
    context: BusinessContext,
    approvedProductionSpecId: string
  ): Promise<ProductionApplyManifest | undefined> {
    assertBusinessContext(context);
    return this.applyManifests.get(context, approvedProductionSpecId);
  }

  async listApplyManifests(context: BusinessContext): Promise<ProductionApplyManifest[]> {
    assertBusinessContext(context);
    return this.applyManifests.list(context);
  }

  async insertCase(context: BusinessContext, item: ProductionCase): Promise<"created" | "exists"> {
    return this.createCase(context, item);
  }

  async createCase(context: BusinessContext, item: ProductionCase): Promise<"created" | "exists"> {
    assertBusinessContext(context);
    const storage = this.storageOptions;
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "production_case", artifactId: item.caseId, revision: 0 },
      collectionNamespace: "production/case-events",
      queueFullMessage: "Die Warteschlange für Produktionsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Produktionsverläufe ist ausgeschöpft.",
      timeoutMessage: "Der Produktionsverlauf konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Produktionsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Produktionsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: (transactionalQueryable) => createProductionCaseInCollections(
        transactionalQueryable
          ? createProductionCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents },
        context,
        item
      )
    });
  }

  async getCase(context: BusinessContext, caseId: string): Promise<ProductionCase | undefined> {
    assertBusinessContext(context);
    return this.cases.get(context, caseId);
  }

  // The first canonical spec establishes the case lineage; later revisions keep the ID,
  // while a different event must start in a separate ProductionCase.
  async bindCaseToSourceSpec(
    context: BusinessContext,
    caseId: string,
    sourceSpecId: string,
    at: string
  ): Promise<"bound" | "already_bound" | "conflict" | "missing"> {
    assertBusinessContext(context);
    const storage = this.storageOptions;
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "production_case", artifactId: caseId, revision: 0 },
      collectionNamespace: "production/case-events",
      queueFullMessage: "Die Warteschlange für Produktionsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Produktionsverläufe ist ausgeschöpft.",
      timeoutMessage: "Der Produktionsverlauf konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Produktionsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Produktionsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable) => {
        const collections = transactionalQueryable
          ? createProductionCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents };
        const existing = await collections.cases.get(context, caseId);
        if (!existing) return "missing";
        if (existing.sourceSpecId === sourceSpecId) return "already_bound";
        if (existing.sourceSpecId) return "conflict";

        const next = validateProductionCase({
          ...existing,
          sourceSpecId,
          version: existing.version + 1,
          updatedAt: at
        });
        const result = await collections.cases.compareAndSet(
          context,
          caseId,
          existing.version,
          next
        );
        if (result === "updated") return "bound";

        const raced = await collections.cases.get(context, caseId);
        if (!raced) return "missing";
        return raced.sourceSpecId === sourceSpecId ? "already_bound" : "conflict";
      }
    });
  }

  async advanceCaseSourceSpec(
    context: BusinessContext,
    caseId: string,
    expectedSourceSpecId: string | undefined,
    nextSourceSpecId: string,
    at: string
  ): Promise<"advanced" | "already_bound" | "conflict" | "missing"> {
    assertBusinessContext(context);
    const storage = this.storageOptions;
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "production_case", artifactId: caseId, revision: 0 },
      collectionNamespace: "production/case-events",
      queueFullMessage: "Die Warteschlange für Produktionsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Produktionsverläufe ist ausgeschöpft.",
      timeoutMessage: "Der Produktionsverlauf konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Produktionsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Produktionsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable) => {
        const collections = transactionalQueryable
          ? createProductionCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents };
        const existing = await collections.cases.get(context, caseId);
        if (!existing) return "missing";
        if (existing.sourceSpecId === nextSourceSpecId) return "already_bound";
        if (existing.sourceSpecId !== expectedSourceSpecId) return "conflict";

        // A corrected source document advances the current view of one event. The immutable
        // drafts and timeline retain every earlier specification; unrelated spec imports still
        // use bindCaseToSourceSpec and cannot replace the established event lineage.
        const next = validateProductionCase({
          ...existing,
          sourceSpecId: nextSourceSpecId,
          version: existing.version + 1,
          updatedAt: at
        });
        const result = await collections.cases.compareAndSet(context, caseId, existing.version, next);
        if (result === "updated") return "advanced";

        const raced = await collections.cases.get(context, caseId);
        if (!raced) return "missing";
        if (raced.sourceSpecId === nextSourceSpecId) return "already_bound";
        return "conflict";
      }
    });
  }

  async commitDraftForCaseSource<T>(
    context: BusinessContext,
    input: {
      caseId: string;
      expectedSourceSpecId: string | undefined;
      nextSourceSpecId: string;
      at: string;
      draftTarget: ApprovalRequestRecord["target"];
      commitDraft: (scope: ProductionDecisionTargetScope) => Promise<ProductionCaseDraftMutation<T>>;
    }
  ): Promise<ProductionCaseDraftCommitResult<T>> {
    assertBusinessContext(context);
    const storage = this.storageOptions;
    const caseTarget = {
      kind: "production_case",
      artifactId: input.caseId,
      revision: 0
    };
    const draftTargets = [
      { ...input.draftTarget, revision: 0 },
      input.draftTarget
    ];

    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: caseTarget,
      // PostgreSQL advisory locks do not include the collection namespace. Taking the
      // draft identities here lets one transaction protect both records. File mode also
      // takes the established decision lock below while the case lock remains held.
      compatibilityTargets: draftTargets,
      collectionNamespace: "production/case-events",
      queueFullMessage: "Die Warteschlange für Produktionsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Produktionsverläufe ist ausgeschöpft.",
      timeoutMessage: "Produktionsauftrag und Entwurf konnten nicht rechtzeitig gemeinsam gesperrt werden.",
      legacyTimeoutMessage: "Der alte Produktionsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Produktionsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable) => {
        const caseCollections = transactionalQueryable
          ? createProductionCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents };
        const current = await caseCollections.cases.get(context, input.caseId);
        if (!current) return { status: "case_missing" as const };
        if (
          current.sourceSpecId !== input.nextSourceSpecId &&
          current.sourceSpecId !== input.expectedSourceSpecId
        ) {
          return { status: "case_conflict" as const };
        }

        const mutateDraft = (scope: ProductionDecisionTargetScope) => input.commitDraft(scope);
        const draftMutation = transactionalQueryable
          ? await mutateDraft(productionDecisionTargetScopeFor(
            createProductionDecisionCollections({ pgPool: transactionalQueryable }),
            context,
            input.draftTarget
          ))
          : await productionDecisionRepositoryFor(this).withTargetCriticalSection(
            context,
            input.draftTarget,
            mutateDraft
          );
        if (draftMutation.status === "conflict") {
          return { status: "draft_conflict" as const };
        }
        if (current.sourceSpecId === input.nextSourceSpecId) {
          return { status: "committed" as const, value: draftMutation.value };
        }

        const next = validateProductionCase({
          ...current,
          sourceSpecId: input.nextSourceSpecId,
          version: current.version + 1,
          updatedAt: input.at
        });
        const updated = await caseCollections.cases.compareAndSet(
          context,
          input.caseId,
          current.version,
          next
        );
        if (updated === "updated") {
          return { status: "committed" as const, value: draftMutation.value };
        }
        if (updated === "missing") return { status: "case_missing" as const };
        const raced = await caseCollections.cases.get(context, input.caseId);
        return raced?.sourceSpecId === input.nextSourceSpecId
          ? { status: "committed" as const, value: draftMutation.value }
          : { status: "case_conflict" as const };
      }
    });
  }

  async reopenCaseForDraftContinuation(
    context: BusinessContext,
    caseId: string,
    draftId: string
  ): Promise<"reopened" | "unchanged" | "missing"> {
    assertBusinessContext(context);
    const storage = this.storageOptions;
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "production_case", artifactId: caseId, revision: 0 },
      collectionNamespace: "production/case-events",
      queueFullMessage: "Die Warteschlange für Produktionsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Produktionsverläufe ist ausgeschöpft.",
      timeoutMessage: "Der Produktionsverlauf konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Produktionsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Produktionsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable) => {
        const collections = transactionalQueryable
          ? createProductionCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents };
        const current = await collections.cases.get(context, caseId);
        if (!current) return "missing";

        const events = (await collections.events.list(context))
          .filter((event) => event.caseId === caseId);
        const continuationEvents = events.filter((event) =>
          (event.kind === "draft_created" || event.kind === "revision_created") &&
          event.artifactId === draftId
        );
        if (continuationEvents.length !== 1) {
          throw new Error("ProductionDraft ist nicht eindeutig mit dem Produktionsauftrag verknüpft.");
        }
        const draftEvent = continuationEvents[0]!;
        const latestDownstreamSequence = events
          .filter((event) => event.kind === "approval" || event.kind === "result")
          .reduce((maximum, event) => Math.max(maximum, event.sequence), 0);

        // A retry of an already approved/applied draft must not reopen the case. Only a draft
        // event later in the same timeline is a genuine continuation that invalidates old results.
        if (draftEvent.sequence <= latestDownstreamSequence || current.status === "archived") {
          return "unchanged";
        }
        if (
          current.status === "open" &&
          current.approvedProductionSpecId === undefined &&
          current.currentPlanId === undefined &&
          current.currentPurchaseListId === undefined
        ) {
          return "unchanged";
        }

        const {
          approvedProductionSpecId: _approvedProductionSpecId,
          currentPlanId: _currentPlanId,
          currentPurchaseListId: _currentPurchaseListId,
          ...caseWithoutOldResults
        } = current;
        const next = validateProductionCase({
          ...caseWithoutOldResults,
          status: "open",
          version: current.version + 1,
          updatedAt: current.updatedAt > draftEvent.at ? current.updatedAt : draftEvent.at
        });
        const updated = await collections.cases.compareAndSet(context, caseId, current.version, next);
        if (updated === "updated") return "reopened";
        if (updated === "missing") return "missing";
        throw new Error("Produktionsauftrag wurde gleichzeitig verändert.");
      }
    });
  }

  async listCases(context: BusinessContext): Promise<ProductionCase[]> {
    assertBusinessContext(context);
    return sortCasesByLatestActivity(
      await this.cases.list(context),
      await this.caseEvents.list(context)
    );
  }

  async updateCase(
    context: BusinessContext,
    caseId: string,
    expectedVersion: number,
    next: ProductionCase
  ): Promise<"updated" | "conflict" | "missing"> {
    assertBusinessContext(context);
    const existing = await this.cases.get(context, caseId);
    if (!existing) return "missing";
    assertProductionCaseUpdate(existing, next, expectedVersion);
    return this.cases.compareAndSet(context, caseId, expectedVersion, next);
  }

  async appendEvent(
    context: BusinessContext,
    caseId: string,
    input: CaseEventInput,
    eventIdentity?: string
  ): Promise<CaseEvent> {
    assertBusinessContext(context);
    const storage = this.storageOptions;
    return withBusinessTargetCriticalSection({
      storage,
      context,
      target: { kind: "production_case", artifactId: caseId, revision: 0 },
      collectionNamespace: "production/case-events",
      queueFullMessage: "Die Warteschlange für Produktionsverläufe benötigt eine betriebliche Bereinigung.",
      queueExhaustedMessage: "Die Warteschlange für Produktionsverläufe ist ausgeschöpft.",
      timeoutMessage: "Der Produktionsverlauf konnte nicht rechtzeitig gesperrt werden.",
      legacyTimeoutMessage: "Der alte Produktionsverlauf konnte nicht rechtzeitig entsperrt werden.",
      postgresPoolMessage: "PostgreSQL-Produktionsverläufe benötigen einen Pool mit exklusivem Client-Checkout.",
      operation: async (transactionalQueryable) => {
        const collections = transactionalQueryable
          ? createProductionCaseCollections({ rootDir: storage.rootDir, pgPool: transactionalQueryable })
          : { cases: this.cases, events: this.caseEvents };
        if (!await collections.cases.get(context, caseId)) {
          throw new Error("ProductionCase wurde nicht gefunden.");
        }
        const eventId = eventIdentity
          ? `production-case-event-${createHash("sha256")
            .update(`${context.businessId}\0${caseId}\0${input.kind}\0${eventIdentity}`)
            .digest("hex")}`
          : `production-case-event-${randomUUID()}`;
        const existing = await collections.events.get(context, eventId);
        if (existing) {
          const expected = validateCaseEventForProduct({
            ...input,
            businessId: context.businessId,
            eventId,
            caseId,
            sequence: existing.sequence
          }, "production");
          if (!areJsonValuesEqual(existing, expected)) {
            throw new Error("Bestehendes Produktionsereignis stimmt nicht mit dem Auftrag überein.");
          }
          return existing;
        }
        const sequence = (await collections.events.list(context))
          .filter((event) => event.caseId === caseId)
          .reduce((maximum, event) => Math.max(maximum, event.sequence), 0) + 1;
        const event = validateCaseEventForProduct({
          ...input,
          businessId: context.businessId,
          eventId,
          caseId,
          sequence
        }, "production");
        if (await collections.events.insert(context, event) !== "created") {
          const raced = await collections.events.get(context, eventId);
          if (raced && areJsonValuesEqual(raced, event)) return raced;
          throw new Error("Der Produktionsverlauf konnte nicht eindeutig fortgeschrieben werden.");
        }
        return event;
      }
    });
  }

  async listEvents(context: BusinessContext, caseId: string): Promise<CaseEvent[]> {
    assertBusinessContext(context);
    if (!await this.cases.get(context, caseId)) throw new Error("ProductionCase wurde nicht gefunden.");
    return (await this.caseEvents.list(context))
      .filter((event) => event.caseId === caseId)
      .sort((left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId));
  }

  async appendEventForArtifactCase(
    context: BusinessContext,
    sourceArtifactId: string,
    input: CaseEventInput,
    eventIdentity = input.artifactId ?? sourceArtifactId
  ): Promise<CaseEvent | undefined> {
    assertBusinessContext(context);
    const caseId = await this.findCaseIdForArtifact(context, sourceArtifactId);
    if (!caseId) return undefined;
    return this.appendEvent(context, caseId, input, eventIdentity);
  }

  async findCaseIdForArtifact(context: BusinessContext, sourceArtifactId: string): Promise<string | undefined> {
    assertBusinessContext(context);
    const linkedCaseIds = [...new Set((await this.caseEvents.list(context))
      .filter((event) =>
        event.artifactId === sourceArtifactId || event.revisionRef?.artifactId === sourceArtifactId
      )
      .map((event) => event.caseId))];
    if (linkedCaseIds.length > 1) {
      throw new Error("Produktionsartefakt ist mehreren Produktionsaufträgen zugeordnet.");
    }
    return linkedCaseIds[0];
  }

  async searchCases(context: BusinessContext, query: string): Promise<ProductionCase[]> {
    assertBusinessContext(context);
    const normalizedQuery = normalizeCaseSearchText(query);
    const cases = await this.listCases(context);
    if (!normalizedQuery) return cases;
    const events = await this.caseEvents.list(context);
    const sourceNamesByCase = new Map<string, string[]>();
    for (const event of events) {
      const filename = event.sourceRef?.filename;
      if (!filename) continue;
      const names = sourceNamesByCase.get(event.caseId) ?? [];
      names.push(filename);
      sourceNamesByCase.set(event.caseId, names);
    }
    return cases.filter((item) => normalizeCaseSearchText([
      item.displayName,
      ...(sourceNamesByCase.get(item.caseId) ?? [])
    ].join(" ")).includes(normalizedQuery));
  }
}

function assertBusinessContext(context: BusinessContext): void {
  if (!context || typeof context.businessId !== "string" || context.businessId.trim().length === 0) {
    throw new Error("Ein nicht leerer Betriebskontext ist erforderlich.");
  }
}

function productionDraftForContext(
  context: BusinessContext,
  draft: ProductionDraft
): ProductionDraft {
  const normalized = validateProductionDraft({
    ...draft,
    businessId: draft.businessId ?? context.businessId
  });
  if (normalized.businessId !== context.businessId) {
    throw new Error("ProductionDraft passt nicht zum vertrauenswürdigen Betriebskontext.");
  }
  return normalized;
}

function productionDraftTarget(draft: ProductionDraft): ApprovalRequestRecord["target"] {
  return {
    kind: "production_draft",
    artifactId: draft.draftId,
    revision: draft.revision
  };
}

function isClarificationDraftQuestion(question: unknown): question is ClarificationDraftQuestion {
  return typeof question === "object" &&
    question !== null &&
    isNonEmptyString((question as ClarificationDraftQuestion).text) &&
    isNonEmptyString((question as ClarificationDraftQuestion).reason) &&
    isNonEmptyString((question as ClarificationDraftQuestion).reasonCode);
}

function isClarificationDraft(draft: unknown): draft is ClarificationDraft {
  const candidate = draft as ClarificationDraft;
  return typeof draft === "object" &&
    draft !== null &&
    isNonEmptyString(candidate.draftId) &&
    isNonEmptyString(candidate.specId) &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length > 0 &&
    candidate.questions.every(isClarificationDraftQuestion) &&
    (candidate.status === "pending_review" || candidate.status === "approved" || candidate.status === "rejected") &&
    isNonEmptyString(candidate.createdAt) &&
    isNonEmptyString(candidate.updatedAt) &&
    isNonEmptyString(candidate.createdBy?.name) &&
    isNonEmptyString(candidate.createdBy?.source) &&
    isNonEmptyString(candidate.modelMetadata?.adapterId) &&
    (candidate.modelMetadata.adapterMode === "fixture_only" || candidate.modelMetadata.adapterMode === "synthetic_live") &&
    isNonEmptyString(candidate.modelMetadata.inputId);
}

export function validateProductionClarificationAnswerForStorage(
  answer: ProductionClarificationAnswer
): ProductionClarificationAnswer {
  if (!isSubmittedShortTextAnswer(answer)) {
    throw new Error("Nur submitted shortText-Klärungsantworten dürfen gespeichert werden.");
  }
  return safeClarificationAnswerForStorage(answer);
}

export function validateClarificationDraftForStorage(draft: ClarificationDraft): ClarificationDraft {
  if (!isClarificationDraft(draft)) {
    throw new Error("Ungültiger Rückfragen-Entwurf.");
  }
  return structuredClone(draft);
}
