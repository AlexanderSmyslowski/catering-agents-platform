import { StatusCard } from "../components/status-card.js";

export type ProductionRouteFilterPanelProps = {
  isInitialProductionLoading: boolean;
  productionPlanCount: number;
  purchaseListCount: number;
  recipeCount: number;
  approvedRecipeCount: number;
  reviewRequiredRecipeCount: number;
  productionServiceStatusLabel: string;
  productionServiceCountsLabel: string;
  historyItems: Array<{
    specId: string;
    label: string;
    readinessLabel: string;
  }>;
  openHistoryItem: (specId: string) => void;
  search: string;
  setSearch: (value: string) => void;
};

export function ProductionRouteFilterPanel({
  isInitialProductionLoading,
  productionPlanCount,
  purchaseListCount,
  recipeCount,
  approvedRecipeCount,
  reviewRequiredRecipeCount,
  productionServiceStatusLabel,
  productionServiceCountsLabel,
  historyItems,
  openHistoryItem,
  search,
  setSearch
}: ProductionRouteFilterPanelProps) {
  return (
    <details className="panel secondary-workspace production-filter-details">
      <summary>
        <span className="eyebrow">Aufträge</span>
        <span className="subsection-title">Frühere Produktionsaufträge öffnen</span>
        <span className="helper-text">
          {isInitialProductionLoading
            ? "Aufträge werden geladen"
            : historyItems.length === 1
              ? "1 Auftrag"
              : `${historyItems.length} Aufträge`}
        </span>
      </summary>
      <div className="secondary-workspace__content">
        <section className="toolbar toolbar--production">
          <input
            className="search"
            aria-label="Frühere Produktionsaufträge durchsuchen"
            placeholder="Kunde, Anlass, Datum oder Speise suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="helper-text toolbar-note">
            Öffne einen Auftrag bewusst, um ihn weiterzubearbeiten oder Daten zu übernehmen.
          </p>
        </section>
        <ul className="quiet-list">
          {historyItems.map((item) => (
            <li key={item.specId}>
              <button
                type="button"
                className="quiet-list__button"
                onClick={() => openHistoryItem(item.specId)}
              >
                <strong>{item.label}</strong>
                <span>Status: {item.readinessLabel}</span>
              </button>
            </li>
          ))}
          {!isInitialProductionLoading && historyItems.length === 0 ? (
            <li>Keine passenden Aufträge gefunden.</li>
          ) : null}
        </ul>
        <details className="nested-details">
          <summary>Bibliothek und Systemstatus</summary>
          <section className="metrics-grid metrics-grid--compact-route">
            <StatusCard
              title="Produktionspläne"
              body={`${productionPlanCount} Küchenpläne sind vorhanden.`}
            />
            <StatusCard
              title="Einkaufslisten"
              body={`${purchaseListCount} Einkaufslisten sind vorhanden.`}
            />
            <StatusCard
              title="Rezeptbibliothek"
              body={`${recipeCount} Rezepte · ${approvedRecipeCount} intern freigegeben · ${reviewRequiredRecipeCount} Prüfung nötig`}
            />
            <StatusCard
              title="Dienststatus"
              body={`${productionServiceStatusLabel} · ${productionServiceCountsLabel}`}
            />
          </section>
        </details>
      </div>
    </details>
  );
}
