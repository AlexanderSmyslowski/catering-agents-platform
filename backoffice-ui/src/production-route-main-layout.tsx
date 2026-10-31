import type { LastAppliedProductionSnapshot, ProductionDraft } from "./api.js";
import { ProductionClarificationContinuation } from "./production-clarification-continuation.js";
import type { MiniPilotCheckReportState } from "./mini-pilot-check-report-state.js";
import { shouldShowMiniPilotPanel } from "./mini-pilot-panel-gate.js";
import { buildProductionMiniPilotActionState } from "./production-mini-pilot-action-state.js";
import { ProductionQuantityWorkflowPanel } from "./production-quantity-workflow-panel.js";
import { ProductionPlanningEvidencePanel } from "./production-planning-evidence-panel.js";
import {
  ProductionHandoffPanel,
  type ProductionHandoffState
} from "./production-handoff-panel.js";
import {
  ProductionInputPanel,
  type ProductionManualInputActions,
  type ProductionManualInputValues,
  type ProductionSourceInputActions,
  type ProductionSourceInputValues
} from "./production-input-panel.js";
import {
  ProductionObjectsPanel,
  type ProductionObjectsActions,
  type ProductionObjectsState,
  type ProductionPlanProgressState
} from "./production-objects-panel.js";
import {
  ProductionPurchaseListPanel,
  type ProductionPurchaseListState
} from "./production-purchase-list-panel.js";
import { ProductionQuestionPanel } from "./production-question-panel.js";
import type {
  ProductionQuestionPanelActions,
  ProductionQuestionPanelState,
  ProductionQuestionEditorActions,
  ProductionQuestionEditorState
} from "./production-question-panel.js";
import {
  ProductionRecipeLibraryPanel,
  type ProductionRecipeActions,
  type ProductionRecipeLibraryState,
  type ProductionRecipeStatusState,
  type ProductionRecipeUploadState
} from "./production-recipe-library-panel.js";
import {
  ProductionConversationalWorkbench,
  type ProductionWorkbenchNextStep,
  type ProductionWorkbenchSummary
} from "./production-workbench.js";

export type ProductionRouteMainLayoutProps = {
  currentDraft?: ProductionDraft;
  currentApplied?: boolean;
  lastApplied?: LastAppliedProductionSnapshot;
  activeProductionCaseId?: string;
  workbenchSummary: ProductionWorkbenchSummary;
  workbenchNextStep: ProductionWorkbenchNextStep;
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
  sourceInputActions: ProductionSourceInputActions;
  manualInput: ProductionManualInputValues;
  manualInputActions: ProductionManualInputActions;
  questionState: ProductionQuestionPanelState;
  questionActions: ProductionQuestionPanelActions;
  editorState: ProductionQuestionEditorState;
  editorActions: ProductionQuestionEditorActions;
  objectPanelProgress: ProductionPlanProgressState;
  objectPanelState: ProductionObjectsState;
  objectPanelActions: ProductionObjectsActions;
  purchaseListState: ProductionPurchaseListState;
  handoffState: ProductionHandoffState;
  recipeStatus: ProductionRecipeStatusState;
  recipeUpload: ProductionRecipeUploadState;
  recipeLibrary: ProductionRecipeLibraryState;
  recipeActions: ProductionRecipeActions;
  miniPilotRawResult: string;
  setMiniPilotRawResult: (value: string) => void;
  miniPilotReportState: MiniPilotCheckReportState;
  miniPilotStorageHintLabel?: string;
};

