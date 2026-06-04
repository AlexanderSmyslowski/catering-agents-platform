export type ProductionQuestionPanelVisibilityState = {
  emptyStateMessage: string;
  showSpecSwitch: boolean;
  showDetachedEditor: boolean;
};

export function buildProductionQuestionPanelVisibilityState(input: {
  documentPhase: "idle" | "analysing" | "done";
  productionWorkspaceCleared: boolean;
  specSwitchItemCount: number;
  editingSpecId?: string;
  focusedProductionSpecId?: string;
}): ProductionQuestionPanelVisibilityState {
  return {
    emptyStateMessage:
      input.documentPhase === "analysing"
        ? "Der Agent wertet das hochgeladene Dokument gerade aus und erzeugt daraus operative Veranstaltungsdaten."
        : input.productionWorkspaceCleared
          ? "Der aktuelle Vorgang wurde geleert. Nach einem neuen Upload erscheinen hier wieder die Rückfragen des Agenten."
          : "Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheinen hier die Rückfragen des Agenten.",
    showSpecSwitch: !input.productionWorkspaceCleared && input.specSwitchItemCount > 1,
    showDetachedEditor: Boolean(input.editingSpecId) && input.editingSpecId !== input.focusedProductionSpecId
  };
}
