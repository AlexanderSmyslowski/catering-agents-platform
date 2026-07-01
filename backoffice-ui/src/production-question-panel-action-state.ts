export type ProductionQuestionPanelActionStateInput = {
  focusedProductionSpec?: Record<string, unknown>;
  editingSpecId?: string;
  submitting: boolean;
  hasFocusedSpecEditChanges: boolean;
  openQuestionCount?: number;
  sourceReviewRequired?: boolean;
  sourceReviewConfirmed?: boolean;
};

export type ProductionQuestionPanelActionState = {
  focusedSpecId?: string;
  isFocusedSpecEditing: boolean;
  editAnswersDisabled: boolean;
  showSaveAnswersButton: boolean;
  saveAnswersDisabled: boolean;
  primaryActionLabel: string;
  primaryActionDisabled: boolean;
  sourceReviewHelperText?: string;
};

export function buildProductionQuestionPanelActionState({
  focusedProductionSpec,
  editingSpecId,
  submitting,
  hasFocusedSpecEditChanges,
  openQuestionCount = 0,
  sourceReviewRequired = false,
  sourceReviewConfirmed = false
}: ProductionQuestionPanelActionStateInput): ProductionQuestionPanelActionState {
  const focusedSpecId =
    focusedProductionSpec && focusedProductionSpec.specId != null
      ? String(focusedProductionSpec.specId)
      : undefined;
  const isFocusedSpecEditing = focusedSpecId !== undefined && editingSpecId === focusedSpecId;
  const hasOpenQuestions = openQuestionCount > 0;
  const blocksForOpenQuestions =
    hasOpenQuestions && (!isFocusedSpecEditing || !hasFocusedSpecEditChanges);
  const blocksForSourceReview = sourceReviewRequired && !sourceReviewConfirmed;
  const sourceReviewHelperText = blocksForSourceReview
    ? "Quellenprüfung bestätigen, bevor Mengen, Rezepte und Einkaufsliste berechnet werden."
    : undefined;
  const openQuestionHelperText = blocksForOpenQuestions
    ? "Rückfragen beantworten, bevor Mengen, Rezepte und Einkaufsliste berechnet werden."
    : undefined;

  return {
    focusedSpecId,
    isFocusedSpecEditing,
    editAnswersDisabled: submitting || isFocusedSpecEditing,
    showSaveAnswersButton: isFocusedSpecEditing,
    saveAnswersDisabled: submitting || !hasFocusedSpecEditChanges,
    primaryActionLabel: isFocusedSpecEditing ? "Speichern und Berechnung starten" : "Berechnung starten",
    primaryActionDisabled: submitting || blocksForSourceReview || blocksForOpenQuestions,
    sourceReviewHelperText: [sourceReviewHelperText, openQuestionHelperText].filter(Boolean).join(" ")
      || undefined
  };
}
