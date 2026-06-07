import { useState } from "react";
import { persistMiniPilotStoredResult, readMiniPilotStoredResult } from "./api.js";

type MiniPilotResultState = {
  rawResult: string;
  updatedAt?: string;
  loadedFromStorage: boolean;
};

function formatUpdatedAt(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export function useMiniPilotResultState() {
  const [state, setState] = useState<MiniPilotResultState>(() => {
    const stored = readMiniPilotStoredResult();
    return {
      rawResult: stored.rawResult,
      updatedAt: stored.updatedAt,
      loadedFromStorage: Boolean(stored.rawResult.trim())
    };
  });

  function setMiniPilotRawResult(value: string) {
    const persisted = persistMiniPilotStoredResult(value);
    setState({
      rawResult: persisted.rawResult,
      updatedAt: persisted.updatedAt,
      loadedFromStorage: false
    });
  }

  const updatedAtLabel = formatUpdatedAt(state.updatedAt);
  const miniPilotStorageHintLabel =
    state.rawResult.trim().length === 0
      ? undefined
      : state.loadedFromStorage
      ? updatedAtLabel
        ? `Lokaler Stand übernommen · zuletzt aktualisiert ${updatedAtLabel}`
        : "Lokaler Stand übernommen"
      : updatedAtLabel
      ? `Lokal gespeichert · zuletzt aktualisiert ${updatedAtLabel}`
      : "Lokal gespeichert";

  return {
    miniPilotRawResult: state.rawResult,
    setMiniPilotRawResult,
    miniPilotStorageHintLabel
  };
}
