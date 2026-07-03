import { purchaseListExportUrl } from "./api.js";
import { getSpecLabel } from "./production-language.js";
import {
  getPurchaseListPreviewItems,
  getPurchaseListQualityWarnings
} from "./production-purchase-list-preview.js";
import type { ProductionPurchaseListState } from "./production-purchase-list-panel.js";
import {
  formatProductionContextId,
  lookupProductionSpecById
} from "./production-route-state.js";

export type ProductionPurchaseListPanelWarningState = {
  key: string;
  label: string;
};

export type ProductionPurchaseListPanelPreviewItemState = {
  key: string;
  articleName: string;
  quantityLabel: string;
  unitLabel: string;
  sourceLabel: string;
};

export type ProductionPurchaseListPanelCurrentListState = {
  key: string;
  title: string;
  itemCountLabel: string;
  contextLabel: string;
  canExport: boolean;
  exportUnavailableLabel: string;
  exportUrl: string | undefined;
  exportContextLabel: string;
  warnings: ProductionPurchaseListPanelWarningState[];
  previewItems: ProductionPurchaseListPanelPreviewItemState[];
};

export type ProductionPurchaseListPanelArchivedListState = {
  key: string;
  title: string;
  helperLabel: string;
  itemCountLabel: string;
  canExport: boolean;
  exportUnavailableLabel: string;
  exportUrl: string | undefined;
  exportContextLabel: string;
};

export type ProductionPurchaseListPanelRenderState = {
  currentLists: ProductionPurchaseListPanelCurrentListState[];
  archivedLists: ProductionPurchaseListPanelArchivedListState[];
  showArchivedLists: boolean;
};

function buildPurchaseListTitle(
  purchaseList: Record<string, unknown>,
  specById: Map<string, Record<string, unknown>>
): string {
  const relatedSpec = lookupProductionSpecById(specById, purchaseList.eventSpecId);
  return relatedSpec ? getSpecLabel(relatedSpec) : "Einkaufsliste";
}

function buildPurchaseListIds(purchaseList: Record<string, unknown>) {
  const purchaseListId = formatProductionContextId(purchaseList.purchaseListId);
  const specId = formatProductionContextId(purchaseList.eventSpecId);

  return {
    purchaseListId,
    specId
  };
}

function getPurchaseListItemCount(purchaseList: Record<string, unknown>): number | undefined {
  const itemCount = Number((purchaseList.totals as Record<string, unknown> | undefined)?.itemCount);
  if (Number.isFinite(itemCount)) {
    return itemCount;
  }

  if (Array.isArray(purchaseList.items)) {
    return purchaseList.items.length;
  }

  return undefined;
}

function formatPurchaseListItemCountLabel(purchaseList: Record<string, unknown>): string {
  const itemCount = getPurchaseListItemCount(purchaseList);
  if (typeof itemCount !== "number") {
    return "Positionen: -";
  }
  return itemCount === 0 ? "Keine Einkaufspositionen ermittelt." : `Positionen: ${itemCount}`;
}

export function buildProductionPurchaseListPanelState(
  purchaseListState: ProductionPurchaseListState
): ProductionPurchaseListPanelRenderState {
  return {
    currentLists: purchaseListState.currentPurchaseLists.map((purchaseList) => {
      const { purchaseListId } = buildPurchaseListIds(purchaseList);
      const itemCount = getPurchaseListItemCount(purchaseList);
      const canExport = typeof itemCount === "number" && itemCount > 0;
      const previewItems = getPurchaseListPreviewItems(purchaseList);
      const qualityWarnings = getPurchaseListQualityWarnings(purchaseList);

      return {
        key: String(purchaseList.purchaseListId),
        title: buildPurchaseListTitle(purchaseList, purchaseListState.specById),
        itemCountLabel: formatPurchaseListItemCountLabel(purchaseList),
        contextLabel: "Aktueller Vorgang",
        canExport,
        exportUnavailableLabel: "Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.",
        exportUrl: canExport ? purchaseListExportUrl(purchaseListId) : undefined,
        exportContextLabel: "für aktuellen Vorgang",
        warnings: qualityWarnings.map((warning) => ({
          key: warning.code,
          label:
            `Prüfhinweis: ${warning.itemCount} mögliche Rezept-Arbeitsschritte als Einkaufspositionen erkannt. ` +
            `Für das Rehearsal als lokalen Stale-Datenbefund markieren; Beispiele: ${warning.examples.join(", ")}.`
        })),
        previewItems: previewItems.map((item, itemIndex) => ({
          key: `${String(purchaseList.purchaseListId)}-${itemIndex}`,
          articleName: item.articleName,
          quantityLabel: `Menge: ${item.quantity}`,
          unitLabel: `Einheit: ${item.unit}`,
          sourceLabel: `Rezeptquelle: ${item.sourceLabel}`
        }))
      };
    }),
    archivedLists: purchaseListState.archivedPurchaseLists.map((purchaseList) => {
      const { purchaseListId } = buildPurchaseListIds(purchaseList);
      const itemCount = getPurchaseListItemCount(purchaseList);
      const canExport = typeof itemCount === "number" && itemCount > 0;

      return {
        key: String(purchaseList.purchaseListId),
        title: buildPurchaseListTitle(purchaseList, purchaseListState.specById),
        helperLabel: "Ältere Einkaufsliste aus anderem Vorgang - nicht aktueller Vorgang.",
        itemCountLabel: formatPurchaseListItemCountLabel(purchaseList),
        canExport,
        exportUnavailableLabel: "Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.",
        exportUrl: canExport ? purchaseListExportUrl(purchaseListId) : undefined,
        exportContextLabel: "aus älterem Vorgang"
      };
    }),
    showArchivedLists: purchaseListState.archivedPurchaseLists.length > 0
  };
}
