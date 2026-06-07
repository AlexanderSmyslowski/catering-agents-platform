import { useState } from "react";
import { persistMiniPilotRawResult, readMiniPilotRawResult } from "./api.js";

export function useMiniPilotResultState() {
  const [miniPilotRawResult, setMiniPilotRawResultState] = useState(() => readMiniPilotRawResult());

  function setMiniPilotRawResult(value: string) {
    const persisted = persistMiniPilotRawResult(value);
    setMiniPilotRawResultState(persisted);
  }

  return {
    miniPilotRawResult,
    setMiniPilotRawResult
  };
}
