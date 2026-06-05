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
        <p className="eyebrow">Abschlusszone</p>
        <h3>Herkunft und Übergabe</h3>
        <p className="helper-text">
          Ruhige Bündelung vorhandener Herkunfts-, Audit- und Exporthinweise. Keine rechtssichere Audit-Behauptung.
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
        Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.
        Fehlende Artefakte bleiben offen markiert; keine externe Freigabe, Signatur- oder Compliance-Behauptung.
      </p>
      <p className="helper-text">
        Es werden nur bestehende Metadaten und Artefaktzustände gezeigt; Rohtexte oder PDF-Extrakte werden hier nicht gespiegelt.
      </p>
    </article>
  );
}
