import { Children, type ReactNode } from "react";
import { buildProductionMiniPilotCardState } from "./production-mini-pilot-card-state.js";
import { buildProductionWorkbenchOutputAnchorState } from "./production-workbench-output-anchor-state.js";

export type ProductionWorkbenchSummary = {
  activeSpecLabel: string;
  readinessLabel: string;
  planStatusLabel: string;
  purchaseStatusLabel: string;
  questionCount: number;
  answeredQuestionCount: number;
  unansweredQuestionCount: number;
  productionObjectCount: number;
  productionObjectStatusLabel: string;
  purchaseListCount: number;
};

export type ProductionWorkbenchNextStep = {
  title: string;
  description: string;
};

type ProductionConversationalWorkbenchProps = {
  summary: ProductionWorkbenchSummary;
  nextStep: ProductionWorkbenchNextStep;
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

function countOpenVisibleQuestions(
  questionCount: number,
  answeredQuestionCount: number,
  fallbackUnansweredQuestionCount: number
): number {
  if (questionCount > 0) {
    return Math.max(0, questionCount - answeredQuestionCount);
  }
  return Math.max(0, fallbackUnansweredQuestionCount);
}

export function ProductionConversationalWorkbench({
  summary,
  nextStep,
  children
}: ProductionConversationalWorkbenchProps) {
  const miniPilotCard = buildProductionMiniPilotCardState();
  const {
    activeSpecLabel,
    readinessLabel,
    planStatusLabel,
    purchaseStatusLabel,
    questionCount,
    answeredQuestionCount,
    unansweredQuestionCount,
    productionObjectCount,
    productionObjectStatusLabel,
    purchaseListCount
  } = summary;
  const [inputPanel, questionsPanel, productionObjectsPanel, purchasePanel, lowerPanels] = Children.toArray(children);
  const openVisibleQuestionCount = countOpenVisibleQuestions(
    questionCount,
    answeredQuestionCount,
    unansweredQuestionCount
  );
  const productionOutputAnchor = buildProductionWorkbenchOutputAnchorState({ productionObjectCount });

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
            <strong>{nextStep.title}</strong>
            <p className="helper-text">{nextStep.description}</p>
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
          Rückfragenstatus: offen {openVisibleQuestionCount} · beantwortet {answeredQuestionCount}
        </p>
        <p className="helper-text">
          Interner Beta-Schritt: Produktion, Einkaufsliste, Exporte, Herkunft und offene Rückfragen bleiben nachvollziehbar.
        </p>
        <p className="helper-text">
          Synthetische Beta-Grenze: Produktionsobjekte nur intern prüfen; keine echten Einsatzdaten und keine Produktionsfreigabe.
        </p>
        <p className="helper-text">
          Beta-Pfad: Rückfragen -&gt; Ergebnisobjekte -&gt; Exporte/Audit.
        </p>
        <p className="helper-text">
          Reviewer-Hinweis: nur fiktive P7-Szenarioangaben nutzen; Evidenz als Route, Erwartung, Beobachtung und Beleg notieren.
        </p>
        <p className="helper-text">
          Beta-Prüfpunkt: prüfbar, wenn Rückfragenstatus, Produktionsobjekte und Export-/Auditanker sichtbar
          sind; offene Stop-Punkte bleiben Stop statt Freigabe.
        </p>
        <p className="helper-text">
          Option-A-Zeitfenster: verbindliches Zeitfenster manuell klären und nur als Rehearsal-Notiz festhalten; keine automatische event.schedule-Übernahme.
        </p>
        <p className="helper-text">
          Planstatus: {planStatusLabel} · Einkaufstatus: {purchaseStatusLabel}
        </p>
        <p className="helper-text">Ergebnisobjekte: {productionObjectStatusLabel}</p>
        <div className="search-trace" aria-label="Interner Draft-Pilot">
          <p className="eyebrow">{miniPilotCard.eyebrow}</p>
          <strong>{miniPilotCard.title}</strong>
          <p className="helper-text">{miniPilotCard.helperText}</p>
          <ul className="item-list trace-list">
            {miniPilotCard.steps.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <p className="helper-text">{step.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="production-progressive-zone">
        <details className="progressive-panel" open={questionCount > 0}>
          <summary>
            <span>Rückfragen und Antworten</span>
            <strong>offen {openVisibleQuestionCount} · beantwortet {answeredQuestionCount}</strong>
          </summary>
          <div className="progressive-panel__body">{questionsPanel}</div>
        </details>
      </div>

      <div className="production-objects-zone">
        <span className="visually-hidden">production-objects-zone</span>
        <article className="production-output-anchor" aria-label="Nächster Agent-Schritt zu Produktionsobjekten">
          <p className="eyebrow">Nächster Agent-Schritt</p>
          <h3>{productionOutputAnchor.title}</h3>
          <p className="helper-text">{productionOutputAnchor.description}</p>
          <p className="helper-text">{productionOutputAnchor.grouping}</p>
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
