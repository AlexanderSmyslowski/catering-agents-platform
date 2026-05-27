import type { ProductionSourceInputValues } from "./production-input-panel.js";

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
  canArchiveCurrentIntake
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
    canArchiveCurrentIntake
  };
}
