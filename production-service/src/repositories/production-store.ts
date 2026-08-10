import {
  createBusinessScopedPersistentCollection,
  createPersistentCollection,
  llmReadinessForbiddenPayloadKeys,
  productionClarificationAnswerTextMaxLength,
  type BusinessContext,
  type BusinessScopedPersistentCollection,
  type CollectionStorageOptions,
  type LlmReadinessAgentAuditRecord,
  type LlmReadinessProviderAdapterMode,
  type PersistentCollection,
  type ProductionClarificationAnswer,
  type ProductionDraft,
  type ProductionDraftGuardrails,
  type ProductionPlan,
  type PurchaseList,
  type TrustedActor,
  validateProductionDraft
} from "@catering/shared-core";

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
  private readonly plans: PersistentCollection<ProductionPlan>;
  private readonly purchaseLists: PersistentCollection<PurchaseList>;
  private readonly clarificationAnswers: PersistentCollection<ProductionClarificationAnswer>;
  private readonly clarificationDrafts: PersistentCollection<ClarificationDraft>;
  private readonly productionDrafts: BusinessScopedPersistentCollection<ProductionDraft>;
  private readonly productionFeedbackDrafts: PersistentCollection<ProductionFeedbackDraft>;

  constructor(options?: CollectionStorageOptions) {
    this.plans = createPersistentCollection<ProductionPlan>({
      collectionName: "production/plans",
      getId: (plan) => plan.planId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.purchaseLists = createPersistentCollection<PurchaseList>({
      collectionName: "production/purchase-lists",
      getId: (list) => list.purchaseListId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.clarificationAnswers = createPersistentCollection<ProductionClarificationAnswer>({
      collectionName: "production/clarification-answers",
      getId: (answer) => answer.answerId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.clarificationDrafts = createPersistentCollection<ClarificationDraft>({
      collectionName: "production/clarification-drafts",
      getId: (draft) => draft.draftId,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.productionDrafts = createBusinessScopedPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
    this.productionFeedbackDrafts = createPersistentCollection<ProductionFeedbackDraft>({
      collectionName: "production/feedback-drafts",
      getId: (draft) => draft.feedbackId,
      validate: normalizeProductionFeedbackDraft,
      rootDir: options?.rootDir,
      databaseUrl: options?.databaseUrl,
      pgPool: options?.pgPool
    });
  }

  async savePlan(plan: ProductionPlan): Promise<void> {
    await this.plans.set(plan);
  }

  async getPlan(planId: string): Promise<ProductionPlan | undefined> {
    return this.plans.get(planId);
  }

  async savePurchaseList(list: PurchaseList): Promise<void> {
    await this.purchaseLists.set(list);
  }

  async getPurchaseList(listId: string): Promise<PurchaseList | undefined> {
    return this.purchaseLists.get(listId);
  }

  async listPlans(): Promise<ProductionPlan[]> {
    return this.plans.list();
  }

  async listPurchaseLists(): Promise<PurchaseList[]> {
    return this.purchaseLists.list();
  }

  async saveClarificationAnswer(answer: ProductionClarificationAnswer): Promise<void> {
    if (!isSubmittedShortTextAnswer(answer)) {
      throw new Error("Nur submitted shortText-Klärungsantworten dürfen gespeichert werden.");
    }

    await this.clarificationAnswers.set(safeClarificationAnswerForStorage(answer));
  }

  async getClarificationAnswer(answerId: string): Promise<ProductionClarificationAnswer | undefined> {
    return this.clarificationAnswers.get(answerId);
  }

  async listClarificationAnswers(): Promise<ProductionClarificationAnswer[]> {
    return this.clarificationAnswers.list();
  }

  async saveClarificationDraft(draft: ClarificationDraft): Promise<void> {
    if (!isClarificationDraft(draft)) {
      throw new Error("Ungültiger Rückfragen-Entwurf.");
    }

    await this.clarificationDrafts.set(draft);
  }

  async getClarificationDraft(draftId: string): Promise<ClarificationDraft | undefined> {
    return this.clarificationDrafts.get(draftId);
  }

  async listClarificationDrafts(specId?: string): Promise<ClarificationDraft[]> {
    const drafts = await this.clarificationDrafts.list();
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

  async saveProductionFeedbackDraft(draft: ProductionFeedbackDraft): Promise<void> {
    await this.productionFeedbackDrafts.set(normalizeProductionFeedbackDraft(draft));
  }

  async getProductionFeedbackDraft(feedbackId: string): Promise<ProductionFeedbackDraft | undefined> {
    return this.productionFeedbackDrafts.get(feedbackId);
  }

  async listProductionFeedbackDrafts(): Promise<ProductionFeedbackDraft[]> {
    const drafts = await this.productionFeedbackDrafts.list();
    return drafts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listReviewedProductionFeedbackKnowledge(): Promise<ReviewedProductionFeedbackKnowledge[]> {
    const drafts = await this.listProductionFeedbackDrafts();
    return drafts.filter((draft): draft is ReviewedProductionFeedbackKnowledge =>
      draft.status === "approved" && Boolean(draft.approvedBy) && Boolean(draft.approvedAt)
    );
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
