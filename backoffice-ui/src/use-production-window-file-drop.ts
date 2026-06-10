import { useEffect } from "react";
import type { IntakeDocumentChannel } from "./api.js";
import type { AppRoute } from "./app-shell-state.js";
import { buildProductionWindowFileActions } from "./production-window-file-actions.js";

type UseProductionWindowFileDropInput = {
  route: AppRoute;
  setDragActive: (active: boolean) => void;
  setIntakeFile: (file: File | null) => void;
  resetDocumentProgress?: () => void;
  clearMessages?: () => void;
  setError?: (message: string) => void;
  processIncomingProductionFile: (file: File, channel: IntakeDocumentChannel) => void | Promise<void>;
};

export function useProductionWindowFileDrop({
  route,
  setDragActive,
  setIntakeFile,
  resetDocumentProgress,
  clearMessages,
  setError,
  processIncomingProductionFile
}: UseProductionWindowFileDropInput) {
  useEffect(() => {
    if (route !== "production") {
      return;
    }

    const {
      handleWindowDragOver,
      handleWindowDrop,
      handleWindowDragLeave
    } = buildProductionWindowFileActions({
      setDragActive,
      setIntakeFile,
      resetDocumentProgress,
      clearMessages,
      setError,
      processIncomingProductionFile
    });

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
    };
  }, [clearMessages, processIncomingProductionFile, resetDocumentProgress, route, setDragActive, setError, setIntakeFile]);
}
