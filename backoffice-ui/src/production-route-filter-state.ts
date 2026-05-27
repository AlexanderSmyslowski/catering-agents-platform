import {
  formatCounts,
  translateHealthStatus
} from "./app-shell-state.js";
import type { ProductionRouteFilterPanelProps } from "./production-route-filter-panel.js";

export type ProductionRouteFilterStateInput = {
  productionPlanCount: number;
  purchaseListCount: number;
  recipeCount: number;
  approvedRecipeCount: number;
  reviewRequiredRecipeCount: number;
  productionServiceStatus?: string;
  productionServiceCounts: Record<string, number>;
  search: string;
  setSearch: (value: string) => void;
};

export function buildProductionRouteFilterState({
  productionPlanCount,
  purchaseListCount,
  recipeCount,
  approvedRecipeCount,
  reviewRequiredRecipeCount,
  productionServiceStatus,
  productionServiceCounts,
  search,
  setSearch
}: ProductionRouteFilterStateInput): ProductionRouteFilterPanelProps {
  return {
    productionPlanCount,
    purchaseListCount,
    recipeCount,
    approvedRecipeCount,
    reviewRequiredRecipeCount,
    productionServiceStatusLabel: translateHealthStatus(productionServiceStatus),
    productionServiceCountsLabel: formatCounts(productionServiceCounts),
    search,
    setSearch
  };
}
