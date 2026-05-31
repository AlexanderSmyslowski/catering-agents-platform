import type { ProductionQuestionPanelState } from "./production-question-panel.js";

export type ProductionQuestionPanelStateInput = {
  focusedProductionSpec?: Record<string, unknown>;
  focusedSpecReadinessLabel: string;
  selectedPlan?: Record<string, unknown>;
  selectedPlanReadinessLabel?: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  productionQuestions: string[];
  productionAssumptions: string[];
  productionConversationProjection: ProductionQuestionPanelState["productionConversationProjection"];
  workbenchSpecFacts: ProductionQuestionPanelState["workbenchSpecFacts"];
  intakeRequestDetailError?: string;
  intakeRequestDetail: ProductionQuestionPanelState["intakeRequestDetail"];
  filteredSpecs: Array<Record<string, unknown>>;
  documentPhase: ProductionQuestionPanelState["documentPhase"];
  productionWorkspaceCleared: boolean;
};

export function buildProductionQuestionPanelState({
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
}: ProductionQuestionPanelStateInput): ProductionQuestionPanelState {
  const safeIntakeRequestDetail = productionWorkspaceCleared ? null : intakeRequestDetail;
  const safeIntakeRequestDetailError = productionWorkspaceCleared ? undefined : intakeRequestDetailError;
  const safeFilteredSpecs = productionWorkspaceCleared ? [] : filteredSpecs;

  return {
    focusedProductionSpec,
    focusedSpecReadinessLabel,
    selectedPlan,
    selectedPlanReadinessLabel,
    currentSpecPurchaseLists,
    productionQuestions,
    productionAssumptions,
    productionConversationProjection,
    workbenchSpecFacts,
    intakeRequestDetailError: safeIntakeRequestDetailError,
    intakeRequestDetail: safeIntakeRequestDetail,
    filteredSpecs: safeFilteredSpecs,
    documentPhase,
    productionWorkspaceCleared
  };
}
