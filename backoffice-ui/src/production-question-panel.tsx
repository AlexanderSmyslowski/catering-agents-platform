import type { ProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";
import type { IntakeRequestDetail } from "./api.js";
import { ProductionIntakeOriginCard } from "./production-intake-origin-card.js";
import { getSpecLabel } from "./production-language.js";
import { ProductionSpecDetailsCard } from "./production-spec-details.js";
import { ProductionStructuredAnswerEditor } from "./production-structured-answer-editor.js";
import type { ComponentEditState } from "./production-structured-answer-editor.js";

export { formatDocumentIngestionSummary } from "./production-intake-origin-card.js";

type WorkbenchSpecFact = {
  label: string;
  value: string;
};

type ProductionQuestionPanelProps = {
  focusedProductionSpec?: Record<string, unknown>;
  focusedSpecReadinessLabel: string;
  selectedPlan?: Record<string, unknown>;
  selectedPlanReadinessLabel?: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  productionQuestions: string[];
  productionAssumptions: string[];
  productionConversationProjection: ProductionConversationProjection;
  workbenchSpecFacts: WorkbenchSpecFact[];
  intakeRequestDetailError?: string;
  intakeRequestDetail: IntakeRequestDetail | null;
  submitting: boolean;
  editingSpecId?: string;
  editingEventType: string;
  editingEventDate: string;
  editingAttendeeCount: string;
  editingServiceForm: string;
  editingMenuItems: string;
  editingComponentStates: Record<string, ComponentEditState>;
  hasFocusedSpecEditChanges: boolean;
  recipes: Array<Record<string, unknown>>;
  filteredSpecs: Array<Record<string, unknown>>;
  documentPhase: "idle" | "analysing" | "done";
  productionWorkspaceCleared: boolean;
  setEditingEventType: (value: string) => void;
  setEditingEventDate: (value: string) => void;
  setEditingAttendeeCount: (value: string) => void;
  setEditingServiceForm: (value: string) => void;
  setEditingMenuItems: (value: string) => void;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
  beginSpecEdit: (spec: Record<string, unknown>) => void;
  saveSpecEdit: () => Promise<void>;
  createPlan: (spec: Record<string, unknown>) => Promise<void>;
  resetSpecEdit: (markDismissed?: boolean) => void;
  openSpecForQuestions: (specId: string) => void;
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

export function ProductionQuestionPanel({
  focusedProductionSpec,
  focusedSpecReadinessLabel,
  selectedPlan,
  selectedPlanReadinessLabel,
  currentSpecPurchaseLists,
  productionQuestions,
  productionAssumptions,
  productionConversationProjection,
  workbenchSpecFacts,
  intakeRequestDetailError,
  intakeRequestDetail,
  submitting,
  editingSpecId,
  editingEventType,
  editingEventDate,
  editingAttendeeCount,
  editingServiceForm,
  editingMenuItems,
  editingComponentStates,
  hasFocusedSpecEditChanges,
  recipes,
  filteredSpecs,
  documentPhase,
  productionWorkspaceCleared,
  setEditingEventType,
  setEditingEventDate,
  setEditingAttendeeCount,
  setEditingServiceForm,
  setEditingMenuItems,
  updateEditingComponentState,
  beginSpecEdit,
  saveSpecEdit,
  createPlan,
  resetSpecEdit,
  openSpecForQuestions
}: ProductionQuestionPanelProps) {
  return (
    <article className="panel form-panel question-panel production-step-card">
      <header>
        <p className="eyebrow">Strukturierte Rückfragen im Chatfluss</p>
        <h3>Rückfragen des Agenten</h3>
        <p className="helper-text">
          Assistant-Fragen aus den vorhandenen Produktionsdaten; strukturierte Antwortfelder statt freier LLM-Chat.
        </p>
      </header>
      {focusedProductionSpec ? (
        <>
          <div className="question-window">
            <ReadOnlyWorkbenchProjection
              specLabel={getSpecLabel(focusedProductionSpec)}
              facts={workbenchSpecFacts}
              questionCount={productionQuestions.length}
              readinessLabel={focusedSpecReadinessLabel}
            />
            <div className="component-answer-card" aria-label="ConversationSession-Projektion">
              <p className="eyebrow">ConversationSession-Projektion</p>
              <strong>{productionConversationProjection.sessionId}</strong>
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
              {editingSpecId === String(focusedProductionSpec.specId) ? (
                <ProductionStructuredAnswerEditor
                  focusedProductionSpec={focusedProductionSpec}
                  editingEventType={editingEventType}
                  editingEventDate={editingEventDate}
                  editingAttendeeCount={editingAttendeeCount}
                  editingServiceForm={editingServiceForm}
                  editingMenuItems={editingMenuItems}
                  editingComponentStates={editingComponentStates}
                  recipes={recipes}
                  setEditingEventType={setEditingEventType}
                  setEditingEventDate={setEditingEventDate}
                  setEditingAttendeeCount={setEditingAttendeeCount}
                  setEditingServiceForm={setEditingServiceForm}
                  setEditingMenuItems={setEditingMenuItems}
                  updateEditingComponentState={updateEditingComponentState}
                />
              ) : null}
            </div>
            {productionAssumptions.length > 0 ? (
              <>
                <p className="eyebrow">Annahmen des Agenten</p>
                <ul className="item-list compact">
                  {productionAssumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <ProductionSpecDetailsCard spec={focusedProductionSpec} />
            {intakeRequestDetailError ? (
              <p className="helper-text" role="status">
                {intakeRequestDetailError}
              </p>
            ) : null}
            {intakeRequestDetail ? <ProductionIntakeOriginCard intakeRequestDetail={intakeRequestDetail} /> : null}
          </div>
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={submitting || editingSpecId === String(focusedProductionSpec.specId)}
              onClick={() => beginSpecEdit(focusedProductionSpec)}
            >
              Antworten bearbeiten
            </button>
            {editingSpecId === String(focusedProductionSpec.specId) ? (
              <button
                className="secondary-button"
                disabled={submitting || !hasFocusedSpecEditChanges}
                onClick={() => void saveSpecEdit()}
              >
                Antworten speichern
              </button>
            ) : null}
            <button disabled={submitting} onClick={() => void createPlan(focusedProductionSpec)}>
              {editingSpecId === String(focusedProductionSpec.specId)
                ? "Speichern und Berechnung starten"
                : "Berechnung starten"}
            </button>
          </div>
        </>
      ) : (
        <p className="helper-text">
          {documentPhase === "analysing"
            ? "Der Agent wertet das hochgeladene Dokument gerade aus und erzeugt daraus operative Veranstaltungsdaten."
            : productionWorkspaceCleared
              ? "Der aktuelle Vorgang wurde geleert. Nach einem neuen Upload erscheinen hier wieder die Rückfragen des Agenten."
              : "Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheinen hier die Rückfragen des Agenten."}
        </p>
      )}
      {!productionWorkspaceCleared && filteredSpecs.length > 1 ? (
        <>
          <div className="divider" />
          <header>
            <p className="eyebrow">Erkannte Eingänge</p>
            <h3>Zwischen mehreren Vorgängen wechseln</h3>
          </header>
          <ul className="item-list compact">
            {filteredSpecs.slice(0, 6).map((spec) => (
              <li key={String(spec.specId)}>
                <strong>{getSpecLabel(spec)}</strong>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    onClick={() => openSpecForQuestions(String(spec.specId))}
                  >
                    Für Rückfragen öffnen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {editingSpecId && editingSpecId !== String(focusedProductionSpec?.specId ?? "") ? (
        <>
          <div className="divider" />
          <div className="form-panel">
            <header>
              <p className="eyebrow">Antwortfenster</p>
              <h3>{editingSpecId}</h3>
            </header>
            <input
              value={editingEventType}
              onChange={(event) => setEditingEventType(event.target.value)}
              placeholder="Veranstaltungstyp, z. B. Konferenz"
            />
            <input
              value={editingEventDate}
              onChange={(event) => setEditingEventDate(event.target.value)}
              placeholder="Datum, z. B. 2026-06-18"
            />
            <input
              value={editingAttendeeCount}
              onChange={(event) => setEditingAttendeeCount(event.target.value)}
              placeholder="Teilnehmerzahl"
            />
            <input
              value={editingServiceForm}
              onChange={(event) => setEditingServiceForm(event.target.value)}
              placeholder="Serviceform, z. B. Buffet"
            />
            <textarea
              value={editingMenuItems}
              onChange={(event) => setEditingMenuItems(event.target.value)}
              placeholder="Menüpunkte, durch Komma getrennt"
            />
            <div className="action-row">
              <button disabled={submitting} onClick={() => void saveSpecEdit()}>
                Antworten speichern
              </button>
              <button className="secondary-button" disabled={submitting} onClick={() => resetSpecEdit()}>
                Fenster schließen
              </button>
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}
