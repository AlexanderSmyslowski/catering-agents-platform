import { productionExportUrl, productionFolderExportUrl } from "./api.js";
import { getSpecLabel, translateServiceForm } from "./production-language.js";
import type { ProductionMiniPilotActionState } from "./production-mini-pilot-action-state.js";
import { formatProductionContextId } from "./production-route-state.js";

type ProductionPlanDownloadCardProps = {
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  miniPilotActionState?: ProductionMiniPilotActionState;
  onClearMiniPilotResult?: () => void;
};

function translateReadiness(value?: string): string {
  const labels: Record<string, string> = {
    complete: "vollständig",
    partial: "teilweise vollständig",
    insufficient: "unzureichend"
  };
  return value ? labels[value] ?? value : "-";
}

export function ProductionPlanDownloadCard({
  selectedPlan,
  selectedPlanSpec,
  miniPilotActionState,
  onClearMiniPilotResult
}: ProductionPlanDownloadCardProps) {
  if (!selectedPlan) {
    return null;
  }

  const readiness = selectedPlan.readiness as Record<string, unknown> | undefined;
  const servicePlan = selectedPlanSpec?.servicePlan as Record<string, unknown> | undefined;
  const kitchenSheetCount = Array.isArray(selectedPlan.kitchenSheets) ? selectedPlan.kitchenSheets.length : 0;
  const productionBatchCount = Array.isArray(selectedPlan.productionBatches) ? selectedPlan.productionBatches.length : 0;
  const recipeSelectionCount = Array.isArray(selectedPlan.recipeSelections) ? selectedPlan.recipeSelections.length : 0;
  const unresolvedItems = Array.isArray(selectedPlan.unresolvedItems) ? selectedPlan.unresolvedItems : [];
  const hasOperationalSheetsWithoutRecipeBatches =
    productionBatchCount === 0 && kitchenSheetCount > 0;
  const planId = formatProductionContextId(selectedPlan.planId);

  return (
    <>
      <div className="divider" />
      <header>
        <p className="eyebrow">Downloadbereich</p>
        <h3>{selectedPlanSpec ? getSpecLabel(selectedPlanSpec) : "Produktionsplan"}</h3>
      </header>
      <p className="helper-text">
        Plan-Kontext: aktueller Produktionsplan
      </p>
      <p className="helper-text">
        Status: {translateReadiness(String(readiness?.status ?? "-"))}
        {selectedPlanSpec
          ? ` · Serviceform: ${translateServiceForm(String(servicePlan?.serviceForm ?? "offen"))}`
          : ""}
        {" · "}Arbeitsblätter: {kitchenSheetCount}
        {" · "}Rezeptblätter: {productionBatchCount}
        {" · "}Rezeptauswahl: {recipeSelectionCount}
      </p>
      <div className="production-output-summary" aria-label="Produktionsplan-Export">
        <div>
          <p className="eyebrow">Plan</p>
          <strong>Produktionsblatt</strong>
          <p className="helper-text">Druckbares Ergebnis aus dem bestehenden Exportpfad.</p>
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
            für aktuellen Produktionsplan
          </span>
        </a>
        <a
          className="ghost-link"
          href={productionFolderExportUrl(planId)}
          target="_blank"
          rel="noreferrer"
        >
          Produktionsmappe (HTML)
          <span className="visually-hidden">
            {" "}
            für aktuellen Produktionsplan
          </span>
        </a>
      </div>
      {miniPilotActionState ? (
        <div className="search-trace" aria-label="Mini-Pilot-Status vor Export">
          <p className="eyebrow">{miniPilotActionState.eyebrow}</p>
          <strong>{miniPilotActionState.title}</strong>
          <p className="helper-text">{miniPilotActionState.statusLabel}</p>
          <p className="helper-text">{miniPilotActionState.reasonLabel}</p>
          {miniPilotActionState.trustLabel ? (
            <p className="helper-text">{miniPilotActionState.trustLabel}</p>
          ) : null}
          {miniPilotActionState.provenanceLabel ? (
            <p className="helper-text">{miniPilotActionState.provenanceLabel}</p>
          ) : null}
          {miniPilotActionState.cautionLabel ? (
            <p className="helper-text">{miniPilotActionState.cautionLabel}</p>
          ) : null}
          <p className="helper-text">{miniPilotActionState.helperText}</p>
          <p className="helper-text">
            Lokaler Check: <code>{miniPilotActionState.commandLabel}</code>
          </p>
          {onClearMiniPilotResult ? (
            <div className="quiet-action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={onClearMiniPilotResult}
              >
                Mini-Pilot-Stand leeren
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {unresolvedItems.length > 0 ? (
        <>
          <p>Offene Punkte:</p>
          <ul className="item-list compact">
            {unresolvedItems.map((entry) => (
              <li key={String(entry)}>{String(entry)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>Offene Punkte: keine</p>
      )}
      {hasOperationalSheetsWithoutRecipeBatches ? (
        <p className="helper-text">
          Es liegen bereits operative Arbeitsblätter vor. Rezeptblätter entstehen zusätzlich, sobald für die offenen
          Komponenten ein belastbares Rezept oder eine eindeutige Beschaffungsentscheidung vorliegt.
        </p>
      ) : null}
    </>
  );
}
