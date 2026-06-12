import {
  createPersistentCollection,
  productionClarificationAnswerTextMaxLength,
  type CollectionStorageOptions,
  type LlmReadinessAgentAuditRecord,
  type LlmReadinessProviderAdapterMode,
  type PersistentCollection,
  type ProductionClarificationAnswer,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";

export type ClarificationDraftStatus = "pending_review" | "approved" | "rejected";

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
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
