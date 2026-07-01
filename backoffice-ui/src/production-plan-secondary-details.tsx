import { ProductionPlanList } from "./production-plan-list.js";
import { buildProductionPlanSecondaryDetailsState } from "./production-plan-secondary-details-state.js";

type ProductionPlanSecondaryDetailsProps = {
  selectedPlan?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  submitting: boolean;
  setSelectedPlanId: (planId: string) => void;
  showArchivedPlans: boolean;
};

export function ProductionPlanSecondaryDetails({
  selectedPlan,
  selectedPlanComponentsById,
  archivedPlans,
  specById,
  submitting,
  setSelectedPlanId,
  showArchivedPlans
}: ProductionPlanSecondaryDetailsProps) {
  const state = buildProductionPlanSecondaryDetailsState({
    selectedPlan,
    selectedPlanComponentsById,
    archivedPlans,
    showArchivedPlans
  });

  if (!selectedPlan || !state) {
    return null;
  }

  return (
    <details className="secondary-workspace">
      <summary>
        <span className="eyebrow">Sekundäre Details</span>
        {" "}
        <span className="subsection-title">Ältere Läufe, Rezeptauswahl und Arbeitsblätter</span>
        {" "}
        <span className="helper-text">Nur bei Bedarf aufklappen; ältere Läufe sind nicht der aktuelle Vorgang.</span>
      </summary>
      <div className="secondary-workspace__content">
        {state.showArchivedPlansSection ? (
          <>
            <header>
              <p className="eyebrow">Ältere Produktionsläufe</p>
              <h4 className="subsection-title">Frühere Ergebnisse aus anderen Vorgängen</h4>
              <p className="helper-text">
                Diese früheren Produktionsläufe sind Kontext aus anderen Vorgängen, nicht das aktuelle Ergebnis.
              </p>
            </header>
            <ProductionPlanList
              plans={archivedPlans}
              specById={specById}
              submitting={submitting}
              setSelectedPlanId={setSelectedPlanId}
            />
          </>
        ) : null}

        <ul className="item-list compact">
          {state.recipeSelections.map((selection) => (
            <li key={selection.key}>
              <strong>{selection.componentLabel}</strong>
              <p>{selection.selectionReasonLabel}</p>
              {selection.componentDetailLabel ? (
                <p className="helper-text">{selection.componentDetailLabel}</p>
              ) : null}
              <p className="helper-text">Rezeptquelle: {selection.sourceLabel}</p>
              {selection.scoreLabel ? <p className="helper-text">{selection.scoreLabel}</p> : null}
              {selection.searchTrace.length > 0 ? (
                <div className="search-trace">
                  <p className="helper-text">Suchspur:</p>
                  <ul className="item-list compact trace-list">
                    {selection.searchTrace.map((entry) => (
                      <li key={`${selection.key}-${entry}`}>{entry}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {state.showKitchenSheetsSection ? (
          <>
            <div className="divider" />
            <header>
              <p className="eyebrow">Arbeitsblätter</p>
              <h4 className="subsection-title">Küche, Beschaffung und Klärungen</h4>
            </header>
            <ul className="item-list compact">
              {state.kitchenSheets.map((sheet) => (
                <li key={sheet.key}>
                  <strong>{sheet.title}</strong>
                  <p className="helper-text">Rezeptquelle: {sheet.sourceLabel}</p>
                  <ul className="item-list compact trace-list">
                    {sheet.instructions.map((instruction) => (
                      <li key={`${sheet.key}-${instruction}`}>{instruction}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </details>
  );
}
