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
import { ProductionPurchaseListPanel } from "./production-purchase-list-panel.js";
import { ProductionQuestionPanel } from "./production-question-panel.js";
import type {
  ProductionQuestionEditorActions,
  ProductionQuestionEditorState
} from "./production-question-panel.js";
import { ProductionRecipeLibraryPanel } from "./production-recipe-library-panel.js";
import { ProductionConversationalWorkbench } from "./production-workbench.js";

type RecipeReviewCounts = {
  approved: number;
  reviewRequired: number;
  rejected: number;
};

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
  specById: Map<string, Record<string, unknown>>;
  archivedPurchaseLists: Array<Record<string, unknown>>;
  purchaseZoneStatusLabel: string;
  productionIntakeOriginLabel: string;
  productionAuditTrailLabel: string;
  productionHandoffExportLabel: string;
  productionHandoffContextLabel?: string;
  recipeReviewStatusLabel: string;
  recipeUsageStatusLabel: string;
  recipeReviewCounts: RecipeReviewCounts;
  recipeCount: number;
  recipeName: string;
  recipeFile: File | null;
  filteredRecipes: Array<Record<string, unknown>>;
  setRecipeName: (value: string) => void;
  setRecipeFile: (file: File | null) => void;
  handleRecipeUpload: (target: "offer" | "production") => Promise<void>;
  handleRecipeReview: (
    target: "offer" | "production",
    recipeId: string,
    decision: "approve" | "verify" | "reject"
  ) => Promise<void>;
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
  specById,
  archivedPurchaseLists,
  purchaseZoneStatusLabel,
  productionIntakeOriginLabel,
  productionAuditTrailLabel,
  productionHandoffExportLabel,
  productionHandoffContextLabel,
  recipeReviewStatusLabel,
  recipeUsageStatusLabel,
  recipeReviewCounts,
  recipeCount,
  recipeName,
  recipeFile,
  filteredRecipes,
  setRecipeName,
  setRecipeFile,
  handleRecipeUpload,
  handleRecipeReview
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
        <ProductionPurchaseListPanel
          currentPurchaseLists={currentSpecPurchaseLists}
          archivedPurchaseLists={archivedPurchaseLists}
          specById={specById}
          statusLabel={purchaseZoneStatusLabel}
        />
      </div>
      <div className="production-column">
        <ProductionHandoffPanel
          intakeOriginLabel={productionIntakeOriginLabel}
          auditTrailLabel={productionAuditTrailLabel}
          exportLabel={productionHandoffExportLabel}
          contextLabel={productionHandoffContextLabel}
        />

        <ProductionRecipeLibraryPanel
          recipeReviewStatusLabel={recipeReviewStatusLabel}
          recipeUsageStatusLabel={recipeUsageStatusLabel}
          recipeReviewCounts={recipeReviewCounts}
          recipeCount={recipeCount}
          recipeName={recipeName}
          recipeFile={recipeFile}
          filteredRecipes={filteredRecipes}
          submitting={submitting}
          setRecipeName={setRecipeName}
          setRecipeFile={setRecipeFile}
          uploadRecipe={handleRecipeUpload}
          reviewRecipe={handleRecipeReview}
        />
      </div>
    </ProductionConversationalWorkbench>
  );
}
