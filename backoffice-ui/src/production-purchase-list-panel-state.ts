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
  exportUrl: string;
  exportContextLabel: string;
  warnings: ProductionPurchaseListPanelWarningState[];
  previewItems: ProductionPurchaseListPanelPreviewItemState[];
};

export type ProductionPurchaseListPanelArchivedListState = {
  key: string;
  title: string;
  helperLabel: string;
  itemCountLabel: string;
  exportUrl: string;
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

export function buildProductionPurchaseListPanelState(
  purchaseListState: ProductionPurchaseListState
): ProductionPurchaseListPanelRenderState {
  return {
    currentLists: purchaseListState.currentPurchaseLists.map((purchaseList) => {
      const { purchaseListId, specId } = buildPurchaseListIds(purchaseList);
      const previewItems = getPurchaseListPreviewItems(purchaseList);
      const qualityWarnings = getPurchaseListQualityWarnings(purchaseList);

      return {
        key: String(purchaseList.purchaseListId),
        title: buildPurchaseListTitle(purchaseList, purchaseListState.specById),
        itemCountLabel: `Positionen: ${String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}`,
        contextLabel: `purchaseListId: ${purchaseListId} · specId: ${specId}`,
        exportUrl: purchaseListExportUrl(purchaseListId),
        exportContextLabel: `für aktuellen Vorgang ${purchaseListId} · Spezifikation ${specId}`,
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
      const { purchaseListId, specId } = buildPurchaseListIds(purchaseList);

      return {
        key: String(purchaseList.purchaseListId),
        title: buildPurchaseListTitle(purchaseList, purchaseListState.specById),
        helperLabel: "Ältere Einkaufsliste aus anderem Vorgang - nicht aktueller Vorgang.",
        itemCountLabel: `Positionen: ${String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}`,
        exportUrl: purchaseListExportUrl(purchaseListId),
        exportContextLabel: `aus älterem Vorgang ${purchaseListId} · Spezifikation ${specId}`
      };
    }),
    showArchivedLists: purchaseListState.archivedPurchaseLists.length > 0
  };
}
