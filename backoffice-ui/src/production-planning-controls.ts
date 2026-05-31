import {
  buildProductionPlanSubmissionAction,
  type ProductionPlanSubmissionServices
} from "./production-plan-submission-action.js";
import {
  buildProductionSpecEditPersistAction,
  type ProductionSpecEditPersistActionInput
} from "./production-spec-edit-persist-action.js";
import {
  buildProductionSpecFocusActions,
  type ProductionSpecFocusActions,
  type ProductionSpecFocusActionsInput
} from "./production-spec-focus-actions.js";
import {
  buildProductionSpecSaveAction,
  type ProductionSpecSaveActionInput
} from "./production-spec-save-action.js";
import type {
  ProductionPlanFailureActions,
  ProductionPlanStartActions,
  ProductionPlanSuccessActions,
  ProductionSpecPlanningPreflightActions
} from "./production-plan-result-state.js";

export type ProductionPlanningControlsInput =
  ProductionSpecEditPersistActionInput &
  ProductionSpecFocusActionsInput &
  ProductionPlanSubmissionServices &
  Omit<ProductionSpecPlanningPreflightActions, "persistCurrentSpecEdit"> &
  ProductionPlanStartActions &
  ProductionPlanSuccessActions &
  ProductionPlanFailureActions &
  Pick<ProductionSpecSaveActionInput, "setSubmitting" | "clearMessages" | "setError"> & {
    setProductionWorkspaceCleared: (cleared: boolean) => void;
    editingSpecId?: string;
  };

export type ProductionPlanningControls = ProductionSpecFocusActions & {
  persistCurrentSpecEdit: (options?: { quiet?: boolean }) => Promise<Record<string, unknown> | undefined>;
  handleCreatePlan: (spec: Record<string, unknown>) => Promise<void>;
  handleSaveSpecEdit: () => Promise<void>;
};

export function buildProductionPlanningControls(
  input: ProductionPlanningControlsInput
): ProductionPlanningControls {
  const persistCurrentSpecEdit = buildProductionSpecEditPersistAction({
    editingSpecId: input.editingSpecId,
    updateAcceptedSpec: input.updateAcceptedSpec,
    buildCurrentSpecUpdateInput: input.buildCurrentSpecUpdateInput,
    setProductionWorkspaceCleared: input.setProductionWorkspaceCleared,
    setFocusedProductionSpecId: input.setFocusedProductionSpecId,
    resetSpecEdit: input.resetSpecEdit,
    refreshDashboard: input.refreshDashboard,
    setNotice: input.setNotice
  });

  const focusActions = buildProductionSpecFocusActions({
    loadSpecIntoEditorState: input.loadSpecIntoEditorState,
    setProductionWorkspaceCleared: input.setProductionWorkspaceCleared,
    setFocusedProductionSpecId: input.setFocusedProductionSpecId
  });

  return {
    ...focusActions,
    persistCurrentSpecEdit,
    handleCreatePlan: buildProductionPlanSubmissionAction({
      createProductionPlan: input.createProductionPlan,
      editingSpecId: input.editingSpecId,
      setSubmitting: input.setSubmitting,
      setProductionWorkspaceCleared: input.setProductionWorkspaceCleared,
      clearMessages: input.clearMessages,
      persistCurrentSpecEdit,
      startPlanProgress: input.startPlanProgress,
      clearSelectedPlanId: input.clearSelectedPlanId,
      setSelectedPlanId: input.setSelectedPlanId,
      refreshDashboard: input.refreshDashboard,
      completePlanProgress: input.completePlanProgress,
      failPlanProgress: input.failPlanProgress,
      setNotice: input.setNotice,
      setError: input.setError
    }),
    handleSaveSpecEdit: buildProductionSpecSaveAction({
      editingSpecId: input.editingSpecId,
      persistCurrentSpecEdit,
      setSubmitting: input.setSubmitting,
      clearMessages: input.clearMessages,
      setError: input.setError
    })
  };
}
