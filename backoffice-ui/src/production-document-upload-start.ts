import type { IntakeDocumentChannel } from "./api.js";
import { channelForFile } from "./production-document-channel.js";
import {
  isProductionDocumentUploadAllowed,
  productionDocumentUploadLimitErrorMessage
} from "./production-document-upload-limit.js";

export type ProductionDocumentUploadStartActions = {
  setDragActive: (active: boolean) => void;
  setIntakeFile: (file: File | null) => void;
  resetDocumentProgress?: () => void;
  clearMessages?: () => void;
  setError?: (message: string) => void;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => void | Promise<void>;
};

export function startProductionDocumentUpload(
  file: File,
  actions: ProductionDocumentUploadStartActions
) {
  if (!isProductionDocumentUploadAllowed(file)) {
    actions.setDragActive(false);
    actions.setIntakeFile(null);
    actions.resetDocumentProgress?.();
    actions.clearMessages?.();
    actions.setError?.(productionDocumentUploadLimitErrorMessage());
    return;
  }

  actions.setDragActive(false);
  actions.setIntakeFile(file);
  void actions.processIncomingProductionFile(file, channelForFile(file));
}
