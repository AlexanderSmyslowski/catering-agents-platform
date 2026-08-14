import type { ProductRouteDashboard } from "./api.js";
import type {
  AcceptedEventSpec,
  AuditEntry,
  ProductionPlan,
  PurchaseList,
  Recipe
} from "@catering/shared-core";
import { compareNewestRecordsBy } from "./app-shell-state.js";
import {
  filterDashboardRecords,
  filterProductRouteRecords,
  mapProductSpecsById,
  mapSpecsById
} from "./app-dashboard-selectors.js";
import { selectProductionArtifactSpecIds } from "./production-route-state.js";

export type ProductionDashboardRecordsState = {
  filteredSpecs: Array<Record<string, unknown>>;
  filteredAuditEvents: Array<Record<string, unknown>>;
  filteredRecipes: Array<Record<string, unknown>>;
  orderedPlans: Array<Record<string, unknown>>;
  orderedPurchaseLists: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  productionArtifactSpecIds: string[];
};

export function buildProductionDashboardRecordsState(input: {
  acceptedSpecs: Array<Record<string, unknown>>;
  productionPlans: Array<Record<string, unknown>>;
  purchaseLists: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  searchText: string;
}): ProductionDashboardRecordsState {
  const filteredSpecs = filterDashboardRecords(input.acceptedSpecs, input.searchText);
  const filteredPlans = filterDashboardRecords(input.productionPlans, input.searchText);
  const filteredPurchaseLists = filterDashboardRecords(input.purchaseLists, input.searchText);
  const orderedPlans = [...filteredPlans].sort(compareNewestRecordsBy("planId"));
  const orderedPurchaseLists = [...filteredPurchaseLists].sort(compareNewestRecordsBy("purchaseListId"));

  return {
    filteredSpecs,
    filteredAuditEvents: filterDashboardRecords(input.auditEvents, input.searchText),
    filteredRecipes: filterDashboardRecords(input.recipes, input.searchText),
    orderedPlans,
    orderedPurchaseLists,
    specById: mapSpecsById(input.acceptedSpecs),
    productionArtifactSpecIds: selectProductionArtifactSpecIds([...orderedPlans, ...orderedPurchaseLists])
  };
}

export type ProductProductionDashboardRecordsState = {
  filteredSpecs: AcceptedEventSpec[];
  filteredAuditEvents: AuditEntry[];
  filteredRecipes: Recipe[];
  orderedPlans: ProductionPlan[];
  orderedPurchaseLists: PurchaseList[];
  specById: Map<string, AcceptedEventSpec>;
  productionArtifactSpecIds: string[];
};

export function buildProductProductionDashboardRecordsState(input: {
  acceptedSpecs: ProductRouteDashboard["acceptedSpecs"];
  productionPlans: ProductRouteDashboard["productionPlans"];
  purchaseLists: ProductRouteDashboard["purchaseLists"];
  auditEvents: ProductRouteDashboard["auditEvents"];
  recipes: ProductRouteDashboard["recipes"];
  searchText: string;
}): ProductProductionDashboardRecordsState {
  const filteredSpecs = filterProductRouteRecords(input.acceptedSpecs, input.searchText);
  const filteredPlans = filterProductRouteRecords(input.productionPlans, input.searchText);
  const filteredPurchaseLists = filterProductRouteRecords(input.purchaseLists, input.searchText);
  const orderedPlans = [...filteredPlans].sort((left, right) => compareNewestStringId(right.planId, left.planId));
  const orderedPurchaseLists = [...filteredPurchaseLists].sort((left, right) =>
    compareNewestStringId(right.purchaseListId, left.purchaseListId)
  );

  return {
    filteredSpecs,
    filteredAuditEvents: filterProductRouteRecords(input.auditEvents, input.searchText),
    filteredRecipes: filterProductRouteRecords(input.recipes, input.searchText),
    orderedPlans,
    orderedPurchaseLists,
    specById: mapProductSpecsById(input.acceptedSpecs),
    productionArtifactSpecIds: selectProductionArtifactSpecIds(
      [...orderedPlans, ...orderedPurchaseLists].map((item) => ({ eventSpecId: item.eventSpecId }))
    )
  };
}

function compareNewestStringId(left: string, right: string): number {
  return trailingNumericRank(left) - trailingNumericRank(right);
}

function trailingNumericRank(value: string): number {
  const match = value.match(/(\d{6,})$/);
  return match ? Number(match[1]) : 0;
}
