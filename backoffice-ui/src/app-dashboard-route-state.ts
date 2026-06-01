import type { DashboardState } from "./api.js";
import {
  formatLatestIntakeRequest,
  type AppRoute
} from "./app-shell-state.js";
import {
  countOfferHandoffReadiness,
  filterDashboardRecords,
  isInitialHomeDashboardLoading,
  isInitialProductionDashboardLoading,
  selectActiveOfferSpec,
  selectRecordByStringId,
  type OfferHandoffCounts
} from "./app-dashboard-selectors.js";
import {
  buildProductionDashboardRecordsState,
  type ProductionDashboardRecordsState
} from "./production-dashboard-records-state.js";
import {
  buildProductionRecipeStatusSummaryState,
  type ProductionRecipeStatusSummaryState
} from "./production-recipe-status-state.js";

export type AppDashboardRouteStateInput = {
  dashboard: DashboardState;
  route: AppRoute;
  loading: boolean;
  searchText: string;
  selectedDraftId?: string;
};

export type AppDashboardRouteState = ProductionDashboardRecordsState &
  ProductionRecipeStatusSummaryState & {
    filteredOfferDrafts: DashboardState["offerDrafts"];
    offerHandoffCounts: OfferHandoffCounts;
    latestIntakeRequestSummary: string;
    isInitialHomeLoading: boolean;
    isInitialProductionLoading: boolean;
    selectedDraft: Record<string, unknown> | undefined;
    activeOfferDraft: Record<string, unknown> | undefined;
    activeOfferSpec: Record<string, unknown> | undefined;
  };

export function buildAppDashboardRouteState(input: AppDashboardRouteStateInput): AppDashboardRouteState {
  const {
    dashboard,
    route,
    loading,
    searchText,
    selectedDraftId
  } = input;
  const filteredOfferDrafts = filterDashboardRecords(dashboard.offerDrafts, searchText);
  const productionRecords = buildProductionDashboardRecordsState({
    acceptedSpecs: dashboard.acceptedSpecs,
    productionPlans: dashboard.productionPlans,
    purchaseLists: dashboard.purchaseLists,
    auditEvents: dashboard.auditEvents,
    recipes: dashboard.recipes,
    searchText
  });
  const recipeStatus = buildProductionRecipeStatusSummaryState({ recipes: dashboard.recipes });
  const selectedDraft = selectRecordByStringId(dashboard.offerDrafts, "draftId", selectedDraftId);

  return {
    filteredOfferDrafts,
    ...productionRecords,
    ...recipeStatus,
    offerHandoffCounts: countOfferHandoffReadiness(dashboard.acceptedSpecs),
    latestIntakeRequestSummary: formatLatestIntakeRequest(dashboard.intakeRequests),
    isInitialHomeLoading: isInitialHomeDashboardLoading({ route, loading, dashboard }),
    isInitialProductionLoading: isInitialProductionDashboardLoading({ route, loading, dashboard }),
    selectedDraft,
    activeOfferDraft: selectedDraft ?? filteredOfferDrafts[0],
    activeOfferSpec: selectActiveOfferSpec(dashboard.acceptedSpecs, productionRecords.filteredSpecs)
  };
}
