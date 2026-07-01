import { buildProductionHandoffState } from "./production-handoff-state.js";
import type { ProductionHandoffState } from "./production-handoff-panel.js";
import { buildProductionObjectProgressState } from "./production-object-progress-state.js";
import { buildProductionObjectsState } from "./production-objects-state.js";
import type {
  ProductionObjectsState,
  ProductionPlanProgressState
} from "./production-objects-panel.js";
import { buildProductionPurchaseListState } from "./production-purchase-list-state.js";
import type { ProductionPurchaseListState } from "./production-purchase-list-panel.js";
import { buildProductionQuestionPanelState } from "./production-question-panel-state.js";
import type { ProductionQuestionPanelState } from "./production-question-panel.js";
import { buildProductionRecipePanelState } from "./production-recipe-panel-state.js";
import { buildProductionRouteVisibleArtifacts } from "./production-route-visible-artifacts.js";
import type {
  ProductionRecipeLibraryState,
  ProductionRecipeStatusState,
  ProductionRecipeUploadState
} from "./production-recipe-library-panel.js";
import type {
  ProductionWorkbenchNextStep,
  ProductionWorkbenchSummary
} from "./production-workbench.js";
import { buildProductionWorkbenchSummaryState } from "./production-workbench-summary-state.js";

type ClarificationStatusCounts = {
  answered: number;
  unanswered: number;
};

export type ProductionRouteViewState = {
  workbenchSummary: ProductionWorkbenchSummary;
  workbenchNextStep: ProductionWorkbenchNextStep;
  questionState: ProductionQuestionPanelState;
  objectPanelProgress: ProductionPlanProgressState;
  objectPanelState: ProductionObjectsState;
  purchaseListState: ProductionPurchaseListState;
  handoffState: ProductionHandoffState;
  recipeStatus: ProductionRecipeStatusState;
  recipeUpload: ProductionRecipeUploadState;
  recipeLibrary: ProductionRecipeLibraryState;
};

export type ProductionRouteViewStateInput = {
  activeProductionContextLabel: string;
  activeProductionTechnicalContextLabel?: string;
  focusedSpecReadinessLabel: string;
  productionPlanStatusLabel: string;
  purchaseZoneStatusLabel: string;
  productionQuestions: string[];
  clarificationStatusCounts: ClarificationStatusCounts;
  currentSpecPlans: Array<Record<string, unknown>>;
  productionObjectStatusLabel: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  productionNextStep: ProductionWorkbenchNextStep;
  focusedProductionSpec?: Record<string, unknown>;
  selectedPlan?: Record<string, unknown>;
  selectedPlanReadinessLabel?: string;
  productionAssumptions: string[];
  productionConversationProjection: ProductionQuestionPanelState["productionConversationProjection"];
  workbenchSpecFacts: ProductionQuestionPanelState["workbenchSpecFacts"];
  intakeRequestDetailError?: string;
  intakeRequestDetail: ProductionQuestionPanelState["intakeRequestDetail"];
  filteredSpecs: Array<Record<string, unknown>>;
  documentPhase: ProductionQuestionPanelState["documentPhase"];
  productionWorkspaceCleared: boolean;
  planPhase: ProductionPlanProgressState["planPhase"];
  planningSpecLabel?: string;
  planProgress: number;
  planEtaSeconds?: number;
  selectedPlanSpec?: Record<string, unknown>;
  selectedPlanComponentsById: Map<string, Record<string, unknown>>;
  archivedPlans: Array<Record<string, unknown>>;
  specById: Map<string, Record<string, unknown>>;
  archivedPurchaseLists: Array<Record<string, unknown>>;
  productionIntakeOriginLabel: string;
  productionAuditTrailLabel: string;
  productionHandoffExportLabel: string;
  productionHandoffContextLabel?: string;
  recipeReviewStatusLabel: string;
  recipeUsageStatusLabel: string;
  recipeReviewCounts: ProductionRecipeStatusState["recipeReviewCounts"];
  recipeCount: number;
  recipeName: string;
  recipeFile: File | null;
  filteredRecipes: Array<Record<string, unknown>>;
};

