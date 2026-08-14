import type { ProductRouteDashboard } from "./api.js";
import type { AcceptedEventSpec, OfferDraft } from "@catering/shared-core";
import {
  formatLatestIntakeRequest,
  type AppRoute
} from "./app-shell-state.js";
import {
  countProductOfferHandoffReadiness,
  filterProductRouteRecords,
  isInitialProductHomeDashboardLoading,
  isInitialProductProductionDashboardLoading,
  selectProductOfferDraft,
  selectProductOfferSpecForDraft,
  type OfferHandoffCounts
} from "./app-dashboard-selectors.js";
import {
  buildProductProductionDashboardRecordsState,
  type ProductProductionDashboardRecordsState
} from "./production-dashboard-records-state.js";
import {
  buildProductRecipeStatusSummaryState,
  type ProductionRecipeStatusSummaryState
} from "./production-recipe-status-state.js";

export type AppDashboardRouteStateInput = {
  dashboard: ProductRouteDashboard;
  route: AppRoute;
  loading: boolean;
  searchText: string;
  selectedDraftId?: string;
};

export function buildAppDashboardRouteState(input: AppDashboardRouteStateInput): AppDashboardRouteState {
  return buildTypedAppDashboardRouteState(input);
}

export type AppDashboardRouteState = ProductProductionDashboardRecordsState &
  ProductionRecipeStatusSummaryState & {
    filteredOfferDrafts: OfferDraft[];
    offerHandoffCounts: OfferHandoffCounts;
    latestIntakeRequestSummary: string;
    isInitialHomeLoading: boolean;
    isInitialProductionLoading: boolean;
    selectedDraft: OfferDraft | undefined;
    activeOfferDraft: OfferDraft | undefined;
    activeOfferSpec: AcceptedEventSpec | undefined;
  };

function buildTypedAppDashboardRouteState(input: AppDashboardRouteStateInput): AppDashboardRouteState {
  const {
    dashboard,
    route,
    loading,
    searchText,
    selectedDraftId
  } = input;
  const filteredOfferDrafts = filterProductRouteRecords(dashboard.offerDrafts, searchText);
  const productionRecords = buildProductProductionDashboardRecordsState({
    acceptedSpecs: dashboard.acceptedSpecs,
    productionPlans: dashboard.productionPlans,
    purchaseLists: dashboard.purchaseLists,
    auditEvents: dashboard.auditEvents,
    recipes: dashboard.recipes,
    searchText
  });
  const recipeStatus = buildProductRecipeStatusSummaryState({ recipes: dashboard.recipes });
  const selectedDraft = selectProductOfferDraft(dashboard.offerDrafts, selectedDraftId);

  return {
    filteredOfferDrafts,
    ...productionRecords,
    ...recipeStatus,
    offerHandoffCounts: countProductOfferHandoffReadiness(dashboard.acceptedSpecs),
    latestIntakeRequestSummary: formatLatestIntakeRequest(dashboard.intakeRequests),
    isInitialHomeLoading: isInitialProductHomeDashboardLoading({ route, loading, dashboard }),
    isInitialProductionLoading: isInitialProductProductionDashboardLoading({ route, loading, dashboard }),
    selectedDraft,
    activeOfferDraft: selectedDraft,
    activeOfferSpec: selectProductOfferSpecForDraft(
      dashboard.acceptedSpecs,
      selectedDraft?.draftId
    )
  };
}
