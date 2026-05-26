import type { ProductionConversationProjection } from "../../shared-core/src/conversation-projection.js";
import type { IntakeRequestDetail } from "./api.js";
import { ProductionHandoffPanel } from "./production-handoff-panel.js";
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
import { ProductionConversationalWorkbench } from "./production-workbench.js";

type WorkbenchSpecFact = {
  label: string;
  value: string;
};

type ProductionRouteMainLayoutProps = {
  activeSpecLabel: string;
  readinessLabel: string;
  planStatusLabel: string;
  purchaseStatusLabel: string;
  nextStepTitle: string;
  nextStepDescription: string;
  questionCount: number;
  answeredQuestionCount: number;
  unansweredQuestionCount: number;
  productionObjectCount: number;
  productionObjectStatusLabel: string;
  purchaseListCount: number;
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
  sourceInputActions: ProductionSourceInputActions;
  manualInput: ProductionManualInputValues;
  manualInputActions: ProductionManualInputActions;
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
  editorState: ProductionQuestionEditorState;
  editorActions: ProductionQuestionEditorActions;
  filteredSpecs: Array<Record<string, unknown>>;
  productionWorkspaceCleared: boolean;
  openSpecForQuestions: (specId: string) => void;
  objectPanelProgress: ProductionPlanProgressState;
  objectPanelState: ProductionObjectsState;
  objectPanelActions: ProductionObjectsActions;
  purchaseListState: ProductionPurchaseListState;
  productionIntakeOriginLabel: string;
  productionAuditTrailLabel: string;
  productionHandoffExportLabel: string;
  productionHandoffContextLabel?: string;
  recipeStatus: ProductionRecipeStatusState;
  recipeUpload: ProductionRecipeUploadState;
  recipeLibrary: ProductionRecipeLibraryState;
  recipeActions: ProductionRecipeActions;
};

export function ProductionRouteMainLayout({
  activeSpecLabel,
  readinessLabel,
  planStatusLabel,
  purchaseStatusLabel,
  nextStepTitle,
  nextStepDescription,
  questionCount,
  answeredQuestionCount,
  unansweredQuestionCount,
  productionObjectCount,
  productionObjectStatusLabel,
  purchaseListCount,
  submitting,
  sourceInput,
  sourceInputActions,
  manualInput,
  manualInputActions,
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
  editorState,
  editorActions,
  filteredSpecs,
  productionWorkspaceCleared,
  openSpecForQuestions,
  objectPanelProgress,
  objectPanelState,
  objectPanelActions,
  purchaseListState,
  productionIntakeOriginLabel,
  productionAuditTrailLabel,
  productionHandoffExportLabel,
  productionHandoffContextLabel,
  recipeStatus,
  recipeUpload,
  recipeLibrary,
  recipeActions
}: ProductionRouteMainLayoutProps) {
  return (
    <ProductionConversationalWorkbench
      activeSpecLabel={activeSpecLabel}
      readinessLabel={readinessLabel}
      planStatusLabel={planStatusLabel}
      purchaseStatusLabel={purchaseStatusLabel}
      nextStepTitle={nextStepTitle}
      nextStepDescription={nextStepDescription}
      questionCount={questionCount}
      answeredQuestionCount={answeredQuestionCount}
      unansweredQuestionCount={unansweredQuestionCount}
      productionObjectCount={productionObjectCount}
      productionObjectStatusLabel={productionObjectStatusLabel}
      purchaseListCount={purchaseListCount}
    >
      <div className="production-column">
        <ProductionInputPanel
          submitting={submitting}
          sourceInput={sourceInput}
          sourceInputActions={sourceInputActions}
          manualInput={manualInput}
          manualInputActions={manualInputActions}
        />
      </div>
      <div className="production-column">
        <ProductionQuestionPanel
          focusedProductionSpec={focusedProductionSpec}
          focusedSpecReadinessLabel={focusedSpecReadinessLabel}
          selectedPlan={selectedPlan}
          selectedPlanReadinessLabel={selectedPlanReadinessLabel}
          currentSpecPurchaseLists={currentSpecPurchaseLists}
          productionQuestions={productionQuestions}
          productionAssumptions={productionAssumptions}
          productionConversationProjection={productionConversationProjection}
          workbenchSpecFacts={workbenchSpecFacts}
          intakeRequestDetailError={intakeRequestDetailError}
          intakeRequestDetail={intakeRequestDetail}
          submitting={submitting}
          editorState={editorState}
          editorActions={editorActions}
          filteredSpecs={filteredSpecs}
          documentPhase={sourceInput.documentPhase}
          productionWorkspaceCleared={productionWorkspaceCleared}
          openSpecForQuestions={openSpecForQuestions}
        />
      </div>
      <div className="production-column">
        <ProductionObjectsPanel
          progressState={objectPanelProgress}
          objectsState={objectPanelState}
          objectsActions={objectPanelActions}
          submitting={submitting}
        />
      </div>
      <div className="production-column">
        <ProductionPurchaseListPanel purchaseListState={purchaseListState} />
      </div>
      <div className="production-column">
        <ProductionHandoffPanel
          intakeOriginLabel={productionIntakeOriginLabel}
          auditTrailLabel={productionAuditTrailLabel}
          exportLabel={productionHandoffExportLabel}
          contextLabel={productionHandoffContextLabel}
        />

        <ProductionRecipeLibraryPanel
          statusState={recipeStatus}
          uploadState={recipeUpload}
          libraryState={recipeLibrary}
          recipeActions={recipeActions}
          submitting={submitting}
        />
      </div>
    </ProductionConversationalWorkbench>
  );
}
