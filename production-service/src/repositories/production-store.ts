import {
  createBusinessScopedPersistentCollection,
  llmReadinessForbiddenPayloadKeys,
  productionClarificationAnswerTextMaxLength,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type LlmReadinessAgentAuditRecord,
  type LlmReadinessProviderAdapterMode,
  type ApprovedProductionSpec,
  type ApprovalRequestRecord,
  type ProductionApplyManifest,
  type ProductionClarificationAnswer,
  type ProductionDraft,
  type ProductionDraftGuardrails,
  type ProductionPlan,
  type PurchaseList,
  type TrustedActor,
  validateApprovedProductionSpec,
  validateApprovalRequestRecord,
  validateProductionDraft
} from "@catering/shared-core";

const localBusinessContext: BusinessContext = { businessId: "local" };

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

function normalizeProductionFeedbackDraft(value: ProductionFeedbackDraft): ProductionFeedbackDraft {
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

  constructor(options?: CollectionStorageOptions) {
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
    this.productionDrafts = createBusinessScopedPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      getVersion: (draft) => draft.revision,
      validate: validateProductionDraft,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.productionFeedbackDrafts = createBusinessScopedPersistentCollection<ProductionFeedbackDraft>({
      collectionName: "production/feedback-drafts",
      getId: (draft) => draft.feedbackId,
      validate: normalizeProductionFeedbackDraft,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.approvals = createBusinessScopedPersistentCollection<ApprovalRequestRecord>({
      collectionName: "production/approvals",
      getId: (approval) => approval.approvalRequestId,
      validate: validateApprovalRequestRecord,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.approvedProductionSpecs = createBusinessScopedPersistentCollection<ApprovedProductionSpec>({
      collectionName: "production/approved-specs",
      getId: (spec) => spec.approvedProductionSpecId,
      validate: validateApprovedProductionSpec,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.applyManifests = createBusinessScopedPersistentCollection<ProductionApplyManifest>({
      collectionName: "production/apply-manifests",
      getId: (manifest) => manifest.approvedProductionSpecId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async savePlan(contextOrPlan: BusinessContext | ProductionPlan, maybePlan?: ProductionPlan): Promise<void> {
    const [context, plan] = withContext(contextOrPlan, maybePlan);
    await this.plans.set(context, plan);
  }

  async insertPlan(context: BusinessContext, plan: ProductionPlan): Promise<"created" | "exists"> {
    return this.plans.insert(context, plan);
  }

  async getPlan(contextOrId: BusinessContext | string, maybeId?: string): Promise<ProductionPlan | undefined> {
    const [context, id] = withContext(contextOrId, maybeId);
    return this.plans.get(context, id);
  }

  async savePurchaseList(contextOrList: BusinessContext | PurchaseList, maybeList?: PurchaseList): Promise<void> {
    const [context, list] = withContext(contextOrList, maybeList);
    await this.purchaseLists.set(context, list);
  }

  async insertPurchaseList(context: BusinessContext, list: PurchaseList): Promise<"created" | "exists"> {
    return this.purchaseLists.insert(context, list);
  }

  async getPurchaseList(contextOrId: BusinessContext | string, maybeId?: string): Promise<PurchaseList | undefined> {
    const [context, id] = withContext(contextOrId, maybeId);
    return this.purchaseLists.get(context, id);
  }

  async listPlans(context: BusinessContext = localBusinessContext): Promise<ProductionPlan[]> {
    return this.plans.list(context);
  }

  async listPurchaseLists(context: BusinessContext = localBusinessContext): Promise<PurchaseList[]> {
    return this.purchaseLists.list(context);
  }

  async saveClarificationAnswer(
    contextOrAnswer: BusinessContext | ProductionClarificationAnswer,
    maybeAnswer?: ProductionClarificationAnswer
  ): Promise<void> {
    const [context, answer] = withContext(contextOrAnswer, maybeAnswer);
    if (!isSubmittedShortTextAnswer(answer)) {
      throw new Error("Nur submitted shortText-Klärungsantworten dürfen gespeichert werden.");
    }

    await this.clarificationAnswers.set(context, safeClarificationAnswerForStorage(answer));
  }

  async getClarificationAnswer(
    contextOrId: BusinessContext | string,
    maybeId?: string
  ): Promise<ProductionClarificationAnswer | undefined> {
    const [context, id] = withContext(contextOrId, maybeId);
    return this.clarificationAnswers.get(context, id);
  }

  async listClarificationAnswers(context: BusinessContext = localBusinessContext): Promise<ProductionClarificationAnswer[]> {
    return this.clarificationAnswers.list(context);
  }

  async saveClarificationDraft(
    contextOrDraft: BusinessContext | ClarificationDraft,
    maybeDraft?: ClarificationDraft
  ): Promise<void> {
    const [context, draft] = withContext(contextOrDraft, maybeDraft);
    if (!isClarificationDraft(draft)) {
      throw new Error("Ungültiger Rückfragen-Entwurf.");
    }

    await this.clarificationDrafts.set(context, draft);
  }

  async getClarificationDraft(contextOrId: BusinessContext | string, maybeId?: string): Promise<ClarificationDraft | undefined> {
    const [context, id] = withContext(contextOrId, maybeId);
    return this.clarificationDrafts.get(context, id);
  }

  async listClarificationDrafts(
    contextOrSpecId?: BusinessContext | string,
    maybeSpecId?: string
  ): Promise<ClarificationDraft[]> {
    const context = isBusinessContext(contextOrSpecId) ? contextOrSpecId : localBusinessContext;
    const specId = isBusinessContext(contextOrSpecId) ? maybeSpecId : contextOrSpecId;
    const drafts = await this.clarificationDrafts.list(context);
    return drafts
      .filter((draft) => !specId || draft.specId === specId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async saveProductionDraft(context: BusinessContext, draft: ProductionDraft): Promise<void> {
    await this.productionDrafts.set(context, productionDraftForContext(context, draft));
  }

  async insertProductionDraft(
    context: BusinessContext,
    draft: ProductionDraft
  ): Promise<"created" | "exists"> {
    return this.productionDrafts.insert(context, productionDraftForContext(context, draft));
  }

  async getProductionDraft(
    context: BusinessContext,
    draftId: string
  ): Promise<ProductionDraft | undefined> {
    const draft = await this.productionDrafts.get(context, draftId);
    return draft ? productionDraftForContext(context, draft) : undefined;
  }

  async listProductionDrafts(context: BusinessContext): Promise<ProductionDraft[]> {
    const drafts = await this.productionDrafts.list(context);
    return drafts
      .map((draft) => productionDraftForContext(context, draft))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async saveProductionFeedbackDraft(
    contextOrDraft: BusinessContext | ProductionFeedbackDraft,
    maybeDraft?: ProductionFeedbackDraft
  ): Promise<void> {
    const [context, draft] = withContext(contextOrDraft, maybeDraft);
    await this.productionFeedbackDrafts.set(context, normalizeProductionFeedbackDraft(draft));
  }

  async getProductionFeedbackDraft(
    contextOrId: BusinessContext | string,
    maybeId?: string
  ): Promise<ProductionFeedbackDraft | undefined> {
    const [context, id] = withContext(contextOrId, maybeId);
    return this.productionFeedbackDrafts.get(context, id);
  }

  async listProductionFeedbackDrafts(context: BusinessContext = localBusinessContext): Promise<ProductionFeedbackDraft[]> {
    const drafts = await this.productionFeedbackDrafts.list(context);
    return drafts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listReviewedProductionFeedbackKnowledge(
    context: BusinessContext = localBusinessContext
  ): Promise<ReviewedProductionFeedbackKnowledge[]> {
    const drafts = await this.listProductionFeedbackDrafts(context);
    return drafts.filter((draft): draft is ReviewedProductionFeedbackKnowledge =>
      draft.status === "approved" && Boolean(draft.approvedBy) && Boolean(draft.approvedAt)
    );
  }

  async insertApproval(context: BusinessContext, record: ApprovalRequestRecord): Promise<"created" | "exists"> {
    return this.approvals.insert(context, record);
  }

  async getApproval(context: BusinessContext, id: string): Promise<ApprovalRequestRecord | undefined> {
    return this.approvals.get(context, id);
  }

  async listApprovalsForTarget(
    context: BusinessContext,
    target: ApprovalRequestRecord["target"]
  ): Promise<ApprovalRequestRecord[]> {
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
    return this.approvedProductionSpecs.insert(context, value);
  }

  async getApprovedProductionSpec(
    context: BusinessContext,
    id: string
  ): Promise<ApprovedProductionSpec | undefined> {
    return this.approvedProductionSpecs.get(context, id);
  }

  async listApprovedProductionSpecs(context: BusinessContext): Promise<ApprovedProductionSpec[]> {
    return this.approvedProductionSpecs.list(context);
  }

  async insertApplyManifest(
    context: BusinessContext,
    value: ProductionApplyManifest
  ): Promise<"created" | "exists"> {
    return this.applyManifests.insert(context, value);
  }

  async getApplyManifest(
    context: BusinessContext,
    approvedProductionSpecId: string
  ): Promise<ProductionApplyManifest | undefined> {
    return this.applyManifests.get(context, approvedProductionSpecId);
  }
}

function isBusinessContext(value: unknown): value is BusinessContext {
  return typeof value === "object" && value !== null && typeof (value as BusinessContext).businessId === "string";
}

function withContext<T>(contextOrValue: BusinessContext | T, maybeValue?: T): [BusinessContext, T] {
  if (isBusinessContext(contextOrValue) && maybeValue !== undefined) return [contextOrValue, maybeValue];
  return [localBusinessContext, contextOrValue as T];
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
