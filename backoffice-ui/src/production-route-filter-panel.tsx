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
  search,
  setSearch
}: ProductionRouteFilterPanelProps) {
  return (
    <details className="panel secondary-workspace production-filter-details">
      <summary>
        <span className="eyebrow">Suche und Bestand</span>
        <span className="subsection-title">Produktionsobjekte leise filtern</span>
        <span className="helper-text">
          {isInitialProductionLoading
            ? "Produktionsbestand wird geladen · Produktionsdienst wird geprüft"
            : `${productionPlanCount} Pläne · ${purchaseListCount} Einkaufslisten · ${recipeCount} Rezepte · Produktionsdienst ${productionServiceStatusLabel}`}
        </span>
      </summary>
      <div className="secondary-workspace__content">
        <section className="toolbar toolbar--production">
          <input
            className="search"
            placeholder="Produktion ruhig filtern"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="helper-text toolbar-note">
            Bestehende Spezifikationen, Pläne und Rezepte durchsuchen.
          </p>
        </section>
        <section className="metrics-grid metrics-grid--compact-route">
          <StatusCard
            title="Produktionspläne"
            body={
              isInitialProductionLoading
                ? "Produktionspläne werden geladen; noch keine Planbewertung."
                : `${productionPlanCount} Küchenpläne mit Zeit- und Rezeptbezug sind vorhanden.`
            }
          />
          <StatusCard
            title="Einkaufslisten"
            body={
              isInitialProductionLoading
                ? "Einkaufslisten werden geladen; noch keine Beschaffungsbewertung."
                : `${purchaseListCount} Listen sind für Großmarkt und Beschaffung verfügbar.`
            }
          />
          <StatusCard
            title="Rezeptbibliothek"
            body={
              isInitialProductionLoading
                ? "Rezeptbestand wird geladen; noch keine Review-Bewertung."
                : `${recipeCount} Rezepte · ${approvedRecipeCount} intern freigegeben · ${reviewRequiredRecipeCount} Prüfung nötig`
            }
          />
          <StatusCard
            title="Produktionsdienst"
            body={
              isInitialProductionLoading
                ? "Healthcheck läuft · Produktionszähler werden geladen"
                : `${productionServiceStatusLabel} · ${productionServiceCountsLabel}`
            }
          />
        </section>
      </div>
    </details>
  );
}
