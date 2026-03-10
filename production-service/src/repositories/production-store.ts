import type { ProductionPlan, PurchaseList } from "@catering/shared-core";

export class ProductionStore {
  private readonly plans = new Map<string, ProductionPlan>();
  private readonly purchaseLists = new Map<string, PurchaseList>();

  savePlan(plan: ProductionPlan): void {
    this.plans.set(plan.planId, plan);
  }

  getPlan(planId: string): ProductionPlan | undefined {
    return this.plans.get(planId);
  }

  savePurchaseList(list: PurchaseList): void {
    this.purchaseLists.set(list.purchaseListId, list);
  }

  getPurchaseList(listId: string): PurchaseList | undefined {
    return this.purchaseLists.get(listId);
  }
}

