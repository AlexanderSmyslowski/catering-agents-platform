import type { DashboardState } from "./api.js";
import { compareNewestRecordsBy } from "./app-shell-state.js";
import {
  filterDashboardRecords,
  mapSpecsById
} from "./app-dashboard-selectors.js";
import { selectProductionArtifactSpecIds } from "./production-route-state.js";

export type ProductionDashboardRecordsState = {
  filteredSpecs: DashboardState["acceptedSpecs"];
  filteredAuditEvents: DashboardState["auditEvents"];
  filteredRecipes: DashboardState["recipes"];
  orderedPlans: DashboardState["productionPlans"];
  orderedPurchaseLists: DashboardState["purchaseLists"];
  specById: Map<string, Record<string, unknown>>;
  productionArtifactSpecIds: string[];
};

export function buildProductionDashboardRecordsState(input: {
  acceptedSpecs: DashboardState["acceptedSpecs"];
  productionPlans: DashboardState["productionPlans"];
  purchaseLists: DashboardState["purchaseLists"];
  auditEvents: DashboardState["auditEvents"];
  recipes: DashboardState["recipes"];
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
