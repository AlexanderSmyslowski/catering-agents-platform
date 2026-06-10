import type {
  ChangeEvent,
  DragEvent
} from "react";
import type { IntakeDocumentChannel } from "./api.js";
import { startProductionDocumentUpload } from "./production-document-upload-start.js";
import {
  getProductionSourceDroppedFile,
  getProductionSourceSelectedFile
} from "./production-source-file-events.js";

type ProductionSourceFileUploadActionsInput = {
  uploadInputRef: { current: HTMLInputElement | null };
  setDragActive: (active: boolean) => void;
  setIntakeFile: (file: File | null) => void;
  resetDocumentProgress?: () => void;
  clearMessages?: () => void;
  setError?: (message: string) => void;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => void | Promise<void>;
};

export type ProductionSourceFileUploadActions = {
  openProductionFilePicker: () => void;
  handleProductionDrop: (event: DragEvent<HTMLLabelElement>) => void;
  handleProductionFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function buildProductionSourceFileUploadActions({
  uploadInputRef,
  setDragActive,
  setIntakeFile,
  resetDocumentProgress,
  clearMessages,
  setError,
  processIncomingProductionFile
}: ProductionSourceFileUploadActionsInput): ProductionSourceFileUploadActions {
  const uploadActions = {
    setDragActive,
    setIntakeFile,
    resetDocumentProgress,
    clearMessages,
    setError,
    processIncomingProductionFile
  };

  return {
    openProductionFilePicker: () => {
      uploadInputRef.current?.click();
    },
    handleProductionDrop: (event) => {
      event.preventDefault();
      const file = getProductionSourceDroppedFile(event);
      if (!file) {
        return;
      }
      startProductionDocumentUpload(file, uploadActions);
    },
    handleProductionFileSelection: (event) => {
      const file = getProductionSourceSelectedFile(event);
      if (!file) {
        return;
      }
      startProductionDocumentUpload(file, uploadActions);
      event.target.value = "";
    }
  };
}