export function ProductionRouteMainLayout({
  currentDraft, currentApplied, lastApplied,
  activeProductionCaseId,
  workbenchSummary,
  workbenchNextStep,
  submitting,
  sourceInput,
  sourceInputActions,
  manualInput,
  manualInputActions,
  questionState,
  questionActions,
  editorState,
  editorActions,
  objectPanelProgress,
  objectPanelState,
  objectPanelActions,
  purchaseListState,
  handoffState,
  recipeStatus,
  recipeUpload,
  recipeLibrary,
  recipeActions,
  miniPilotRawResult,
  setMiniPilotRawResult,
  miniPilotReportState,
  miniPilotStorageHintLabel
}: ProductionRouteMainLayoutProps) {
  const zeroQuestionContinuation = Boolean(questionState.productionQuestions.length === 0 && currentDraft?.status === "pending_review" &&
    lastApplied && lastApplied.draftId !== currentDraft.draftId && currentDraft.draftArtifacts?.eventSpec &&
    !currentDraft.draftArtifacts.productionPlan && !currentDraft.draftArtifacts.purchaseList);
  const showMiniPilotPanel = shouldShowMiniPilotPanel();
  const miniPilotActionState = showMiniPilotPanel
    ? buildProductionMiniPilotActionState(
        miniPilotReportState,
        miniPilotStorageHintLabel
      )
    : undefined;
  const canClearMiniPilotResult = miniPilotRawResult.trim().length > 0;
  const inputSummarySpec =
    questionState.focusedProductionSpec ?? objectPanelState.selectedPlanSpec;
  const hasActiveProductionContext =
    Boolean(inputSummarySpec) ||
    workbenchSummary.productionObjectCount > 0 ||
    workbenchSummary.purchaseListCount > 0;

  return (
    <ProductionConversationalWorkbench
      summary={{ ...workbenchSummary, hasHistoricalApplied: zeroQuestionContinuation }}
      nextStep={workbenchNextStep}
      miniPilotRawResult={miniPilotRawResult}
      setMiniPilotRawResult={setMiniPilotRawResult}
      miniPilotReportState={miniPilotReportState}
      miniPilotStorageHintLabel={miniPilotStorageHintLabel}
      slots={{
        inputSlot: (
          <div className="production-column production-column--input">
            {questionState.productionQuestions.length === 0 ? <ProductionClarificationContinuation
              caseId={activeProductionCaseId} draft={currentDraft} applied={currentApplied} openQuestionCount={0}
              lastApplied={lastApplied} busy={submitting} onChanged={questionActions.refreshAfterDraftDecision} /> : null}
            {zeroQuestionContinuation ? <details className="progressive-panel">
              <summary>Angaben und Produktionskomponenten bearbeiten</summary>
              <ProductionQuestionPanel continuationEditorOnly activeCaseId={activeProductionCaseId} questionState={questionState} questionActions={questionActions}
                submitting={submitting} editorState={editorState} editorActions={editorActions} />
            </details> : null}
            <ProductionInputPanel
              submitting={submitting}
              activeCaseId={activeProductionCaseId}
              sourceInput={sourceInput}
              sourceInputActions={sourceInputActions}
              manualInput={manualInput}
              manualInputActions={manualInputActions}
              focusedProductionSpec={inputSummarySpec}
              hasActiveProductionContext={hasActiveProductionContext}
              productionQuestions={questionState.productionQuestions}
              productionAssumptions={questionState.productionAssumptions}
              intakeRequestDetail={questionState.intakeRequestDetail}
              onDraftChanged={questionActions.refreshAfterDraftDecision}
              hidePrepareAction={zeroQuestionContinuation}
            />
          </div>
        ),
        planningSlot: (
          <ProductionPlanningEvidencePanel caseId={activeProductionCaseId}
            submitting={submitting} onChanged={questionActions.refreshAfterDraftDecision} />
        ),
        questionsSlot: (
          <div className="production-column production-column--questions">
            {questionState.productionQuestions.length > 0 ? <ProductionClarificationContinuation
              caseId={activeProductionCaseId} draft={currentDraft} applied={currentApplied}
              openQuestionCount={questionState.productionQuestions.length} lastApplied={lastApplied} busy={submitting}
              onChanged={questionActions.refreshAfterDraftDecision} /> : null}
            {!zeroQuestionContinuation ? <ProductionQuestionPanel
              activeCaseId={activeProductionCaseId}
              questionState={questionState}
              questionActions={questionActions}
              submitting={submitting}
              editorState={editorState}
              editorActions={editorActions}
            /> : null}
          </div>
        ),
        productionObjectsSlot: (
          <div className="production-column production-column--objects"
            tabIndex={-1} role="region" aria-label="Produktionsplan und Unterlagen">
            <ProductionObjectsPanel
              progressState={objectPanelProgress}
              objectsState={objectPanelState}
              objectsActions={objectPanelActions}
              purchaseStatusLabel={purchaseListState.statusLabel}
              submitting={submitting}
              miniPilotActionState={miniPilotActionState}
              clearMiniPilotResult={showMiniPilotPanel && canClearMiniPilotResult ? () => setMiniPilotRawResult("") : undefined}
            />
          </div>
        ),
        purchaseListSlot: (
          <div className="production-column production-column--purchase">
            <ProductionQuantityWorkflowPanel caseId={activeProductionCaseId} />
            <ProductionPurchaseListPanel purchaseListState={purchaseListState} />
          </div>
        ),
        lowerSlots: (
          <div className="production-column production-column--handoff">
            <ProductionHandoffPanel handoffState={handoffState} />

            <ProductionRecipeLibraryPanel
              statusState={recipeStatus}
              uploadState={recipeUpload}
              libraryState={recipeLibrary}
              recipeActions={recipeActions}
              submitting={submitting}
            />
          </div>
        )
      }}
    />
  );
}
