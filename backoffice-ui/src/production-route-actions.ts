import type { ProductionObjectsActions } from "./production-objects-panel.js";
import type {
  ProductionQuestionEditorActions,
  ProductionQuestionPanelActions
} from "./production-question-panel.js";
import type { ProductionRecipeActions } from "./production-recipe-library-panel.js";

export type ProductionQuestionActionsInput = ProductionQuestionPanelActions;
export type ProductionQuestionEditorActionsInput = ProductionQuestionEditorActions;
export type ProductionObjectsActionsInput = ProductionObjectsActions;
export type ProductionRecipeActionsInput = ProductionRecipeActions;

export function buildProductionQuestionActions(
  actions: ProductionQuestionActionsInput
): ProductionQuestionPanelActions {
  return {
    openSpecForQuestions: actions.openSpecForQuestions,
    refreshAfterDraftDecision: actions.refreshAfterDraftDecision
  };
}

export function buildProductionQuestionEditorActions(
  actions: ProductionQuestionEditorActionsInput
): ProductionQuestionEditorActions {
  return {
    setEditingEventType: actions.setEditingEventType,
    setEditingEventDate: actions.setEditingEventDate,
    setEditingAttendeeCount: actions.setEditingAttendeeCount,
    setEditingServiceForm: actions.setEditingServiceForm,
    setEditingMenuItems: actions.setEditingMenuItems,
    updateEditingComponentState: actions.updateEditingComponentState,
    beginSpecEdit: actions.beginSpecEdit,
    saveSpecEdit: actions.saveSpecEdit,
    createPlan: actions.createPlan,
    resetSpecEdit: actions.resetSpecEdit
  };
}

export function buildProductionObjectsActions(
  actions: ProductionObjectsActionsInput
): ProductionObjectsActions {
  return {
    setSelectedPlanId: actions.setSelectedPlanId
  };
}

export function buildProductionRecipeActions(actions: ProductionRecipeActionsInput): ProductionRecipeActions {
  return {
    setRecipeName: actions.setRecipeName,
    setRecipeFile: actions.setRecipeFile,
    uploadRecipe: actions.uploadRecipe,
    reviewRecipe: actions.reviewRecipe
  };
}
