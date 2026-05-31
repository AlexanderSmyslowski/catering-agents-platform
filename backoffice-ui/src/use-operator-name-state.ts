import { useState } from "react";
import { persistOperatorName, readOperatorName } from "./api.js";

export function useOperatorNameState() {
  const [operatorName, setOperatorName] = useState(() => readOperatorName());

  function handleOperatorNameChange(value: string) {
    const persisted = persistOperatorName(value);
    setOperatorName(persisted);
  }

  return {
    operatorName,
    handleOperatorNameChange
  };
}
