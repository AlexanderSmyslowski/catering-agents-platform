type ProductionComponentClassificationFieldsProps = {
  menuCategory: string;
  isSplitComponent?: boolean;
  productionMode: string;
  productionStation?: string;
  onProductionStationChange?: (productionStation: string) => void;
  onMenuCategoryChange: (menuCategory: string) => void;
  onProductionModeChange: (productionMode: string) => void;
};

export function ProductionComponentClassificationFields({
  menuCategory,
  isSplitComponent = false,
  productionMode,
  productionStation,
  onProductionStationChange,
  onMenuCategoryChange,
  onProductionModeChange
}: ProductionComponentClassificationFieldsProps) {
  return (
    <div className="answer-grid">
      <label className="field-block">
        <span>{isSplitComponent ? "Kategorie" : "Kategorie im Angebot"}</span>
        <select
          aria-label={isSplitComponent ? "Kategorie" : "Kategorie im Angebot"}
          value={menuCategory}
          onChange={(event) => onMenuCategoryChange(event.target.value)}
        >
          <option value="">Bitte wählen</option>
          <option value="classic">klassisch</option>
          <option value="vegetarian">vegetarisch</option>
          <option value="vegan">vegan</option>
        </select>
      </label>
      <label className="field-block">
        <span>Herstellungsart</span>
        <select
          aria-label="Herstellungsart"
          value={productionMode}
          onChange={(event) => onProductionModeChange(event.target.value)}
        >
          <option value="">Bitte wählen</option>
          <option value="scratch">Eigenproduktion</option>
          <option value="hybrid">Hybrid</option>
          <option value="convenience_purchase">Convenience-Zukauf</option>
          <option value="external_finished">Fertigprodukt / extern</option>
        </select>
      </label>
      {onProductionStationChange && <label className="field-block">
        <span>Arbeitsbereich</span>
        <select aria-label="Arbeitsbereich" value={productionStation ?? ""} onChange={event => onProductionStationChange(event.target.value)}>
          <option value="">Offen – noch nicht zugeordnet</option>
          <option value="hot-kitchen">Warme Küche</option>
          <option value="cold-kitchen">Kalte Küche</option>
          <option value="beverage-station">Getränke</option>
          <option value="pastry">Patisserie</option>
        </select>
      </label>}
    </div>
  );
}
