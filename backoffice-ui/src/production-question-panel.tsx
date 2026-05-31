import type { ProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";
import type { IntakeRequestDetail } from "./api.js";
import { ProductionIntakeOriginCard } from "./production-intake-origin-card.js";
import { getSpecLabel } from "./production-language.js";
import { ProductionSpecDetailsCard } from "./production-spec-details.js";
import { ProductionQuestionThread } from "./production-question-thread.js";
import { buildProductionSpecSwitchItems } from "./production-spec-switch-list-state.js";
import type { WorkbenchSpecFact } from "./production-question-thread.js";
import { ProductionStructuredAnswerEditor } from "./production-structured-answer-editor.js";
import type { ComponentEditState } from "./production-answer-types.js";

export { formatDocumentIngestionSummary } from "./production-intake-origin-card.js";

export type ProductionQuestionEditorState = {
  editingSpecId?: string;
  editingEventType: string;
  editingEventDate: string;
  editingAttendeeCount: string;
  editingServiceForm: string;
  editingMenuItems: string;
  editingComponentStates: Record<string, ComponentEditState>;
  hasFocusedSpecEditChanges: boolean;
  recipes: Array<Record<string, unknown>>;
};

export type ProductionQuestionEditorActions = {
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
};

export type ProductionQuestionPanelState = {
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
  filteredSpecs: Array<Record<string, unknown>>;
  documentPhase: "idle" | "analysing" | "done";
  productionWorkspaceCleared: boolean;
};

export type ProductionQuestionPanelActions = {
  openSpecForQuestions: (specId: string) => void;
};

type ProductionQuestionPanelProps = {
  questionState: ProductionQuestionPanelState;
  questionActions: ProductionQuestionPanelActions;
  submitting: boolean;
  editorState: ProductionQuestionEditorState;
  editorActions: ProductionQuestionEditorActions;
};

export function ProductionQuestionPanel({
  questionState,
  questionActions,
  submitting,
  editorState,
  editorActions
}: ProductionQuestionPanelProps) {
  const {
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
    filteredSpecs,
    documentPhase,
    productionWorkspaceCleared
  } = questionState;
  const { openSpecForQuestions } = questionActions;
  const {
    editingSpecId,
    editingEventType,
    editingEventDate,
    editingAttendeeCount,
    editingServiceForm,
    editingMenuItems,
    editingComponentStates,
    hasFocusedSpecEditChanges,
    recipes
  } = editorState;
  const {
    setEditingEventType,
    setEditingEventDate,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    updateEditingComponentState,
    beginSpecEdit,
    saveSpecEdit,
    createPlan,
    resetSpecEdit
  } = editorActions;
  const specSwitchItems = buildProductionSpecSwitchItems(filteredSpecs);

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
            <ProductionQuestionThread
              specLabel={getSpecLabel(focusedProductionSpec)}
              facts={workbenchSpecFacts}
              questionCount={productionQuestions.length}
              readinessLabel={focusedSpecReadinessLabel}
              selectedPlan={selectedPlan}
              selectedPlanReadinessLabel={selectedPlanReadinessLabel}
              currentSpecPurchaseLists={currentSpecPurchaseLists}
              productionConversationProjection={productionConversationProjection}
              answerEditor={
                editingSpecId === String(focusedProductionSpec.specId) ? (
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
                ) : null
              }
            />
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
      {!productionWorkspaceCleared && specSwitchItems.length > 1 ? (
        <>
          <div className="divider" />
          <header>
            <p className="eyebrow">Erkannte Eingänge</p>
            <h3>Zwischen mehreren Vorgängen wechseln</h3>
          </header>
          <ul className="item-list compact">
            {specSwitchItems.slice(0, 6).map((item) => (
              <li key={item.specId}>
                <strong>{item.label}</strong>
                <p className="helper-text">{item.readinessLabel}</p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={submitting}
                    aria-label={item.openActionLabel}
                    title={item.openActionLabel}
                    onClick={() => openSpecForQuestions(item.specId)}
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
