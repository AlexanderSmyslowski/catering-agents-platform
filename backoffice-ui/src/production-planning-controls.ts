import {
  buildProductionPlanSubmissionAction,
  type ProductionPlanSubmissionServices
} from "./production-plan-submission-action.js";
import {
  buildProductionSpecEditPersistAction,
  isHandoffDraftContext,
  assertCurrentProductionDraftContext,
  type ProductionDraftEditContext,
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
  ProductionDraftPreparationSuccessActions,
  ProductionSpecPlanningPreflightActions
} from "./production-plan-result-state.js";

export type ProductionPlanningControlsInput =
  ProductionSpecEditPersistActionInput &
  ProductionSpecFocusActionsInput &
  ProductionPlanSubmissionServices &
  Omit<ProductionSpecPlanningPreflightActions, "persistCurrentSpecEdit"> &
  ProductionPlanStartActions &
  ProductionDraftPreparationSuccessActions &
  ProductionPlanFailureActions &
  Pick<ProductionSpecSaveActionInput, "setSubmitting" | "clearMessages" | "setError"> & {
    setProductionWorkspaceCleared: (cleared: boolean) => void;
    editingSpecId?: string;
    activeProductionCaseId?: string;
    activeProductionCaseSpecId?: string;
    setActiveProductionCaseId: (caseId: string) => void;
    setActiveProductionCaseSpecId: (specId: string) => void;
  };

export type ProductionPlanningControls = ProductionSpecFocusActions & {
  persistCurrentSpecEdit: (options?: { quiet?: boolean }) => Promise<Record<string, unknown> | undefined>;
  handleCreatePlan: (
    spec: Record<string, unknown>,
    options?: { sourceReviewConfirmed?: boolean }
  ) => Promise<void>;
  handleSaveSpecEdit: () => Promise<void>;
};

export function buildProductionPlanningControls(
  input: ProductionPlanningControlsInput
): ProductionPlanningControls {
  let contextForPreparation = input.productionDraftContext;
  let savedPredecessor: ProductionDraftEditContext | undefined;
  const canonicalDraftForPreparation = isHandoffDraftContext(contextForPreparation)
    ? () => {
      assertCurrentProductionDraftContext(contextForPreparation!, input.getCurrentProductionDraftContext, savedPredecessor);
      return contextForPreparation!.draft;
    }
    : undefined;
  const persistCurrentSpecEdit = buildProductionSpecEditPersistAction({
    productionDraftContext: input.productionDraftContext,
    getCurrentProductionDraftContext: input.getCurrentProductionDraftContext,
    reviseProductionDraft: input.reviseProductionDraft,
    onDraftRevised: (draft) => {
      // React may still display this exact source until the saved revision renders.
      // Only our own save can authorize that temporary predecessor, never a different case or revision.
      savedPredecessor = input.productionDraftContext;
      contextForPreparation = { caseId: input.productionDraftContext!.caseId, draft };
      input.onDraftRevised?.(draft);
      input.showProductionDraftReview(draft.draftId);
    },
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
      canonicalDraftForPreparation,
      createProductionCase: input.createProductionCase,
      createProductionDraftFromAcceptedEventSpec: input.createProductionDraftFromAcceptedEventSpec,
      activeProductionCaseId: input.activeProductionCaseId,
      activeProductionCaseSpecId: input.activeProductionCaseSpecId,
      setActiveProductionCaseId: input.setActiveProductionCaseId,
      setActiveProductionCaseSpecId: input.setActiveProductionCaseSpecId,
      prepareProductionDraft: input.prepareProductionDraft,
      editingSpecId: input.editingSpecId,
      setSubmitting: input.setSubmitting,
      setProductionWorkspaceCleared: input.setProductionWorkspaceCleared,
      clearMessages: input.clearMessages,
      persistCurrentSpecEdit,
      startPlanProgress: input.startPlanProgress,
      clearSelectedPlanId: input.clearSelectedPlanId,
      refreshDashboard: input.refreshDashboard,
      completePlanProgress: input.completePlanProgress,
      failPlanProgress: input.failPlanProgress,
      setNotice: input.setNotice,
      setError: input.setError,
      showProductionDraftReview: input.showProductionDraftReview
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
