import { useState } from "react";
import type { CaseProduct } from "@catering/shared-core";
import type { CaseHistoryItem } from "./case-history-state.js";

export interface CaseHistoryPanelProps {
  product: CaseProduct;
  items: CaseHistoryItem[];
  activeCaseId?: string;
  search: string;
  onSearchChange(value: string): void;
  onOpen(caseId: string): void;
  onCopy(caseId: string): Promise<void>;
  loading?: boolean;
  error?: string;
}

function productLabel(product: CaseProduct): string {
  return product === "offer" ? "Angebots" : "Produktions";
}

export function CaseHistoryPanel({
  product,
  items,
  activeCaseId,
  search,
  onSearchChange,
  onOpen,
  onCopy,
  loading = false,
  error
}: CaseHistoryPanelProps) {
  const [copyingCaseId, setCopyingCaseId] = useState<string>();
  const [copyError, setCopyError] = useState<string>();
  const label = productLabel(product);

  async function copyCase(caseId: string) {
    setCopyingCaseId(caseId);
    setCopyError(undefined);
    try {
      await onCopy(caseId);
    } catch (cause) {
      setCopyError(cause instanceof Error ? cause.message : "Kopie konnte nicht angelegt werden.");
    } finally {
      setCopyingCaseId(undefined);
    }
  }

  return (
    <details
      id="history"
      className={`panel secondary-workspace ${product === "offer" ? "offer-history-details" : "production-history-details"}`}
    >
      <summary>
        Frühere {label}aufträge öffnen · {items.length} {items.length === 1 ? "Auftrag" : "Aufträge"}
      </summary>
      <div className="case-history-panel__body">
        <label className="field-label" htmlFor={`${product}-case-history-search`}>
          Suche nach Auftrag oder Quelldatei
        </label>
        <input
          id={`${product}-case-history-search`}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={product === "production" ? "Kunde, Anlass, Datum oder Speise suchen" : "Name oder Dateiname"}
          autoComplete="off"
        />
        {loading ? <p className="helper-text">Aufträge werden geladen ...</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {copyError ? <p className="form-error" role="alert">{copyError}</p> : null}
        {items.length === 0 && !loading ? (
          <p className="helper-text">Keine passenden Aufträge gefunden.</p>
        ) : (
          <ul className="quiet-list" aria-label={`Frühere ${label}aufträge`}>
            {items.map((item) => {
              const active = item.caseId === activeCaseId;
              return (
                <li key={item.caseId}>
                  <div className="quiet-list__item">
                    <button
                      className="quiet-list__button"
                      type="button"
                      data-action="open-case"
                      aria-pressed={active}
                      onClick={() => onOpen(item.caseId)}
                    >
                      <strong>{item.displayName}</strong>
                      <span>{item.status}{active ? " · geöffnet" : ""}</span>
                    </button>
                    <button
                      className="quiet-list__copy"
                      type="button"
                      data-action="copy-case"
                      disabled={copyingCaseId === item.caseId}
                      onClick={() => void copyCase(item.caseId)}
                    >
                      {copyingCaseId === item.caseId ? "Wird kopiert ..." : "Als neuen Auftrag verwenden"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
