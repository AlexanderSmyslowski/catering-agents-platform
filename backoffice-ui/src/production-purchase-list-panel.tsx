import { buildProductionPurchaseListPanelState } from "./production-purchase-list-panel-state.js";

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
  const state = buildProductionPurchaseListPanelState(purchaseListState);

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
        {state.currentLists.map((purchaseList) => (
          <li key={purchaseList.key}>
            <strong>{purchaseList.title}</strong>
            <p>{purchaseList.itemCountLabel}</p>
            <p className="helper-text">{purchaseList.contextLabel}</p>
            <a
              className="ghost-link"
              href={purchaseList.exportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Einkaufsliste exportieren
              <span className="visually-hidden"> {purchaseList.exportContextLabel}</span>
            </a>
            {purchaseList.warnings.map((warning) => (
              <p className="helper-text" key={warning.key}>
                {warning.label}
              </p>
            ))}
            {purchaseList.previewItems.length > 0 ? (
              <>
                <p className="helper-text">Kurzübersicht der ersten Positionen:</p>
                <ul className="item-list compact">
                  {purchaseList.previewItems.map((item) => (
                    <li key={item.key}>
                      <strong>{item.articleName}</strong>
                      <p>{item.quantityLabel}</p>
                      <p>{item.unitLabel}</p>
                      <p>{item.sourceLabel}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </li>
        ))}
        {currentPurchaseLists.length === 0 ? (
          <li>
            Noch keine Einkaufsliste für den aktuellen Vorgang. Sie entsteht mit dem Produktionsplan. Exportlinks
            erscheinen erst, wenn Produktionsplan und Einkaufsliste vorhanden sind.
          </li>
        ) : null}
      </ul>
      {state.showArchivedLists ? (
        <details className="secondary-workspace">
          <summary>
            <span className="eyebrow">Ältere Einkaufslisten</span>
            {" "}
            <span className="subsection-title">{archivedPurchaseLists.length} frühere Listen</span>
            {" "}
            <span className="helper-text">Nur bei Bedarf aufklappen; ältere Listen sind kein aktueller Vorgang.</span>
          </summary>
          <div className="secondary-workspace__content">
            <ul className="item-list compact">
              {state.archivedLists.map((purchaseList) => (
                <li key={purchaseList.key}>
                  <strong>{purchaseList.title}</strong>
                  <p className="helper-text">{purchaseList.helperLabel}</p>
                  <p>{purchaseList.itemCountLabel}</p>
                  <a
                    className="ghost-link"
                    href={purchaseList.exportUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Einkaufsliste exportieren
                    <span className="visually-hidden"> {purchaseList.exportContextLabel}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </article>
  );
}
