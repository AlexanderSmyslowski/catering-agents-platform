import { buildProductionHandoffPanelState } from "./production-handoff-panel-state.js";

export type ProductionHandoffState = {
  intakeOriginLabel: string;
  auditTrailLabel: string;
  exportLabel: string;
  contextLabel?: string;
};

type ProductionHandoffPanelProps = {
  handoffState: ProductionHandoffState;
};

export function ProductionHandoffPanel({
  handoffState
}: ProductionHandoffPanelProps) {
  const state = buildProductionHandoffPanelState(handoffState);

  return (
    <article className="production-handoff-zone" aria-label="Herkunft und Übergabe">
      <header>
        <h3>Herkunft und Übergabe</h3>
        <p className="helper-text">
          Hier siehst du, woher der Auftrag stammt und welche Unterlagen vorliegen.
        </p>
      </header>
      <div className="handoff-fact-grid">
        {state.facts.map((fact) => (
          <div className="handoff-fact" key={fact.key}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
          </div>
        ))}
      </div>
      <p className="helper-text">
        Produktionsplan, Einkaufsliste und Verlauf sind interne Arbeitsunterlagen.
        Fehlende Unterlagen bleiben als offen gekennzeichnet.
      </p>
      <p className="helper-text">
        Die Übergabe ersetzt keine fachliche Freigabe für die tatsächliche Produktion.
        Sie ist keine externe Freigabe, Signatur oder rechtliche Zusicherung.
      </p>
    </article>
  );
}
