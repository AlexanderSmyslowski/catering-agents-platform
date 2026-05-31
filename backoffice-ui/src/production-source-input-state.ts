import type {
  ProductionSourceInputActions,
  ProductionSourceInputValues
} from "./production-input-panel.js";

export type ProductionSourceInputStateInput = {
  dragActive: boolean;
  intakeFile: File | null;
  intakeChannel: ProductionSourceInputValues["intakeChannel"];
  documentPhase: ProductionSourceInputValues["documentPhase"];
  activeDocumentName?: string;
  documentProgress: number;
  documentEtaSeconds?: number;
  intakeText: string;
  canClearWorkspace: boolean;
  canArchiveCurrentIntake: boolean;
  clearWorkspaceContextLabel?: string;
  archiveCurrentIntakeContextLabel?: string;
};

export function buildProductionSourceInputState({
  dragActive,
  intakeFile,
  intakeChannel,
  documentPhase,
  activeDocumentName,
  documentProgress,
  documentEtaSeconds,
  intakeText,
  canClearWorkspace,
  canArchiveCurrentIntake,
  clearWorkspaceContextLabel,
  archiveCurrentIntakeContextLabel
}: ProductionSourceInputStateInput): ProductionSourceInputValues {
  return {
    dragActive,
    intakeFile,
    intakeChannel,
    documentPhase,
    activeDocumentName,
    documentProgress,
    documentEtaSeconds,
    intakeText,
    canClearWorkspace,
    canArchiveCurrentIntake,
    clearWorkspaceContextLabel,
    archiveCurrentIntakeContextLabel
  };
}

export type ProductionSourceInputActionsInput = ProductionSourceInputActions;

export function buildProductionSourceInputActions(
  actions: ProductionSourceInputActionsInput
): ProductionSourceInputActions {
  return {
    uploadInputRef: actions.uploadInputRef,
    setDragActive: actions.setDragActive,
    setIntakeChannel: actions.setIntakeChannel,
    setIntakeText: actions.setIntakeText,
    openFilePicker: actions.openFilePicker,
    clearWorkspace: actions.clearWorkspace,
    archiveCurrentIntake: actions.archiveCurrentIntake,
    handleDrop: actions.handleDrop,
    handleFileSelection: actions.handleFileSelection,
    submitDocument: actions.submitDocument,
    submitText: actions.submitText
  };
}
