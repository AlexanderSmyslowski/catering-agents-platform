import { useEffect, useRef, useState } from "react";
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

function caseCreatedLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return "Anlagezeit unbekannt";
  return `Angelegt ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "medium" }).format(date)}`;
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
  const [showAll, setShowAll] = useState(false);
  const visibleItems = !activeCaseId && !search.trim() && !showAll ? items.slice(0, 5) : items;
  const historyRef = useRef<HTMLDetailsElement>(null);
  const firstHistoryRender = useRef(true);
  useEffect(() => {
    if (historyRef.current) historyRef.current.open = !activeCaseId || (firstHistoryRender.current && window.location.hash === "#history");
    firstHistoryRender.current = false;
    setShowAll(false);
  }, [activeCaseId]);
  useEffect(() => {
    const revealLinkedHistory = () => {
      if (window.location.hash === "#history" && historyRef.current) {
        historyRef.current.open = true;
      }
    };
    revealLinkedHistory();
    window.addEventListener("hashchange", revealLinkedHistory);
    return () => window.removeEventListener("hashchange", revealLinkedHistory);
  }, [product]);

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
      ref={historyRef}
      className={`panel secondary-workspace ${product === "offer" ? "offer-history-details" : "production-history-details"}`}
    >
      <summary>
        {activeCaseId ? "Anderen Auftrag öffnen" : "Bestehenden Auftrag öffnen"} · {items.length} {items.length === 1 ? "Auftrag" : "Aufträge"}
      </summary>
      <div className="case-history-panel__body">
        <label className="field-label" htmlFor={`${product}-case-history-search`}>
          Auftrag suchen
        </label>
        <input
          id={`${product}-case-history-search`}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Kunde, Anlass oder Datum"
          autoComplete="off"
        />
        {loading ? <p className="helper-text">Aufträge werden geladen ...</p> : null}
        {error ? <p className="form-error" role="alert">Aufträge konnten nicht geladen werden. Bitte die Seite neu laden. {error}</p> : null}
        {copyError ? <p className="form-error" role="alert">{copyError}</p> : null}
        {items.length === 0 && !loading && !error ? (
          <p className="helper-text">{search.trim() ? "Kein Auftrag passt zur Suche." : "Noch keine Aufträge. Beginne mit einer neuen Anfrage."}{search.trim() ? <button type="button" className="secondary-button" onClick={() => onSearchChange("")}>Suche löschen</button> : null}</p>
        ) : (
          <ul className="quiet-list" aria-label={`Frühere ${label}aufträge`}>
            {visibleItems.map((item) => {
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
                      <span>{caseCreatedLabel(item.createdAt)}</span>
                      <span>{{ open: "Offen", completed: "Abgeschlossen", archived: "Archiviert" }[item.status]}{active ? " · geöffnet" : ""}</span>
                    </button>
                    <button
                      className="quiet-list__copy secondary-button"
                      type="button"
                      data-action="copy-case"
                      disabled={copyingCaseId === item.caseId}
                      onClick={() => void copyCase(item.caseId)}
                    >
                      {copyingCaseId === item.caseId ? "Wird kopiert ..." : "Als Vorlage für neuen Auftrag"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {visibleItems.length < items.length ? <button type="button" className="secondary-button" onClick={() => setShowAll(true)}>Alle {items.length} Aufträge anzeigen</button> : null}
      </div>
    </details>
  );
}
