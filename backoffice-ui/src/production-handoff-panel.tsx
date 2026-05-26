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
  const { intakeOriginLabel, auditTrailLabel, exportLabel, contextLabel } = handoffState;

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
        <div className="handoff-fact">
          <span>Intake-Ursprung</span>
          <strong>{intakeOriginLabel}</strong>
        </div>
        <div className="handoff-fact">
          <span>Audit-Spur</span>
          <strong>{auditTrailLabel}</strong>
        </div>
        <div className="handoff-fact">
          <span>Übergabe-/Exportartefakte</span>
          <strong>{exportLabel}</strong>
        </div>
        {contextLabel ? (
          <div className="handoff-fact">
            <span>Abschluss-Kontext</span>
            <strong>Abschluss-Kontext: {contextLabel}</strong>
          </div>
        ) : null}
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
