import type { IntakeDocumentChannel } from "./api.js";
import { channelForFile } from "./production-document-channel.js";

export type ProductionDocumentUploadStartActions = {
  setDragActive: (active: boolean) => void;
  setIntakeFile: (file: File) => void;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => void | Promise<void>;
};

export function startProductionDocumentUpload(
  file: File,
  actions: ProductionDocumentUploadStartActions
) {
  actions.setDragActive(false);
  actions.setIntakeFile(file);
  void actions.processIncomingProductionFile(file, channelForFile(file));
}
