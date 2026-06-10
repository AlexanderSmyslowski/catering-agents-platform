import type { IntakeDocumentChannel } from "./api.js";
import { startProductionDocumentUpload } from "./production-document-upload-start.js";
import {
  getProductionWindowDropFile,
  shouldActivateProductionWindowDrag,
  shouldClearProductionWindowDrag
} from "./production-window-drag-state.js";

type ProductionWindowFileActionsInput = {
  setDragActive: (active: boolean) => void;
  setIntakeFile: (file: File | null) => void;
  resetDocumentProgress?: () => void;
  clearMessages?: () => void;
  setError?: (message: string) => void;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => void | Promise<void>;
};

export type ProductionWindowFileActions = {
  handleWindowDragOver: (event: globalThis.DragEvent) => void;
  handleWindowDrop: (event: globalThis.DragEvent) => void;
  handleWindowDragLeave: (event: globalThis.DragEvent) => void;
};

export function buildProductionWindowFileActions({
  setDragActive,
  setIntakeFile,
  resetDocumentProgress,
  clearMessages,
  setError,
  processIncomingProductionFile
}: ProductionWindowFileActionsInput): ProductionWindowFileActions {
  const uploadActions = {
    setDragActive,
    setIntakeFile,
    resetDocumentProgress,
    clearMessages,
    setError,
    processIncomingProductionFile
  };

  return {
    handleWindowDragOver: (event) => {
      if (!shouldActivateProductionWindowDrag(event)) {
        return;
      }
      event.preventDefault();
      setDragActive(true);
    },
    handleWindowDrop: (event) => {
      const file = getProductionWindowDropFile(event);
      if (!file) {
        return;
      }
      event.preventDefault();
      startProductionDocumentUpload(file, uploadActions);
    },
    handleWindowDragLeave: (event) => {
      if (shouldClearProductionWindowDrag(event)) {
        setDragActive(false);
      }
    }
  };
}
