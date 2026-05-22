import { Children, type ReactNode } from "react";

type ProductionConversationalWorkbenchProps = {
  activeSpecLabel: string;
  readinessLabel: string;
  planStatusLabel: string;
  purchaseStatusLabel: string;
  nextStepTitle: string;
  nextStepDescription: string;
  questionCount: number;
  productionObjectCount: number;
  productionObjectStatusLabel: string;
  purchaseListCount: number;
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
  nextStepTitle,
  nextStepDescription,
  questionCount,
  productionObjectCount,
  productionObjectStatusLabel,
  purchaseListCount,
  children
}: ProductionConversationalWorkbenchProps) {
  const [inputPanel, questionsPanel, productionObjectsPanel, purchasePanel, lowerPanels] = Children.toArray(children);

  return (
    <section className="production-conversation-layout" aria-label="Produktionsagent Conversational Workbench">
      <article className="production-composer" aria-label="Zentrale Produktionsarbeit">
        <header className="production-composer__header">
          <p className="eyebrow">Produktionsagent-Chat</p>
          <h3>Was braucht die Produktion als Nächstes?</h3>
          <p className="helper-text">
            Angebot als Datei oder Text in den Chatbereich geben; der Agent zeigt Rückfragen, Status und druckbare Ergebnisse als prüfbare Zonen.
          </p>
          <div className="production-next-step" aria-label="Nächster Produktionsschritt">
            <p className="eyebrow">Nächster Schritt</p>
            <strong>{nextStepTitle}</strong>
            <p className="helper-text">{nextStepDescription}</p>
          </div>
        </header>
        {inputPanel}
      </article>

      <aside className="production-calm-summary" aria-label="Kompakte Produktionszusammenfassung">
        <span className="visually-hidden">production-calm-summary</span>
        <p className="eyebrow">Aktiver Vorgang</p>
        <strong>{activeSpecLabel}</strong>
        <p className="helper-text">
          Klarheit: {readinessLabel} · Rückfragen: {formatQuestionStatus(questionCount)}
        </p>
        <p className="helper-text">
          Planstatus: {planStatusLabel} · Einkaufstatus: {purchaseStatusLabel}
        </p>
        <p className="helper-text">Ergebnisobjekte: {productionObjectStatusLabel}</p>
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
        <article className="production-output-anchor" aria-label="Nächster Agent-Schritt zu Produktionsobjekten">
          <p className="eyebrow">Nächster Agent-Schritt</p>
          <h3>Produktionsobjekte und Downloads prüfen</h3>
          <p className="helper-text">
            Nach den strukturierten Antworten liegen oder entstehen hier Produktionsplan, Rezepte/Objektübersicht,
            Einkaufsliste und Downloads. Der Bereich nutzt nur vorhandene Pläne, Einkaufslisten und Exportlinks.
          </p>
          <p className="helper-text">
            Vorhandene Pläne, Einkaufslisten und Exportlinks sind getrennt gruppiert und bleiben read-only prüfbar.
          </p>
        </article>
        <details className="progressive-panel production-objects-panel" open={productionObjectCount > 0}>
          <summary>
            <span>Produktionsobjekte</span>
            <strong>{productionObjectStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{productionObjectsPanel}</div>
        </details>
      </div>

      <div className="production-purchase-zone">
        <span className="visually-hidden">production-purchase-zone</span>
        <details className="progressive-panel production-purchase-panel" open={purchaseListCount > 0}>
          <summary>
            <span>Einkaufsliste</span>
            <strong>{purchaseStatusLabel}</strong>
          </summary>
          <div className="progressive-panel__body">{purchasePanel}</div>
        </details>
      </div>

      <div className="production-lower-zones">{lowerPanels}</div>
    </section>
  );
}
