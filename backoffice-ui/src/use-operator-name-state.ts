import { useCateringSession } from "./session-boundary.js";

/** Compatibility shape for legacy callers; identity is read-only and comes only from the authenticated session. */
export function useOperatorNameState() {
  const cateringSession = useCateringSession();

  return {
    operatorName: cateringSession?.session.user.displayName ?? "",
    handleOperatorNameChange: (_value: string) => undefined
  };
}
