import { useEffect, useState } from "react";

export type ProductionDocumentPhase = "idle" | "analysing" | "done";

export function estimateProcessingDurationMs(file: File): number {
  const fileSizeMb = file.size / (1024 * 1024);
  const estimated = 3500 + fileSizeMb * 1800;
  return Math.max(4000, Math.min(18000, Math.round(estimated)));
}

export function useProductionDocumentProgress() {
  const [activeDocumentName, setActiveDocumentName] = useState<string>();
  const [documentPhase, setDocumentPhase] = useState<ProductionDocumentPhase>("idle");
  const [documentProgress, setDocumentProgress] = useState(0);
  const [documentEtaSeconds, setDocumentEtaSeconds] = useState<number | undefined>();
  const [documentEstimatedDurationMs, setDocumentEstimatedDurationMs] = useState(0);
  const [documentStartedAt, setDocumentStartedAt] = useState<number | undefined>();

  useEffect(() => {
    if (documentPhase !== "analysing" || !documentStartedAt || documentEstimatedDurationMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - documentStartedAt;
      const ratio = Math.min(elapsed / documentEstimatedDurationMs, 0.92);
      const remainingMs = Math.max(documentEstimatedDurationMs - elapsed, 500);
      setDocumentProgress(Math.max(8, Math.round(ratio * 100)));
      setDocumentEtaSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
    }, 180);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [documentEstimatedDurationMs, documentPhase, documentStartedAt]);

  function resetDocumentProgress() {
    setActiveDocumentName(undefined);
    setDocumentPhase("idle");
    setDocumentProgress(0);
    setDocumentEtaSeconds(undefined);
    setDocumentEstimatedDurationMs(0);
    setDocumentStartedAt(undefined);
  }

  function startDocumentProgress(file: File) {
    const estimatedDurationMs = estimateProcessingDurationMs(file);
    setActiveDocumentName(file.name);
    setDocumentPhase("analysing");
    setDocumentProgress(8);
    setDocumentEtaSeconds(Math.max(1, Math.ceil(estimatedDurationMs / 1000)));
    setDocumentEstimatedDurationMs(estimatedDurationMs);
    setDocumentStartedAt(Date.now());
  }

  function completeDocumentProgress() {
    setDocumentPhase("done");
    setDocumentProgress(100);
    setDocumentEtaSeconds(0);
  }

  function failDocumentProgress() {
    setDocumentPhase("idle");
    setDocumentProgress(0);
    setDocumentEtaSeconds(undefined);
    setDocumentEstimatedDurationMs(0);
    setDocumentStartedAt(undefined);
  }

  return {
    activeDocumentName,
    documentPhase,
    documentProgress,
    documentEtaSeconds,
    resetDocumentProgress,
    startDocumentProgress,
    completeDocumentProgress,
    failDocumentProgress
  };
}
