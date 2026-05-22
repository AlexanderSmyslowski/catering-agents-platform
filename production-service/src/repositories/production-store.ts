import {
  createPersistentCollection,
  productionClarificationAnswerTextMaxLength,
  type CollectionStorageOptions,
  type PersistentCollection,
  type ProductionClarificationAnswer,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";

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
  return typeof answer.answerId === "string" &&
    Boolean(answer.answerId.trim()) &&
    typeof answer.context?.specId === "string" &&
    Boolean(answer.context.specId.trim()) &&
    typeof answer.context?.productionSessionId === "string" &&
    Boolean(answer.context.productionSessionId.trim()) &&
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
}
