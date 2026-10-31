import { useContext } from "react";
import { ProductionSplitCapability } from "./production-capabilities.js";
import { productionDraftEntryId } from "./production-entry-focus.js";
import { ProductionDietaryQuestionActions } from "./production-dietary-question-actions.js";
import type { ProductionDraft } from "./api.js";
import { useEffect, useState } from "react";
import type { ProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";
import type { ProductionSourceDetail } from "./api.js";
import { ProductionIntakeOriginCard } from "./production-intake-origin-card.js";
import { hasUnsafeIntakeSource } from "./production-intake-origin-card-state.js";
import { getSpecLabel } from "./production-language.js";
import { ProductionSpecDetailsCard } from "./production-spec-details.js";
import { ProductionQuestionThread } from "./production-question-thread.js";
import { buildProductionSpecSwitchItems } from "./production-spec-switch-list-state.js";
import { buildProductionQuestionPanelActionState } from "./production-question-panel-action-state.js";
import { buildProductionQuestionPanelVisibilityState } from "./production-question-panel-visibility-state.js";
import { ProductionClarificationDraftPanel } from "./production-clarification-draft-panel.js";
import type { WorkbenchSpecFact } from "./production-question-thread.js";
import { ProductionStructuredAnswerEditor } from "./production-structured-answer-editor.js";
import type { ComponentEditState } from "./production-answer-types.js";

export { formatDocumentIngestionSummary } from "./production-intake-origin-card-state.js";

export type ProductionQuestionEditorState = {
  canEditPurchasedQuantities?: boolean;
  answersEditable?: boolean;
  canResetStaleEditor?: boolean;
  editingSpecId?: string;
  editingEventType: string;
  editingEventDate: string;
  editingEventSchedule?: string;
  editingSpecialDietResponse?: string;
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
  setEditingEventSchedule?: (value: string) => void;
  setEditingSpecialDietResponse?: (value: string) => void;
  setEditingAttendeeCount: (value: string) => void;
  setEditingServiceForm: (value: string) => void;
  setEditingMenuItems: (value: string) => void;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
  beginSpecEdit: (spec: Record<string, unknown>) => void;
  saveSpecEdit: () => Promise<void>;
  createPlan: (spec: Record<string, unknown>, options?: { sourceReviewConfirmed?: boolean }) => Promise<void>;
  resetSpecEdit: (markDismissed?: boolean) => void;
};

export type ProductionQuestionPanelState = {
  currentDraft?: ProductionDraft;
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
  intakeRequestDetail: ProductionSourceDetail | null;
  filteredSpecs: Array<Record<string, unknown>>;
  documentPhase: "idle" | "analysing" | "done";
  productionWorkspaceCleared: boolean;
};

export type ProductionQuestionPanelActions = {
  openSpecForQuestions: (specId: string) => void;
  refreshAfterDraftDecision?: (appliedSpecId?: string) => Promise<void>;
};

export type ProductionQuestionPanelProps = {
  activeCaseId?: string;
  questionState: ProductionQuestionPanelState;
  questionActions: ProductionQuestionPanelActions;
  submitting: boolean;
  editorState: ProductionQuestionEditorState;
  editorActions: ProductionQuestionEditorActions;
};

export function ProductionQuestionPanel({
  activeCaseId,
  questionState,
  questionActions,
  submitting,
  editorState,
  editorActions
}: ProductionQuestionPanelProps) {
  const splitEnabled = useContext(ProductionSplitCapability);
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
  const { openSpecForQuestions, refreshAfterDraftDecision } = questionActions;
  const {
    canEditPurchasedQuantities = false,
    answersEditable = true,
    canResetStaleEditor = false,
    editingSpecId,
    editingEventType,
    editingEventDate,
    editingEventSchedule,
    editingSpecialDietResponse,
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
    setEditingEventSchedule,
    setEditingSpecialDietResponse,
    setEditingAttendeeCount,
    setEditingServiceForm,
    setEditingMenuItems,
    updateEditingComponentState,
    beginSpecEdit,
    saveSpecEdit,
    createPlan,
    resetSpecEdit
  } = editorActions;
  const [sourceReviewConfirmed, setSourceReviewConfirmed] = useState(false);
  const focusedSpecId = focusedProductionSpec && focusedProductionSpec.specId != null
    ? String(focusedProductionSpec.specId)
    : "";
  const specSwitchItems = buildProductionSpecSwitchItems(filteredSpecs, {
    readinessLabelsBySpecId: focusedSpecId ? { [focusedSpecId]: focusedSpecReadinessLabel } : undefined
  });
  const sourceReviewRequired = hasUnsafeIntakeSource(intakeRequestDetail);
  const hasExistingPlan = Boolean(focusedSpecId && String(selectedPlan?.eventSpecId ?? "").trim() === focusedSpecId);
  const actionState = buildProductionQuestionPanelActionState({
    focusedProductionSpec,
    editingSpecId,
    submitting,
    hasFocusedSpecEditChanges,
    openQuestionCount: productionQuestions.length,
    hasExistingPlan,
    sourceReviewRequired,
    sourceReviewConfirmed
  });
  const visibilityState = buildProductionQuestionPanelVisibilityState({
    documentPhase,
    productionWorkspaceCleared,
    specSwitchItemCount: specSwitchItems.length,
    editingSpecId,
    focusedProductionSpecId: String(focusedProductionSpec?.specId ?? "")
  });
  const requestId = intakeRequestDetail?.requestId ?? "";

  useEffect(() => {
    setSourceReviewConfirmed(false);
  }, [focusedSpecId, requestId]);

  const hasDietaryReview = Boolean(questionState.currentDraft?.draftArtifacts?.productionPlan &&
    questionState.currentDraft.draftArtifacts.purchaseList && questionState.currentDraft.dietaryQuestionReviews?.length);

  const allDietaryAnswered = hasDietaryReview && productionQuestions.length === 0 &&
    questionState.currentDraft!.dietaryQuestionReviews!.every(review => review.status === "confirmed");

  const questionCountLabel =
    productionQuestions.length === 1 ? "1 Rückfrage beantworten" : `${productionQuestions.length} Rückfragen beantworten`;

  return (
    <article tabIndex={-1} id="production-question-panel" className="panel form-panel question-panel production-step-card">
      <header>
        <h3>{!answersEditable ? "Produktionsstand prüfen" : productionQuestions.length > 0 ? questionCountLabel : "Erkannte Angaben prüfen"}</h3>
        <p className="helper-text">
          {canResetStaleEditor
            ? "Eine neue Prüffassung ist verfügbar. Schließe das bisherige Antwortfenster, um sie zu bearbeiten."
            : !answersEditable
            ? "Der bestehende Produktionsstand bleibt erhalten und kann hier nicht geändert werden. Änderungen sind nur in einer offenen Prüffassung möglich. Offene fachliche Prüfungen und Rückfragen sind weiterhin zu klären."
            : hasDietaryReview
            ? allDietaryAnswered
              ? "Alle Ernährungsfragen sind beantwortet. Prüfe als Nächstes die übrigen Prüfpunkte im Entwurf; Freigabe und Übernahme bleiben eigene Schritte."
              : "Beantworte die Rückfragen einzeln und prüfe den vorbereiteten Produktionsstand. Die interne Freigabe und die Übernahme bleiben eigene Schritte."
            : hasExistingPlan
            ? "Ein Produktionsplan ist bereits gespeichert. Offene Rückfragen vor einer Neuberechnung klären; der bisherige Stand bleibt erhalten."
            : "Beantworte offene Punkte und prüfe die erkannten Komponenten. Erst danach entstehen belastbare Mengen, Rezepte und Einkaufslisten."}
        </p>
      </header>
      {canResetStaleEditor ? (
        <div className="form-panel">
          <p>Die Prüffassung hat sich geändert. Die bisher geöffneten, ungespeicherten Antworten können nicht übernommen werden.</p>
          <button className="secondary-button" disabled={submitting} onClick={() => resetSpecEdit()}>Antwortfenster schließen und ungespeicherte Antworten verwerfen</button>
        </div>
      ) : null}
      {focusedProductionSpec ? (
        <>
          {answersEditable && !hasDietaryReview ? <div className="question-action-panel" aria-label="Nächste Aktion für Rückfragen">
            <div>
              <strong>{productionQuestions.length > 0 ? questionCountLabel : "Keine offenen Rückfragen"}</strong>
              <p className="helper-text">
                {productionQuestions.length > 0
                  ? hasExistingPlan
                    ? "Öffne die Antwortfelder und ergänze fehlende Angaben vor einer Neuberechnung."
                    : "Öffne die Antwortfelder, ergänze fehlende Angaben und starte danach die Berechnung."
                  : "Prüfe Herstellungsart, Rezeptbezug und Quelle; die Berechnung bleibt eine bewusste Aktion."}
              </p>
            </div>
            <div className="action-row">
              <button
                className="secondary-button"
                disabled={actionState.editAnswersDisabled}
                onClick={() => beginSpecEdit(focusedProductionSpec)}
              >
                {productionQuestions.length > 0 ? "Rückfragen beantworten" : "Angaben prüfen"}
              </button>
              {actionState.showSaveAnswersButton ? (
                <button
                  className="secondary-button"
                  disabled={actionState.saveAnswersDisabled}
                  onClick={() => void saveSpecEdit()}
                >
                  Antworten speichern
                </button>
              ) : null}
              <button
                disabled={actionState.primaryActionDisabled}
                onClick={() => void createPlan(focusedProductionSpec, { sourceReviewConfirmed })}
              >
                {actionState.primaryActionLabel}
              </button>
            </div>
          </div> : null}
          {answersEditable && allDietaryAnswered && questionState.currentDraft?.draftId ? <button type="button" className="secondary-button" onClick={() => {
            const entry = document.getElementById(productionDraftEntryId(questionState.currentDraft!.draftId));
            for (let parent = entry?.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
            entry?.focus({ preventScroll: true });
            entry?.scrollIntoView?.({ block: "start", inline: "nearest", behavior: "auto" });
          }}>Zu den Prüfpunkten</button> : null}
          {answersEditable && hasDietaryReview ? <div className="production-question-guidance">
            <button className="secondary-button" disabled={submitting || actionState.editAnswersDisabled} onClick={() => beginSpecEdit(focusedProductionSpec)}>Angaben oder Kennzeichnung ändern</button>
          </div> : null}
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
              renderQuestionActions={activeCaseId && questionState.currentDraft ? question => <ProductionDietaryQuestionActions
                caseId={activeCaseId} draft={questionState.currentDraft!} question={question} busy={submitting}
                onChanged={refreshAfterDraftDecision} /> : undefined}
              answerEditor={
                answersEditable && actionState.isFocusedSpecEditing ? (
                  <ProductionStructuredAnswerEditor
                    canEditPurchasedQuantities={canEditPurchasedQuantities}
                    canSplitComponents={Boolean(splitEnabled && canEditPurchasedQuantities && questionState.currentDraft && !questionState.currentDraft.draftArtifacts?.productionPlan && !questionState.currentDraft.draftArtifacts?.purchaseList && !questionState.currentDraft.draftArtifacts?.recipes)}
                    focusedProductionSpec={focusedProductionSpec}
                    editingEventType={editingEventType}
                    editingEventDate={editingEventDate}
                    editingEventSchedule={editingEventSchedule ?? ""}
                    editingSpecialDietResponse={editingSpecialDietResponse}
                    editingAttendeeCount={editingAttendeeCount}
                    editingServiceForm={editingServiceForm}
                    editingMenuItems={editingMenuItems}
                    editingComponentStates={editingComponentStates}
                    recipes={recipes}
                    setEditingEventType={setEditingEventType}
                    setEditingEventDate={setEditingEventDate}
                    setEditingEventSchedule={setEditingEventSchedule}
                    setEditingSpecialDietResponse={canEditPurchasedQuantities ? setEditingSpecialDietResponse : undefined}
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
            <ProductionSpecDetailsCard spec={focusedProductionSpec} readinessLabel={focusedSpecReadinessLabel} />
            {intakeRequestDetailError ? (
              <p className="helper-text" role="status">
                {intakeRequestDetailError}
              </p>
            ) : null}
            {intakeRequestDetail ? <ProductionIntakeOriginCard intakeRequestDetail={intakeRequestDetail} /> : null}
            {answersEditable && sourceReviewRequired ? (
              <label className="component-answer-card">
                <input
                  type="checkbox"
                  checked={sourceReviewConfirmed}
                  disabled={submitting}
                  onChange={(event) => setSourceReviewConfirmed(event.target.checked)}
                />
                Quelle und erkannte Daten geprüft
              </label>
            ) : null}
            {answersEditable ? <ProductionClarificationDraftPanel
              specId={String(focusedProductionSpec.specId ?? "")}
              submitting={submitting}
              onDraftChanged={refreshAfterDraftDecision}
            /> : null}
          </div>
          {answersEditable && !hasDietaryReview && actionState.sourceReviewHelperText ? (
            <p className="helper-text" role="status">
              {actionState.sourceReviewHelperText}
            </p>
          ) : null}
        </>
      ) : (
        <p className="helper-text">{visibilityState.emptyStateMessage}</p>
      )}
      {visibilityState.showSpecSwitch ? (
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
      {answersEditable && visibilityState.showDetachedEditor ? (
        <>
          <div className="divider" />
          <div className="form-panel">
            <header>
              <p className="eyebrow">Antwortfenster</p>
              <h3>{editingSpecId}</h3>
            </header>
            <label className="field-block">
              <span>Veranstaltungstyp</span>
              <input
                value={editingEventType}
                onChange={(event) => setEditingEventType(event.target.value)}
                placeholder="Veranstaltungstyp, z. B. Konferenz"
              />
            </label>
            <label className="field-block">
              <span>Veranstaltungsdatum</span>
              <small>Format: JJJJ-MM-TT, zum Beispiel 2026-11-13.</small>
              <input
                value={editingEventDate}
                onChange={(event) => setEditingEventDate(event.target.value)}
                placeholder="Datum, z. B. 2026-06-18"
              />
            </label>
            <label className="field-block">
              <span>Gäste</span>
              <input
                value={editingAttendeeCount}
                inputMode="numeric"
                onChange={(event) => setEditingAttendeeCount(event.target.value)}
                placeholder="Anzahl der Gäste"
              />
            </label>
            <label className="field-block">
              <span>Serviceform</span>
              <input
                value={editingServiceForm}
                onChange={(event) => setEditingServiceForm(event.target.value)}
                placeholder="Serviceform, z. B. Buffet"
              />
            </label>
            <label className="field-block">
              <span>Menüpunkte</span>
              <textarea
                value={editingMenuItems}
                onChange={(event) => setEditingMenuItems(event.target.value)}
                placeholder="Menüpunkte, durch Komma getrennt"
              />
            </label>
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
