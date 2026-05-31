import type { ProductionPurchaseListState } from "./production-purchase-list-panel.js";

export type ProductionPurchaseListStateInput = {
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  archivedPurchaseLists: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  purchaseZoneStatusLabel: string;
};

export function buildProductionPurchaseListState({
  currentSpecPurchaseLists,
  archivedPurchaseLists,
  specById,
  purchaseZoneStatusLabel
}: ProductionPurchaseListStateInput): ProductionPurchaseListState {
  return {
    currentPurchaseLists: currentSpecPurchaseLists,
    archivedPurchaseLists,
    specById,
    statusLabel: purchaseZoneStatusLabel
  };
}
