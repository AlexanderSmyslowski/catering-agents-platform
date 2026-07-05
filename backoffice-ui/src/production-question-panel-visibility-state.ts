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
          ? "Der aktuelle Vorgang wurde geleert. Nach einem neuen Upload erscheint hier die Prüfung."
          : "Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheint hier die Prüfung vor der Berechnung.",
    showSpecSwitch: !input.productionWorkspaceCleared && input.specSwitchItemCount > 1,
    showDetachedEditor: Boolean(input.editingSpecId) && input.editingSpecId !== input.focusedProductionSpecId
  };
}
