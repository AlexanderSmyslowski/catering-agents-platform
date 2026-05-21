import { Children, type ReactNode } from "react";

type ProductionConversationalWorkbenchProps = {
  activeSpecLabel: string;
  readinessLabel: string;
  planStatusLabel: string;
  purchaseStatusLabel: string;
  questionCount: number;
  productionObjectCount: number;
  productionObjectStatusLabel: string;
  children: ReactNode;
};

function formatQuestionStatus(questionCount: number): string {
  if (questionCount === 0) {
    return "keine offenen Rückfragen";
  }
  if (questionCount === 1) {
    return "1 offene Rückfrage";
  }
  return `${questionCount} offene Rückfragen`;
}

export function ProductionConversationalWorkbench({
  activeSpecLabel,
  readinessLabel,
  planStatusLabel,
  purchaseStatusLabel,
  questionCount,
  productionObjectCount,
  productionObjectStatusLabel,
  children
}: ProductionConversationalWorkbenchProps) {
  const [inputPanel, questionsPanel, productionObjectsPanel, lowerPanels] = Children.toArray(children);

  return (
    <section className="production-conversation-layout" aria-label="Produktionsagent Conversational Workbench">
      <article className="production-composer" aria-label="Zentrale Produktionsarbeit">
        <header className="production-composer__header">
          <p className="eyebrow">Produktionsarbeit</p>
          <h3>Was braucht die Produktion als Nächstes?</h3>
          <p className="helper-text">
            Primärfläche für den aktuellen Vorgang. Bestehende Eingaben und Aktionen bleiben erhalten, werden aber ruhig geführt.
          </p>
        </header>
        {inputPanel}
      </article>

      <aside className="production-calm-summary" aria-label="Kompakte Produktionszusammenfassung">
        <span className="visually-hidden">production-calm-summary</span>
        <p className="eyebrow">Zusammenfassung</p>
        <strong>{activeSpecLabel}</strong>
        <p className="helper-text">
          Klarheit: {readinessLabel} · Rückfragen: {formatQuestionStatus(questionCount)}
        </p>
        <p className="helper-text">
          Planstatus: {planStatusLabel} · Einkaufstatus: {purchaseStatusLabel}
        </p>
      </aside>

      <div className="production-progressive-zone">
        <details className="progressive-panel" open={questionCount > 0}>
          <summary>
            <span>Rückfragen und Antworten</span>
            <strong>{formatQuestionStatus(questionCount)}</strong>
          </summary>
          <div className="progressive-panel__body">{questionsPanel}</div>
        </details>
      </div>

      <div className="production-objects-zone">
        <span className="visually-hidden">production-objects-zone</span>
        <details className="progressive-panel production-objects-panel" open={productionObjectCount > 0}>
          <summary>
            <span>Produktionsobjekte</span>
            <strong>{productionObjectStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{productionObjectsPanel}</div>
        </details>
      </div>

      <div className="production-lower-zones">{lowerPanels}</div>
    </section>
  );
}
