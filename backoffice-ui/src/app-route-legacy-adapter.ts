import type { DashboardState, ProductRouteDashboard } from "./api.js";

/**
 * The legacy cards still accept plain records. Keep that compatibility at one
 * named, case-scoped adapter; the route controller and loader contracts stay
 * domain typed and no adapter performs selection or loading.
 */
export function toLegacyDashboardProjection(dashboard: ProductRouteDashboard): DashboardState {
  return {
    intakeRequests: dashboard.intakeRequests.map((request) => ({ ...request })),
    acceptedSpecs: dashboard.acceptedSpecs.map((spec) => ({ ...spec })),
    offerDrafts: dashboard.offerDrafts.map((draft) => ({ ...draft })),
    productionPlans: dashboard.productionPlans.map((plan) => ({ ...plan })),
    purchaseLists: dashboard.purchaseLists.map((purchaseList) => ({ ...purchaseList })),
    recipes: dashboard.recipes.map((recipe) => ({ ...recipe })),
    auditEvents: dashboard.auditEvents.map((event) => ({ ...event }))
  };
}

export function toLegacyRecord<T extends object>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

export function toLegacyRecords<T extends object>(values: T[]): Record<string, unknown>[] {
  return values.map((value) => toLegacyRecord(value));
}

export function toLegacyRecordMap<T extends object>(values: Map<string, T>): Map<string, Record<string, unknown>> {
  return new Map(Array.from(values, ([id, value]) => [id, toLegacyRecord(value)] as const));
}
