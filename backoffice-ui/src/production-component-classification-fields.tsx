type ProductionComponentClassificationFieldsProps = {
  menuCategory: string;
  productionMode: string;
  onMenuCategoryChange: (menuCategory: string) => void;
  onProductionModeChange: (productionMode: string) => void;
};

export function ProductionComponentClassificationFields({
  menuCategory,
  productionMode,
  onMenuCategoryChange,
  onProductionModeChange
}: ProductionComponentClassificationFieldsProps) {
  return (
    <div className="answer-grid">
      <label className="field-block">
        <span>Kategorie im Angebot</span>
        <select
          aria-label="Kategorie im Angebot"
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
    </div>
  );
}
