import { getSpecLabel } from "./production-language.js";
import {
  completeProductionStateAfterDraftPreparation,
  prepareProductionSpecForPlanning,
  resetProductionStateAfterPlanFailure,
  startProductionPlanRunState,
  type ProductionPlanFailureActions,
  type ProductionPlanStartActions,
  type ProductionDraftPreparationSuccessActions,
  type ProductionSpecPlanningPreflightActions
} from "./production-plan-result-state.js";

export type ProductionPlanSubmissionServices = {
  createProductionDraftFromAcceptedEventSpec: (
    spec: Record<string, unknown>
  ) => Promise<{ draft: { draftId: string } }>;
  prepareProductionDraft: (draftId: string) => Promise<{ draft: { draftId: unknown } }>;
};

export type ProductionPlanSubmissionCallbacks =
  ProductionSpecPlanningPreflightActions &
  ProductionPlanStartActions &
  ProductionDraftPreparationSuccessActions &
  ProductionPlanFailureActions & {
    setSubmitting: (submitting: boolean) => void;
    setProductionWorkspaceCleared: (cleared: boolean) => void;
    clearMessages: () => void;
  };

export type ProductionPlanSubmissionActionInput =
  ProductionPlanSubmissionServices &
  ProductionPlanSubmissionCallbacks & {
    editingSpecId?: string;
  };

export function buildProductionPlanSubmissionAction({
  createProductionDraftFromAcceptedEventSpec,
  prepareProductionDraft,
  editingSpecId,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  persistCurrentSpecEdit,
  startPlanProgress,
  clearSelectedPlanId,
  refreshDashboard,
  completePlanProgress,
  failPlanProgress,
  setNotice,
  setError,
  showProductionDraftReview
}: ProductionPlanSubmissionActionInput) {
  return async function handleCreatePlan(
    spec: Record<string, unknown>,
    _options?: { sourceReviewConfirmed?: boolean }
  ) {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const specForPlanning = await prepareProductionSpecForPlanning(spec, editingSpecId, {
        persistCurrentSpecEdit,
        setNotice
      });

      const specLabel = getSpecLabel(specForPlanning);
      startProductionPlanRunState(specForPlanning, specLabel, {
        startPlanProgress,
        clearSelectedPlanId,
        setNotice
      });
      const imported = await createProductionDraftFromAcceptedEventSpec(specForPlanning);
      const prepared = await prepareProductionDraft(imported.draft.draftId);
      await completeProductionStateAfterDraftPreparation(prepared, {
        refreshDashboard,
        completePlanProgress,
        setNotice,
        showProductionDraftReview
      });
    } catch (submitError) {
      resetProductionStateAfterPlanFailure(submitError, {
        failPlanProgress,
        setError
      });
    } finally {
      setSubmitting(false);
    }
  };
}
