import {
  buildProductionObjectsActions,
  buildProductionQuestionActions,
  buildProductionQuestionEditorActions,
  buildProductionRecipeActions,
  type ProductionObjectsActionsInput,
  type ProductionQuestionActionsInput,
  type ProductionQuestionEditorActionsInput,
  type ProductionRecipeActionsInput
} from "./production-route-actions.js";
import {
  buildProductionRouteMainLayoutState,
  type ProductionRouteMainLayoutStateInput
} from "./production-route-main-layout-state.js";
import type { ProductionRouteMainLayoutProps } from "./production-route-main-layout.js";

export type AppProductionRouteStateInput =
  Omit<
    ProductionRouteMainLayoutStateInput,
    "questionActions" | "editorActions" | "objectPanelActions" | "recipeActions"
  > &
  ProductionQuestionActionsInput &
  ProductionQuestionEditorActionsInput &
  ProductionObjectsActionsInput &
  ProductionRecipeActionsInput;

export type AppProductionRouteState = {
  productionQuestionActions: ReturnType<typeof buildProductionQuestionActions>;
  productionQuestionEditorActions: ReturnType<typeof buildProductionQuestionEditorActions>;
  productionObjectsActions: ReturnType<typeof buildProductionObjectsActions>;
  productionRecipeActions: ReturnType<typeof buildProductionRecipeActions>;
  productionRouteMainLayoutState: ProductionRouteMainLayoutProps;
};

export function buildAppProductionRouteState(
  input: AppProductionRouteStateInput
): AppProductionRouteState {
  const productionQuestionActions = buildProductionQuestionActions({
    openSpecForQuestions: input.openSpecForQuestions
  });
  const productionQuestionEditorActions = buildProductionQuestionEditorActions({
    setEditingEventType: input.setEditingEventType,
    setEditingEventDate: input.setEditingEventDate,
    setEditingAttendeeCount: input.setEditingAttendeeCount,
    setEditingServiceForm: input.setEditingServiceForm,
    setEditingMenuItems: input.setEditingMenuItems,
    updateEditingComponentState: input.updateEditingComponentState,
    beginSpecEdit: input.beginSpecEdit,
    saveSpecEdit: input.saveSpecEdit,
    createPlan: input.createPlan,
    resetSpecEdit: input.resetSpecEdit
  });
  const productionObjectsActions = buildProductionObjectsActions({
    setSelectedPlanId: input.setSelectedPlanId
  });
  const productionRecipeActions = buildProductionRecipeActions({
    setRecipeName: input.setRecipeName,
    setRecipeFile: input.setRecipeFile,
    uploadRecipe: input.uploadRecipe,
    reviewRecipe: input.reviewRecipe
  });

  return {
    productionQuestionActions,
    productionQuestionEditorActions,
    productionObjectsActions,
    productionRecipeActions,
    productionRouteMainLayoutState: buildProductionRouteMainLayoutState({
      viewState: input.viewState,
      submitting: input.submitting,
      sourceInput: input.sourceInput,
      sourceInputActions: input.sourceInputActions,
      manualInput: input.manualInput,
      manualInputActions: input.manualInputActions,
      questionActions: productionQuestionActions,
      editorState: input.editorState,
      editorActions: productionQuestionEditorActions,
      objectPanelActions: productionObjectsActions,
      recipeActions: productionRecipeActions
    })
  };
}
