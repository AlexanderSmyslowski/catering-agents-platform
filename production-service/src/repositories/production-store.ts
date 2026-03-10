import {
  FileBackedCollection,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";

export class ProductionStore {
  private readonly plans: FileBackedCollection<ProductionPlan>;
  private readonly purchaseLists: FileBackedCollection<PurchaseList>;

  constructor(options?: { dataRoot?: string }) {
    this.plans = new FileBackedCollection({
      collectionName: "production/plans",
      getId: (plan) => plan.planId,
      rootDir: options?.dataRoot
    });
    this.purchaseLists = new FileBackedCollection({
      collectionName: "production/purchase-lists",
      getId: (list) => list.purchaseListId,
      rootDir: options?.dataRoot
    });
  }

  savePlan(plan: ProductionPlan): void {
    this.plans.set(plan);
  }

  getPlan(planId: string): ProductionPlan | undefined {
    return this.plans.get(planId);
  }

  savePurchaseList(list: PurchaseList): void {
    this.purchaseLists.set(list);
  }

  getPurchaseList(listId: string): PurchaseList | undefined {
    return this.purchaseLists.get(listId);
  }

  listPlans(): ProductionPlan[] {
    return this.plans.list();
  }

  listPurchaseLists(): PurchaseList[] {
    return this.purchaseLists.list();
  }
}
