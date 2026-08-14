import { formatLatestIntakeRequest, type AppRoute } from "./app-shell-state.js";
import {
  countOfferHandoffReadiness,
  filterDashboardRecords,
  isInitialHomeDashboardLoading,
  isInitialProductionDashboardLoading,
  selectOfferSpecForDraft,
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

export type LegacyRouteDashboard = {
  intakeRequests: Array<Record<string, unknown>>;
  acceptedSpecs: Array<Record<string, unknown>>;
  offerDrafts: Array<Record<string, unknown>>;
  productionPlans: Array<Record<string, unknown>>;
  purchaseLists: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
};

export type LegacyAppDashboardRouteStateInput = {
  dashboard: LegacyRouteDashboard;
  route: AppRoute;
  loading: boolean;
  searchText: string;
  selectedDraftId?: string;
};

export type LegacyAppDashboardRouteState = ProductionDashboardRecordsState &
  ProductionRecipeStatusSummaryState & {
    filteredOfferDrafts: Array<Record<string, unknown>>;
    offerHandoffCounts: OfferHandoffCounts;
    latestIntakeRequestSummary: string;
    isInitialHomeLoading: boolean;
    isInitialProductionLoading: boolean;
    selectedDraft: Record<string, unknown> | undefined;
    activeOfferDraft: Record<string, unknown> | undefined;
    activeOfferSpec: Record<string, unknown> | undefined;
  };

export function buildLegacyAppDashboardRouteState(
  input: LegacyAppDashboardRouteStateInput
): LegacyAppDashboardRouteState {
  const filteredOfferDrafts = filterDashboardRecords(input.dashboard.offerDrafts, input.searchText);
  const productionRecords = buildProductionDashboardRecordsState({
    acceptedSpecs: input.dashboard.acceptedSpecs,
    productionPlans: input.dashboard.productionPlans,
    purchaseLists: input.dashboard.purchaseLists,
    auditEvents: input.dashboard.auditEvents,
    recipes: input.dashboard.recipes,
    searchText: input.searchText
  });
  const recipeStatus = buildProductionRecipeStatusSummaryState({ recipes: input.dashboard.recipes });
  const selectedDraft = selectRecordByStringId(input.dashboard.offerDrafts, "draftId", input.selectedDraftId);

  return {
    filteredOfferDrafts,
    ...productionRecords,
    ...recipeStatus,
    offerHandoffCounts: countOfferHandoffReadiness(input.dashboard.acceptedSpecs),
    latestIntakeRequestSummary: formatLatestIntakeRequest(input.dashboard.intakeRequests),
    isInitialHomeLoading: isInitialHomeDashboardLoading({
      route: input.route,
      loading: input.loading,
      dashboard: input.dashboard
    }),
    isInitialProductionLoading: isInitialProductionDashboardLoading({
      route: input.route,
      loading: input.loading,
      dashboard: input.dashboard
    }),
    selectedDraft,
    activeOfferDraft: selectedDraft,
    activeOfferSpec: selectOfferSpecForDraft(
      input.dashboard.acceptedSpecs,
      selectedDraft ? String(selectedDraft.draftId ?? "") : undefined
    )
  };
}
