export type ProductionQuestionPanelActionStateInput = {
  focusedProductionSpec?: Record<string, unknown>;
  editingSpecId?: string;
  submitting: boolean;
  hasFocusedSpecEditChanges: boolean;
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
  sourceReviewRequired = false,
  sourceReviewConfirmed = false
}: ProductionQuestionPanelActionStateInput): ProductionQuestionPanelActionState {
  const focusedSpecId =
    focusedProductionSpec && focusedProductionSpec.specId != null
      ? String(focusedProductionSpec.specId)
      : undefined;
  const isFocusedSpecEditing = focusedSpecId !== undefined && editingSpecId === focusedSpecId;

  return {
    focusedSpecId,
    isFocusedSpecEditing,
    editAnswersDisabled: submitting || isFocusedSpecEditing,
    showSaveAnswersButton: isFocusedSpecEditing,
    saveAnswersDisabled: submitting || !hasFocusedSpecEditChanges,
    primaryActionLabel: isFocusedSpecEditing ? "Speichern und Berechnung starten" : "Berechnung starten",
    primaryActionDisabled: submitting || (sourceReviewRequired && !sourceReviewConfirmed),
    sourceReviewHelperText:
      sourceReviewRequired && !sourceReviewConfirmed
        ? "Quellenprüfung bestätigen, bevor Mengen, Rezepte und Einkaufsliste berechnet werden."
        : undefined
  };
}
