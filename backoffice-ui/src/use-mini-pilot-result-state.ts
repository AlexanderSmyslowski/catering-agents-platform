import { useState } from "react";
import { persistMiniPilotStoredResult, readMiniPilotStoredResult } from "./api.js";
import { buildMiniPilotStorageHintState } from "./mini-pilot-storage-hint-state.js";

type MiniPilotResultState = {
  rawResult: string;
  updatedAt?: string;
  loadedFromStorage: boolean;
};

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

  const miniPilotStorageHintState = buildMiniPilotStorageHintState({
    rawResult: state.rawResult,
    loadedFromStorage: state.loadedFromStorage,
    updatedAt: state.updatedAt
  });

  return {
    miniPilotRawResult: state.rawResult,
    setMiniPilotRawResult,
    miniPilotStorageHintLabel: miniPilotStorageHintState.label
  };
}
