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
};

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
    <div className="workbench-projection" aria-label="Read-only Workbench-Projektion">
      <div>
        <p className="eyebrow">Workbench-Projektion</p>
        <p className="question-window__spec">{specLabel}</p>
        <p className="helper-text">
          Strukturierte Veranstaltungsdaten bleiben führend; dieser Bereich ist nur eine ruhige read-only Sicht.
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
  answerEditor
}: ProductionQuestionThreadProps) {
  return (
    <>
      <ReadOnlyWorkbenchProjection
        specLabel={specLabel}
        facts={facts}
        questionCount={questionCount}
        readinessLabel={readinessLabel}
      />
      <div className="component-answer-card" aria-label="Arbeitsverlauf">
        <p className="eyebrow">Arbeitsverlauf</p>
        <strong>Aktueller Vorgang</strong>
        <p className="helper-text">
          Read-only Session-Verlauf aus vorhandenen Spezifikations-, Rückfrage- und Output-Daten.
        </p>
      </div>
      <div className="result-status-strip" aria-label="Ergebnisstatus aktueller Vorgang">
        <span>
          <strong>Ergebnisstatus</strong>
        </span>
        <span>Plan: {selectedPlan ? selectedPlanReadinessLabel ?? "-" : "noch nicht berechnet"}</span>
        <span>Produktionsblatt: {selectedPlan ? "vorhanden" : "offen"}</span>
        <span>
          Einkauf: {currentSpecPurchaseLists.length > 0 ? `${currentSpecPurchaseLists.length} Liste(n)` : "offen"}
        </span>
      </div>
      <div className="structured-chat-thread" aria-label="Strukturierte Rückfragen als Chatfluss">
        {productionConversationProjection.messages.map((message) => {
          if (message.type === "production_output_anchor") {
            return null;
          }
          if (message.type === "user_structured_answer" && !message.clarificationAnswer) {
            return null;
          }

          const isClarificationAnswer = message.type === "user_structured_answer";

          return (
            <article
              className={
                isClarificationAnswer
                  ? "structured-chat-message structured-chat-message--user"
                  : "structured-chat-message"
              }
              key={message.messageId}
            >
              <div
                className={
                  isClarificationAnswer
                    ? "structured-chat-avatar structured-chat-avatar--user"
                    : "structured-chat-avatar"
                }
                aria-hidden="true"
              >
                {isClarificationAnswer ? "Du" : message.role === "system" ? "S" : "A"}
              </div>
              <div
                className={
                  isClarificationAnswer
                    ? "structured-chat-bubble structured-chat-bubble--user"
                    : "structured-chat-bubble"
                }
              >
                <div className="structured-chat-bubble__meta">
                  <p className="eyebrow">{message.title}</p>
                  {message.clarificationAnswerStatus ? (
                    <span
                      className={`clarification-status-badge clarification-status-badge--${message.clarificationAnswerStatus}`}
                    >
                      {message.clarificationAnswerStatus === "answered" ? "Rückfrage beantwortet" : "Rückfrage offen"}
                    </span>
                  ) : null}
                </div>
                <p>{message.text}</p>
              </div>
            </article>
          );
        })}
        {productionConversationProjection.messages
          .filter((message) => message.type === "production_output_anchor")
          .map((message) => (
            <article className="structured-chat-message" key={message.messageId}>
              <div className="structured-chat-avatar" aria-hidden="true">
                A
              </div>
              <div className="structured-chat-bubble">
                <p className="eyebrow">{message.title}</p>
                <p>{message.text}</p>
              </div>
            </article>
          ))}
        {answerEditor}
      </div>
    </>
  );
}
