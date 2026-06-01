import { purchaseListExportUrl } from "./api.js";
import { getSpecLabel } from "./production-language.js";
import {
  getPurchaseListPreviewItems,
  getPurchaseListQualityWarnings
} from "./production-purchase-list-preview.js";
import { lookupProductionSpecById } from "./production-route-state.js";

export type ProductionPurchaseListState = {
  currentPurchaseLists: Array<Record<string, unknown>>;
  archivedPurchaseLists: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  statusLabel: string;
};

type ProductionPurchaseListPanelProps = {
  purchaseListState: ProductionPurchaseListState;
};

export function ProductionPurchaseListPanel({
  purchaseListState
}: ProductionPurchaseListPanelProps) {
  const { currentPurchaseLists, archivedPurchaseLists, specById, statusLabel } = purchaseListState;

  return (
    <article className="panel secondary-panel">
      <header>
        <p className="eyebrow">Downloadbereich</p>
        <h3>{statusLabel}</h3>
      </header>
      <p className="helper-text">
        Die sichtbare Liste gehört zum aktuellen Vorgang; ältere Einkaufslisten bleiben getrennt darunter.
      </p>
      <ul className="item-list compact">
        {currentPurchaseLists.map((purchaseList) => {
          const relatedSpec = lookupProductionSpecById(specById, purchaseList.eventSpecId);
          const purchaseListPreviewItems = getPurchaseListPreviewItems(purchaseList);
          const qualityWarnings = getPurchaseListQualityWarnings(purchaseList);
          return (
            <li key={String(purchaseList.purchaseListId)}>
              <strong>{relatedSpec ? getSpecLabel(relatedSpec) : "Einkaufsliste"}</strong>
              <p>Positionen: {String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}</p>
              <p className="helper-text">
                purchaseListId: {String(purchaseList.purchaseListId)} · specId: {String(purchaseList.eventSpecId ?? "-")}
              </p>
              <a
                className="ghost-link"
                href={purchaseListExportUrl(String(purchaseList.purchaseListId))}
                target="_blank"
                rel="noreferrer"
              >
                Einkaufsliste exportieren
                <span className="visually-hidden">
                  {" "}
                  für aktuellen Vorgang {String(purchaseList.purchaseListId)} · Spezifikation{" "}
                  {String(purchaseList.eventSpecId ?? "-")}
                </span>
              </a>
              {qualityWarnings.map((warning) => (
                <p className="helper-text" key={warning.code}>
                  Prüfhinweis: {warning.itemCount} mögliche Rezept-Arbeitsschritte als Einkaufspositionen erkannt.
                  Für das Rehearsal als lokalen Stale-Datenbefund markieren; Beispiele: {warning.examples.join(", ")}.
                </p>
              ))}
              {purchaseListPreviewItems.length > 0 ? (
                <>
                  <p className="helper-text">Kurzübersicht der ersten Positionen:</p>
                  <ul className="item-list compact">
                    {purchaseListPreviewItems.map((item, itemIndex) => (
                      <li key={`${String(purchaseList.purchaseListId)}-${itemIndex}`}>
                        <strong>{item.articleName}</strong>
                        <p>Menge: {item.quantity}</p>
                        <p>Einheit: {item.unit}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </li>
          );
        })}
        {currentPurchaseLists.length === 0 ? (
          <li>
            Noch keine Einkaufsliste für den aktuellen Vorgang. Sie entsteht mit dem Produktionsplan. Exportlinks
            erscheinen erst, wenn Produktionsplan und Einkaufsliste vorhanden sind.
          </li>
        ) : null}
      </ul>
      {archivedPurchaseLists.length > 0 ? (
        <details className="secondary-workspace">
          <summary>
            <span className="eyebrow">Ältere Einkaufslisten</span>
            <span className="subsection-title">{archivedPurchaseLists.length} frühere Listen</span>
            <span className="helper-text">Nur bei Bedarf aufklappen; ältere Listen sind kein aktueller Vorgang.</span>
          </summary>
          <div className="secondary-workspace__content">
            <ul className="item-list compact">
              {archivedPurchaseLists.map((purchaseList) => {
                const relatedSpec = lookupProductionSpecById(specById, purchaseList.eventSpecId);
                return (
                  <li key={String(purchaseList.purchaseListId)}>
                    <strong>{relatedSpec ? getSpecLabel(relatedSpec) : "Einkaufsliste"}</strong>
                    <p className="helper-text">
                      Ältere Einkaufsliste aus anderem Vorgang - nicht aktueller Vorgang.
                    </p>
                    <p>Positionen: {String((purchaseList.totals as Record<string, unknown>)?.itemCount ?? "-")}</p>
                    <a
                      className="ghost-link"
                      href={purchaseListExportUrl(String(purchaseList.purchaseListId))}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Einkaufsliste exportieren
                      <span className="visually-hidden">
                        {" "}
                        aus älterem Vorgang {String(purchaseList.purchaseListId)} · Spezifikation{" "}
                        {String(purchaseList.eventSpecId ?? "-")}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
      ) : null}
    </article>
  );
}
