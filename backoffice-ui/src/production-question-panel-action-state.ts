export type ProductionQuestionPanelActionStateInput = {
  focusedProductionSpec?: Record<string, unknown>;
  editingSpecId?: string;
  questionCount: number;
  submitting: boolean;
  hasFocusedSpecEditChanges: boolean;
};

export type ProductionQuestionPanelActionState = {
  focusedSpecId?: string;
  isFocusedSpecEditing: boolean;
  editAnswersDisabled: boolean;
  showSaveAnswersButton: boolean;
  saveAnswersDisabled: boolean;
  primaryActionLabel: string;
  primaryActionDisabled: boolean;
  primaryActionHint?: string;
};

export function buildProductionQuestionPanelActionState({
  focusedProductionSpec,
  editingSpecId,
  questionCount,
  submitting,
  hasFocusedSpecEditChanges
}: ProductionQuestionPanelActionStateInput): ProductionQuestionPanelActionState {
  const focusedSpecId =
    focusedProductionSpec && focusedProductionSpec.specId != null
      ? String(focusedProductionSpec.specId)
      : undefined;
  const isFocusedSpecEditing = focusedSpecId !== undefined && editingSpecId === focusedSpecId;
  const hasOpenQuestions = questionCount > 0;
  const blockCalculationForQuestions = hasOpenQuestions && !isFocusedSpecEditing;
  const primaryActionHint = blockCalculationForQuestions
    ? "Bitte offene Rückfragen beantworten, bevor die Berechnung gestartet wird."
    : undefined;

  return {
    focusedSpecId,
    isFocusedSpecEditing,
    editAnswersDisabled: submitting || isFocusedSpecEditing,
    showSaveAnswersButton: isFocusedSpecEditing,
    saveAnswersDisabled: submitting || !hasFocusedSpecEditChanges,
    primaryActionLabel: blockCalculationForQuestions
      ? "Rückfragen zuerst beantworten"
      : isFocusedSpecEditing
        ? "Speichern und Berechnung starten"
        : "Berechnung starten",
    primaryActionDisabled: submitting || blockCalculationForQuestions,
    ...(primaryActionHint ? { primaryActionHint } : {})
  };
}
