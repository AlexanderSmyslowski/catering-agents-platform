import type { IntakeRequestDetail } from "./api.js";
import {
  buildProductionIntakeOriginCardState,
  formatDocumentIngestionSummary
} from "./production-intake-origin-card-state.js";

type ProductionIntakeOriginCardProps = {
  intakeRequestDetail: IntakeRequestDetail;
};

export { formatDocumentIngestionSummary } from "./production-intake-origin-card-state.js";

export function ProductionIntakeOriginCard({ intakeRequestDetail }: ProductionIntakeOriginCardProps) {
  const state = buildProductionIntakeOriginCardState(intakeRequestDetail);

  return (
    <div className="component-answer-card">
      <p className="eyebrow">Ursprüngliche Intake-Anfrage</p>
      <p className="helper-text">{state.requestSummaryLabel}</p>
      <ul className="item-list compact">
        {state.rawInputs.map((rawInput) => (
          <li key={rawInput.key}>
            <strong>{rawInput.kindLabel}</strong>
            <p className="helper-text">{rawInput.mimeTypeLabel ?? ""}</p>
            {rawInput.documentIngestionSummary ? (
              <p className="helper-text">Dokumentprüfung: {rawInput.documentIngestionSummary}</p>
            ) : null}
            {rawInput.sourceMetadataSummary ? (
              <p className="helper-text">Quellenmetadaten (gekürzt): {rawInput.sourceMetadataSummary}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
