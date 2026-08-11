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
  createProductionCase: (input?: Record<string, never>) => Promise<{ case: { caseId: string } }>;
  createProductionDraftFromAcceptedEventSpec: (
    caseId: string,
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
    setActiveProductionCaseId: (caseId: string) => void;
    setActiveProductionCaseSpecId: (specId: string) => void;
  };

export type ProductionPlanSubmissionActionInput =
  ProductionPlanSubmissionServices &
  ProductionPlanSubmissionCallbacks & {
    editingSpecId?: string;
    activeProductionCaseId?: string;
    activeProductionCaseSpecId?: string;
  };

export function buildProductionPlanSubmissionAction({
  createProductionCase,
  createProductionDraftFromAcceptedEventSpec,
  activeProductionCaseId,
  activeProductionCaseSpecId,
  setActiveProductionCaseId,
  setActiveProductionCaseSpecId,
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
      const sourceSpecId = String(specForPlanning.specId ?? "").trim();
      const canReuseActiveCase = Boolean(
        activeProductionCaseId &&
        sourceSpecId &&
        activeProductionCaseSpecId === sourceSpecId
      );
      const caseId = canReuseActiveCase
        ? activeProductionCaseId!
        : (await createProductionCase({})).case.caseId;
      if (!canReuseActiveCase) {
        setActiveProductionCaseId(caseId);
        setActiveProductionCaseSpecId(sourceSpecId);
      }
      const imported = await createProductionDraftFromAcceptedEventSpec(caseId, specForPlanning);
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
