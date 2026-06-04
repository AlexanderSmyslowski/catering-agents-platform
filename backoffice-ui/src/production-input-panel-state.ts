import type { ProductionSourceInputValues } from "./production-input-panel.js";

export type ProductionInputPanelState = {
  clearWorkspaceDisabled: boolean;
  archiveCurrentIntakeDisabled: boolean;
  submitDocumentDisabled: boolean;
  selectedFileName?: string;
  showAnalysingProgress: boolean;
  showCompletedProgress: boolean;
  documentEtaLabel: string;
};

function formatEta(seconds: number): string {
  if (seconds <= 1) {
    return "weniger als 1 Sekunde";
  }
  return `${seconds} Sekunden`;
}

export function buildProductionInputPanelState(input: {
  submitting: boolean;
  sourceInput: ProductionSourceInputValues;
}): ProductionInputPanelState {
  return {
    clearWorkspaceDisabled: input.submitting || !input.sourceInput.canClearWorkspace,
    archiveCurrentIntakeDisabled: input.submitting || !input.sourceInput.canArchiveCurrentIntake,
    submitDocumentDisabled: input.submitting || !input.sourceInput.intakeFile,
    selectedFileName: input.sourceInput.intakeFile?.name,
    showAnalysingProgress:
      input.sourceInput.documentPhase === "analysing" && Boolean(input.sourceInput.activeDocumentName),
    showCompletedProgress:
      input.sourceInput.documentPhase === "done" && Boolean(input.sourceInput.activeDocumentName),
    documentEtaLabel: formatEta(input.sourceInput.documentEtaSeconds ?? 1)
  };
}
