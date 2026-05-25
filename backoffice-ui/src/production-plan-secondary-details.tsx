import { ProductionPlanList } from "./production-plan-list.js";
import {
  translateMenuCategory,
  translateProductionMode
} from "./production-language.js";

type ProductionPlanSecondaryDetailsProps = {
  selectedPlan?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  submitting: boolean;
  setSelectedPlanId: (planId: string) => void;
  showArchivedPlans: boolean;
};

function formatPercent(value?: unknown): string | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return `${Math.round(numeric * 100)} %`;
}

export function ProductionPlanSecondaryDetails({
  selectedPlan,
  selectedPlanComponentsById,
  archivedPlans,
  specById,
  submitting,
  setSelectedPlanId,
  showArchivedPlans
}: ProductionPlanSecondaryDetailsProps) {
  if (!selectedPlan) {
    return null;
  }

  return (
    <details className="secondary-workspace">
      <summary>
        <span className="eyebrow">Sekundäre Details</span>
        <span className="subsection-title">Ältere Läufe, Rezeptauswahl und Arbeitsblätter</span>
        <span className="helper-text">Nur bei Bedarf aufklappen.</span>
      </summary>
      <div className="secondary-workspace__content">
        {showArchivedPlans && archivedPlans.length > 0 ? (
          <>
            <header>
              <p className="eyebrow">Ältere Produktionsläufe</p>
              <h4 className="subsection-title">Frühere Ergebnisse aus anderen Vorgängen</h4>
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
          {Array.isArray(selectedPlan.recipeSelections)
            ? selectedPlan.recipeSelections.map((selection) => {
                const selectionRecord = selection as Record<string, unknown>;
                const componentId = String(selectionRecord.componentId ?? "");
                const component = selectedPlanComponentsById.get(componentId);
                const componentLabel = String(component?.label ?? componentId);
                const qualityScore = formatPercent(selectionRecord.qualityScore);
                const fitScore = formatPercent(selectionRecord.fitScore);
                const searchTrace = Array.isArray(selectionRecord.searchTrace)
                  ? selectionRecord.searchTrace.map((entry) => String(entry))
                  : [];
                return (
                  <li key={componentId}>
                    <strong>{componentLabel}</strong>
                    <p>{String(selectionRecord.selectionReason ?? "-")}</p>
                    {component ? (
                      <p className="helper-text">
                        Kategorie: {translateMenuCategory(String(component.menuCategory ?? ""))}
                        {" · "}Herstellungsart:{" "}
                        {translateProductionMode(
                          String((component.productionDecision as Record<string, unknown> | undefined)?.mode ?? "")
                        )}
                      </p>
                    ) : null}
                    {qualityScore || fitScore ? (
                      <p className="helper-text">
                        {qualityScore ? `Qualität ${qualityScore}` : "Qualität offen"}
                        {fitScore ? ` · Passung ${fitScore}` : ""}
                      </p>
                    ) : null}
                    {searchTrace.length > 0 ? (
                      <div className="search-trace">
                        <p className="helper-text">Suchspur:</p>
                        <ul className="item-list compact trace-list">
                          {searchTrace.map((entry) => (
                            <li key={`${componentId}-${entry}`}>{entry}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })
            : null}
        </ul>

        {Array.isArray(selectedPlan.kitchenSheets) && selectedPlan.kitchenSheets.length > 0 ? (
          <>
            <div className="divider" />
            <header>
              <p className="eyebrow">Arbeitsblätter</p>
              <h4 className="subsection-title">Küche, Beschaffung und Klärungen</h4>
            </header>
            <ul className="item-list compact">
              {selectedPlan.kitchenSheets.map((sheet, sheetIndex) => {
                const sheetRecord = sheet as Record<string, unknown>;
                const instructions = Array.isArray(sheetRecord.instructions)
                  ? sheetRecord.instructions.map((entry) => String(entry))
                  : [];
                return (
                  <li key={`${String(sheetRecord.title ?? "Arbeitsblatt")}-${sheetIndex}`}>
                    <strong>{String(sheetRecord.title ?? "Arbeitsblatt")}</strong>
                    <ul className="item-list compact trace-list">
                      {instructions.map((instruction) => (
                        <li key={`${String(sheetRecord.title ?? "Arbeitsblatt")}-${instruction}`}>
                          {instruction}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </details>
  );
}