export function buildProductionRouteViewState({
  activeProductionContextLabel,
  activeProductionTechnicalContextLabel,
  focusedSpecReadinessLabel,
  productionPlanStatusLabel,
  purchaseZoneStatusLabel,
  productionQuestions,
  clarificationStatusCounts,
  currentSpecPlans,
  productionObjectStatusLabel,
  currentSpecPurchaseLists,
  productionNextStep,
  focusedProductionSpec,
  selectedPlan,
  selectedPlanReadinessLabel,
  productionAssumptions,
  productionConversationProjection,
  workbenchSpecFacts,
  intakeRequestDetailError,
  intakeRequestDetail,
  filteredSpecs,
  documentPhase,
  productionWorkspaceCleared,
  planPhase,
  planningSpecLabel,
  planProgress,
  planEtaSeconds,
  selectedPlanSpec,
  selectedPlanComponentsById,
  archivedPlans,
  specById,
  archivedPurchaseLists,
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
  filteredRecipes
}: ProductionRouteViewStateInput): ProductionRouteViewState {
  const visibleArtifacts = buildProductionRouteVisibleArtifacts({
    productionWorkspaceCleared,
    currentSpecPlans,
    currentSpecPurchaseLists,
    selectedPlan,
    selectedPlanSpec,
    selectedPlanComponentsById,
    archivedPlans,
    archivedPurchaseLists
  });

  return {
    workbenchSummary: buildProductionWorkbenchSummaryState({
      activeProductionContextLabel,
      activeProductionTechnicalContextLabel,
      productionIntakeOriginLabel,
      workbenchSpecFacts,
      focusedSpecReadinessLabel,
      productionPlanStatusLabel,
      purchaseZoneStatusLabel,
      productionQuestions,
      clarificationStatusCounts,
      currentSpecPlans: visibleArtifacts.currentSpecPlans,
      selectedPlan: visibleArtifacts.selectedPlan,
      productionAssumptions,
      productionHandoffExportLabel,
      productionObjectStatusLabel,
      currentSpecPurchaseLists: visibleArtifacts.currentSpecPurchaseLists
    }),
    workbenchNextStep: productionNextStep,
    questionState: buildProductionQuestionPanelState({
      focusedProductionSpec,
      focusedSpecReadinessLabel,
      selectedPlan: visibleArtifacts.selectedPlan,
      selectedPlanReadinessLabel,
      currentSpecPurchaseLists: visibleArtifacts.currentSpecPurchaseLists,
      productionQuestions,
      productionAssumptions,
      productionConversationProjection,
      workbenchSpecFacts,
      intakeRequestDetailError,
      intakeRequestDetail,
      filteredSpecs,
      documentPhase,
      productionWorkspaceCleared
    }),
    objectPanelProgress: buildProductionObjectProgressState({
      planPhase,
      planningSpecLabel,
      planProgress,
      planEtaSeconds
    }),
    objectPanelState: buildProductionObjectsState({
      focusedProductionSpec,
      productionWorkspaceCleared,
      currentSpecPlans: visibleArtifacts.currentSpecPlans,
      selectedPlan: visibleArtifacts.selectedPlan,
      selectedPlanSpec: visibleArtifacts.selectedPlanSpec,
      selectedPlanComponentsById: visibleArtifacts.selectedPlanComponentsById,
      archivedPlans: visibleArtifacts.archivedPlans,
      specById
    }),
    purchaseListState: buildProductionPurchaseListState({
      currentSpecPurchaseLists: visibleArtifacts.currentSpecPurchaseLists,
      archivedPurchaseLists: visibleArtifacts.archivedPurchaseLists,
      specById,
      purchaseZoneStatusLabel
    }),
    handoffState: buildProductionHandoffState({
      productionIntakeOriginLabel,
      productionAuditTrailLabel,
      productionHandoffExportLabel,
      productionHandoffContextLabel
    }),
    ...buildProductionRecipePanelState({
      recipeReviewStatusLabel,
      recipeUsageStatusLabel,
      recipeReviewCounts,
      recipeCount,
      recipeName,
      recipeFile,
      filteredRecipes
    })
  };
}
