import { buildProductionSpecDetailsState } from "./production-spec-details-state.js";

type ProductionSpecDetailsCardProps = {
  spec?: Record<string, unknown>;
};

export function ProductionSpecDetailsCard({ spec }: ProductionSpecDetailsCardProps) {
  const detailsState = buildProductionSpecDetailsState(spec);

  if (!detailsState) {
    return null;
  }

  return (
    <div className="component-answer-card">
      <p className="eyebrow">Spezifikationsdetails</p>
      <p className="helper-text">{detailsState.contextLabel}</p>
      <p className="helper-text">{detailsState.eventLabel}</p>
      <p className="helper-text">{detailsState.summaryLabel}</p>
      <p className="helper-text">Menüpunkte / Komponenten:</p>
      <ul className="item-list compact">
        {detailsState.menuItems.map((item) => (
          <li key={item.key}>
            <strong>{item.label}</strong>
            <p className="helper-text">{item.detailLabel}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
