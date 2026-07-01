import {
  buildProductionSourceInputActions,
  buildProductionSourceInputState,
  type ProductionSourceInputActionsInput,
  type ProductionSourceInputStateInput
} from "./production-source-input-state.js";
import type {
  ProductionSourceInputActions,
  ProductionSourceInputValues
} from "./production-input-panel.js";

export type ProductionSourceInputBundleInput =
  ProductionSourceInputStateInput &
  ProductionSourceInputActionsInput;

export type ProductionSourceInputBundle = {
  productionSourceInput: ProductionSourceInputValues;
  productionSourceInputActions: ProductionSourceInputActions;
};

export function buildProductionSourceInputBundle(
  input: ProductionSourceInputBundleInput
): ProductionSourceInputBundle {
  return {
    productionSourceInput: buildProductionSourceInputState({
      dragActive: input.dragActive,
      intakeFile: input.intakeFile,
      intakeChannel: input.intakeChannel,
      documentPhase: input.documentPhase,
      activeDocumentName: input.activeDocumentName,
      documentProgress: input.documentProgress,
      documentEtaSeconds: input.documentEtaSeconds,
      uploadResultSpec: input.uploadResultSpec,
      intakeText: input.intakeText,
      canClearWorkspace: input.canClearWorkspace,
      canArchiveCurrentIntake: input.canArchiveCurrentIntake,
      clearWorkspaceContextLabel: input.clearWorkspaceContextLabel,
      archiveCurrentIntakeContextLabel: input.archiveCurrentIntakeContextLabel
    }),
    productionSourceInputActions: buildProductionSourceInputActions({
      uploadInputRef: input.uploadInputRef,
      setDragActive: input.setDragActive,
      setIntakeChannel: input.setIntakeChannel,
      setIntakeText: input.setIntakeText,
      openFilePicker: input.openFilePicker,
      clearWorkspace: input.clearWorkspace,
      archiveCurrentIntake: input.archiveCurrentIntake,
      handleDrop: input.handleDrop,
      handleFileSelection: input.handleFileSelection,
      submitDocument: input.submitDocument,
      submitText: input.submitText
    })
  };
}
