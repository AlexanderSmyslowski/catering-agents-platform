export type ProductionQuestionPanelActionStateInput = {
  focusedProductionSpec?: Record<string, unknown>;
  editingSpecId?: string;
  submitting: boolean;
  hasFocusedSpecEditChanges: boolean;
  openQuestionCount?: number;
  hasExistingPlan?: boolean;
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
  /** Reason shown directly beside the disabled primary action. */
  primaryActionReason?: string;
  sourceReviewBlocking: boolean;
};

export function buildProductionQuestionPanelActionState({
  focusedProductionSpec,
  editingSpecId,
  submitting,
  hasFocusedSpecEditChanges,
  openQuestionCount = 0,
  hasExistingPlan = false,
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
    ? hasExistingPlan
      ? "Quellenprüfung bestätigen, bevor dieser Plan neu berechnet wird. Der bisherige Plan bleibt erhalten."
      : "Quellenprüfung bestätigen, bevor Mengen, Rezepte und Einkaufsliste berechnet werden."
    : undefined;
  const openQuestionHelperText = blocksForOpenQuestions
    ? hasExistingPlan
      ? "Rückfragen beantworten, bevor dieser Plan neu berechnet wird. Der bisherige Plan bleibt erhalten."
      : "Rückfragen beantworten, bevor Mengen, Rezepte und Einkaufsliste berechnet werden."
    : undefined;

  // With the answer fields already open, the actionable reason is the missing
  // change in those fields, not "answer the questions" again.
  const openQuestionActionReason = blocksForOpenQuestions && isFocusedSpecEditing
    ? "Ändere zuerst eine Angabe in den geöffneten Antwortfeldern."
    : openQuestionHelperText;
  const primaryActionDisabled = submitting || blocksForSourceReview || blocksForOpenQuestions;

  return {
    focusedSpecId,
    isFocusedSpecEditing,
    editAnswersDisabled: submitting || isFocusedSpecEditing,
    showSaveAnswersButton: isFocusedSpecEditing,
    saveAnswersDisabled: submitting || !hasFocusedSpecEditChanges,
    primaryActionLabel: hasExistingPlan
      ? isFocusedSpecEditing ? "Speichern und neu berechnen" : "Erneut berechnen"
      : isFocusedSpecEditing ? "Speichern und Berechnung starten" : "Berechnung starten",
    primaryActionDisabled,
    sourceReviewHelperText: [sourceReviewHelperText, openQuestionHelperText].filter(Boolean).join(" ")
      || undefined,
    primaryActionReason: primaryActionDisabled
      ? submitting
        ? "Aktion läuft …"
        : [sourceReviewHelperText, openQuestionActionReason].filter(Boolean).join(" ") || undefined
      : undefined,
    sourceReviewBlocking: blocksForSourceReview
  };
}
