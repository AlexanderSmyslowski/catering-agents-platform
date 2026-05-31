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

function formatClearWorkspaceTitle(input: {
  canClearWorkspace: boolean;
  clearWorkspaceContextLabel?: string;
}): string {
  if (!input.canClearWorkspace) {
    return "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.";
  }

  return input.clearWorkspaceContextLabel
    ? `Lokalen Arbeitsbereich leeren: ${input.clearWorkspaceContextLabel}`
    : "Aktuellen Produktionsarbeitsbereich lokal leeren.";
}

function formatArchiveCurrentIntakeTitle(input: {
  canArchiveCurrentIntake: boolean;
  archiveCurrentIntakeContextLabel?: string;
}): string {
  if (!input.canArchiveCurrentIntake) {
    return "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.";
  }

  return input.archiveCurrentIntakeContextLabel
    ? `Fehlupload per Soft-Archiv aus dem aktiven Fokus nehmen: ${input.archiveCurrentIntakeContextLabel}`
    : "Aktiven Intake-Kontext per Soft-Archiv aus dem Fokus nehmen.";
}

export function formatArchiveCurrentIntakeContextLabel(input: {
  currentIntakeRequestId?: string;
}): string | undefined {
  const requestId = input.currentIntakeRequestId?.trim();

  return requestId ? `Intake-Anfrage ${requestId}` : undefined;
}

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
    archiveCurrentIntakeContextLabel,
    clearWorkspaceTitle: formatClearWorkspaceTitle({
      canClearWorkspace,
      clearWorkspaceContextLabel
    }),
    archiveCurrentIntakeTitle: formatArchiveCurrentIntakeTitle({
      canArchiveCurrentIntake,
      archiveCurrentIntakeContextLabel
    })
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
