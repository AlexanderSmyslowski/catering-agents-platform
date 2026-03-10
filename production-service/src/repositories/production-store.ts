import {
  createPersistentCollection,
  type CollectionStorageOptions,
  type PersistentCollection,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";

export class ProductionStore {
  private readonly plans: PersistentCollection<ProductionPlan>;
  private readonly purchaseLists: PersistentCollection<PurchaseList>;

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
}
