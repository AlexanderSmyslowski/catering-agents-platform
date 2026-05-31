import { productionExportUrl } from "./api.js";
import { getSpecLabel, translateServiceForm } from "./production-language.js";

type ProductionPlanDownloadCardProps = {
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
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
  selectedPlanSpec
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

  return (
    <>
      <div className="divider" />
      <header>
        <p className="eyebrow">Downloadbereich</p>
        <h3>{selectedPlanSpec ? getSpecLabel(selectedPlanSpec) : "Produktionsplan"}</h3>
      </header>
      <p className="helper-text">
        {`Plan-Kontext: planId ${String(selectedPlan.planId ?? "-")} · specId ${String(
          selectedPlan.eventSpecId ?? selectedPlanSpec?.specId ?? "-"
        )}`}
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
          href={productionExportUrl(String(selectedPlan.planId))}
          target="_blank"
          rel="noreferrer"
        >
          Produktionsblatt exportieren
          <span className="visually-hidden">
            {" "}
            für aktuellen Plan {String(selectedPlan.planId ?? "-")} · Spezifikation{" "}
            {String(selectedPlan.eventSpecId ?? selectedPlanSpec?.specId ?? "-")}
          </span>
        </a>
      </div>
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
