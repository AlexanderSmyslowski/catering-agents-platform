import { purchaseListExportUrl } from "./api.js";
import { getSpecLabel } from "./production-language.js";

type ProductionPurchaseListPanelProps = {
  currentPurchaseLists: Array<Record<string, unknown>>;
  archivedPurchaseLists: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  statusLabel: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function getPurchaseListPreviewItems(
  purchaseList: Record<string, unknown>
): Array<{ articleName: string; quantity: string; unit: string }> {
  const rawItems = Array.isArray(purchaseList.items)
    ? purchaseList.items
    : Array.isArray(purchaseList.positions)
      ? purchaseList.positions
      : Array.isArray(purchaseList.entries)
        ? purchaseList.entries
        : [];

  return rawItems.slice(0, 5).flatMap((item) => {
    const itemRecord = asRecord(item);
    if (!itemRecord) {
      return [];
    }

    const quantityRecord = asRecord(itemRecord.quantity);
    const articleName =
      readStringOrNumber(itemRecord, ["displayName", "articleName", "name", "label", "ingredientName"]) ??
      "Artikel";
    const quantity =
      readStringOrNumber(itemRecord, ["purchaseQty", "normalizedQty", "qty", "amount"]) ??
      readStringOrNumber(quantityRecord, ["amount"]) ??
      "-";
    const unit =
      readStringOrNumber(itemRecord, ["purchaseUnit", "normalizedUnit", "unit"]) ??
      readStringOrNumber(quantityRecord, ["unit"]) ??
      "-";

    return [{ articleName, quantity, unit }];
  });
}

export function ProductionPurchaseListPanel({
  currentPurchaseLists,
  archivedPurchaseLists,
  specById,
  statusLabel
}: ProductionPurchaseListPanelProps) {
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
          const relatedSpec = specById.get(String(purchaseList.eventSpecId ?? ""));
          const purchaseListPreviewItems = getPurchaseListPreviewItems(purchaseList);
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
                <span className="visually-hidden"> Einkaufsliste herunterladen</span>
              </a>
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
                const relatedSpec = specById.get(String(purchaseList.eventSpecId ?? ""));
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
                      <span className="visually-hidden"> Einkaufsliste herunterladen</span>
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
