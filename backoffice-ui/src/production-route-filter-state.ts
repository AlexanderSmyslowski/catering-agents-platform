import {
  formatCounts,
  translateHealthStatus
} from "./app-shell-state.js";
import { getSpecLabel } from "./production-language.js";
import type { ProductionRouteFilterPanelProps } from "./production-route-filter-panel.js";
import { translateReadiness } from "./production-route-status.js";

export type ProductionHistoryItem = {
  specId: string;
  label: string;
  readinessLabel: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function buildProductionHistoryItems(
  specs: Array<Record<string, unknown>>
): ProductionHistoryItem[] {
  return [...specs].reverse().map((spec) => {
    const customerName = String(asRecord(spec.customer)?.name ?? "").trim();
    const readiness = String(asRecord(spec.readiness)?.status ?? "-");
    return {
      specId: String(spec.specId ?? ""),
      label: customerName ? `${customerName} · ${getSpecLabel(spec)}` : getSpecLabel(spec),
      readinessLabel: translateReadiness(readiness)
    };
  });
}

export type ProductionRouteFilterStateInput = {
  isInitialProductionLoading?: boolean;
  productionPlanCount: number;
  purchaseListCount: number;
  recipeCount: number;
  approvedRecipeCount: number;
  reviewRequiredRecipeCount: number;
  productionServiceStatus?: string;
  productionServiceCounts: Record<string, number>;
  filteredSpecs?: Array<Record<string, unknown>>;
  openSpecForQuestions: (specId: string) => void;
  search: string;
  setSearch: (value: string) => void;
};

export function buildProductionRouteFilterState({
  isInitialProductionLoading,
  productionPlanCount,
  purchaseListCount,
  recipeCount,
  approvedRecipeCount,
  reviewRequiredRecipeCount,
  productionServiceStatus,
  productionServiceCounts,
  filteredSpecs,
  openSpecForQuestions,
  search,
  setSearch
}: ProductionRouteFilterStateInput): ProductionRouteFilterPanelProps {
  return {
    isInitialProductionLoading: Boolean(isInitialProductionLoading),
    productionPlanCount,
    purchaseListCount,
    recipeCount,
    approvedRecipeCount,
    reviewRequiredRecipeCount,
    productionServiceStatusLabel: translateHealthStatus(productionServiceStatus),
    productionServiceCountsLabel: formatCounts(productionServiceCounts),
    historyItems: buildProductionHistoryItems(filteredSpecs ?? []),
    openHistoryItem: openSpecForQuestions,
    search,
    setSearch
  };
}
