import { productionExportUrl } from "./api.js";
import { getSpecLabel } from "./production-language.js";
import {
  formatProductionContextId,
  lookupProductionSpecById
} from "./production-route-state.js";

type ProductionPlanListProps = {
  plans: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  submitting: boolean;
  setSelectedPlanId: (planId: string) => void;
};

function translateReadiness(value?: string): string {
  const labels: Record<string, string> = {
    complete: "vollständig",
    partial: "teilweise vollständig",
    insufficient: "unzureichend"
  };
  return value ? labels[value] ?? value : "-";
}

export function ProductionPlanList({
  plans,
  specById,
  submitting,
  setSelectedPlanId
}: ProductionPlanListProps) {
  return (
    <ul className="item-list compact">
      {plans.map((plan) => {
        const relatedSpec = lookupProductionSpecById(specById, plan.eventSpecId);
        const planId = formatProductionContextId(plan.planId);
        const unresolvedCount = Array.isArray(plan.unresolvedItems) ? plan.unresolvedItems.length : 0;
        const batchCount = Array.isArray(plan.productionBatches) ? plan.productionBatches.length : 0;
        const sheetCount = Array.isArray(plan.kitchenSheets) ? plan.kitchenSheets.length : 0;
        const selectionCount = Array.isArray(plan.recipeSelections) ? plan.recipeSelections.length : 0;
        return (
          <li key={String(plan.planId)}>
            <strong>{relatedSpec ? getSpecLabel(relatedSpec) : "Produktionsplan"}</strong>
            <p>
              Status: {translateReadiness(String((plan.readiness as Record<string, unknown>)?.status ?? "-"))}
              {" · "}Arbeitsblätter: {sheetCount}
              {" · "}Rezeptblätter: {batchCount}
              {" · "}Rezeptauswahl: {selectionCount}
              {" · "}Offene Punkte: {unresolvedCount}
            </p>
            <div className="action-row">
              <button
                className="secondary-button"
                disabled={submitting}
                onClick={() => setSelectedPlanId(String(plan.planId))}
              >
                Einzelheiten
                <span className="visually-hidden">
                  {" "}
                  zu diesem Produktionsplan
                </span>
              </button>
            </div>
            <a
              className="ghost-link"
              href={productionExportUrl(planId)}
              target="_blank"
              rel="noreferrer"
            >
              Produktionsblatt exportieren
              <span className="visually-hidden">
                {" "}
                für diesen Produktionsplan
              </span>
            </a>
            <p className="helper-text">Export ist ein internes Arbeitsdokument; keine Produktionsfreigabe.</p>
          </li>
        );
      })}
      {plans.length === 0 ? (
        <li>
          Noch keine Produktionspläne vorhanden. Noch kein Produktionsplan für den aktuellen Vorgang. Nächster Schritt:
          Berechnung starten.
        </li>
      ) : null}
    </ul>
  );
}
