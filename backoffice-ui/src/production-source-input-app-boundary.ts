import type { IntakeDocumentChannel } from "./api.js";
import {
  buildProductionSourceFileUploadActions
} from "./production-source-file-actions.js";
import {
  buildProductionSourceInputBundle,
  type ProductionSourceInputBundle,
  type ProductionSourceInputBundleInput
} from "./production-source-input-bundle.js";

export type ProductionSourceInputAppBoundaryInput =
  Omit<ProductionSourceInputBundleInput, "openFilePicker" | "handleDrop" | "handleFileSelection"> & {
    setIntakeFile: (file: File) => void;
    processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => void | Promise<void>;
  };

export function buildProductionSourceInputAppBoundary(
  input: ProductionSourceInputAppBoundaryInput
): ProductionSourceInputBundle {
  const {
    openProductionFilePicker,
    handleProductionDrop,
    handleProductionFileSelection
  } = buildProductionSourceFileUploadActions({
    uploadInputRef: input.uploadInputRef,
    setDragActive: input.setDragActive,
    setIntakeFile: input.setIntakeFile,
    processIncomingProductionFile: input.processIncomingProductionFile
  });

  return buildProductionSourceInputBundle({
    ...input,
    openFilePicker: openProductionFilePicker,
    handleDrop: handleProductionDrop,
    handleFileSelection: handleProductionFileSelection
  });
}
