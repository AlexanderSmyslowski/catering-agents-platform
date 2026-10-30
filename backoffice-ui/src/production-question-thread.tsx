import type { ReactNode } from "react";
import type { ProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";

export type WorkbenchSpecFact = {
  label: string;
  value: string;
};

type ProductionQuestionThreadProps = {
  specLabel: string;
  facts: WorkbenchSpecFact[];
  questionCount: number;
  readinessLabel: string;
  selectedPlan?: Record<string, unknown>;
  selectedPlanReadinessLabel?: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  productionConversationProjection: ProductionConversationProjection;
  answerEditor?: ReactNode;
  renderQuestionActions?: (question: string) => ReactNode;
};

function formatPurchaseListCount(count: number): string {
  return count === 1 ? "1 Liste" : `${count} Listen`;
}

function ReadOnlyWorkbenchProjection({
  specLabel,
  facts,
  questionCount,
  readinessLabel
}: {
  specLabel: string;
  facts: WorkbenchSpecFact[];
  questionCount: number;
  readinessLabel: string;
}) {
  return (
    <div className="workbench-projection" aria-label="Erkannte Eckdaten">
      <div>
        <p className="eyebrow">Erkannte Eckdaten</p>
        <p className="question-window__spec">{specLabel}</p>
        <p className="helper-text">
          Diese Angaben stammen aus dem aktuellen Entwurf und bleiben bis zur Prüfung unverbindlich.
        </p>
      </div>
      <dl className="spec-fact-grid">
        {facts.map((fact) => (
          <div key={fact.label} className="spec-fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="clarification-strip">
        <span>Klärbereich</span>
        <strong>{questionCount === 1 ? "1 offene Rückfrage" : `${questionCount} offene Rückfragen`}</strong>
      </div>
      <p className="helper-text">Status: {readinessLabel}</p>
    </div>
  );
}

export function ProductionQuestionThread({
  specLabel,
  facts,
  questionCount,
  readinessLabel,
  selectedPlan,
  selectedPlanReadinessLabel,
  currentSpecPurchaseLists,
  productionConversationProjection,
  answerEditor,
  renderQuestionActions
}: ProductionQuestionThreadProps) {
  const messages = productionConversationProjection.messages;
  const questions = messages.filter(message => message.type === "structured_agent_question");
  const warnings = messages.filter(message => message.type === "ingestion_warning_anchor");
  const provenance = messages.filter(message =>
    message.type === "system_agent_hint" || message.type === "source_provenance_anchor" ||
    message.type === "production_output_anchor"
  );

  return (
    <>
      {warnings.length > 0 ? <section className="production-question-warnings" aria-label="Hinweise zur Lesbarkeit der Quelle">
        <h4>Quelle prüfen</h4>
        {warnings.map(message => <p key={message.messageId}>{message.text}</p>)}
      </section> : null}
      {answerEditor}
      {questions.length > 0 ? <ol className="production-question-list" aria-label="Rückfragen zum Auftrag">
        {questions.map((message, index) => {
          const answers = messages.filter(answer => answer.type === "user_structured_answer" &&
            answer.clarificationAnswer && answer.questionIndex === message.questionIndex);
          return <li className="production-question" key={message.messageId}>
            <div className="production-question__heading">
              <h4>Frage {index + 1} von {questions.length}</h4>
              <span className={`clarification-status-badge clarification-status-badge--${message.clarificationAnswerStatus ?? "unanswered"}`}>
                {message.clarificationAnswerStatus === "answered" ? "Rückfrage beantwortet" : "Rückfrage offen"}
              </span>
            </div>
            <p>{message.text}</p>
            {message.clarificationAnswerStatus === "answered" && message.reviewedAnswerText ? <div className="production-question__answer">
              <strong>Gespeicherte Antwort</strong><p>{message.reviewedAnswerText}</p>
            </div> : null}
            {renderQuestionActions?.(message.text)}
            {answers.map(answer => <div className="production-question__answer" key={answer.messageId}>
              <strong>Gespeicherte Antwort</strong>
              <p>{answer.text}</p>
            </div>)}
          </li>;
        })}
      </ol> : null}
      <details className="question-context-details">
        <summary><span>Datenstand anzeigen</span><strong>{specLabel}</strong></summary>
        <ReadOnlyWorkbenchProjection specLabel={specLabel} facts={facts} questionCount={questionCount} readinessLabel={readinessLabel} />
        <div className="result-status-strip" aria-label="Ergebnisstatus aktueller Vorgang">
          <span><strong>Ergebnisstatus</strong></span>
          <span>Plan: {selectedPlan ? selectedPlanReadinessLabel ?? "-" : "noch nicht berechnet"}</span>
          <span>Produktionsblatt: {selectedPlan ? "vorhanden" : "offen"}</span>
          <span>Einkauf: {currentSpecPurchaseLists.length > 0 ? formatPurchaseListCount(currentSpecPurchaseLists.length) : "offen"}</span>
        </div>
      </details>
      {provenance.length > 0 ? <details className="production-question-provenance technical-context-details">
        <summary>Herkunft und technische Hinweise</summary>
        {provenance.map(message => <p className="helper-text" key={message.messageId}>{message.text}</p>)}
      </details> : null}
    </>
  );
}
