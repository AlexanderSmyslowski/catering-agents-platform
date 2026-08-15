export type BusinessId = string;

export interface BusinessContext {
  businessId: BusinessId;
}

const BUSINESS_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export function assertBusinessId(value: string): BusinessId {
  if (!BUSINESS_ID_PATTERN.test(value)) {
    throw new Error("Ungültige Betriebskennung.");
  }

  return value;
}

// The route/store isolation matrix is covered by the Stage A contract suite;
// hosted startup is code-gated and never controlled by an environment flag.
export const hostedMultiBusinessReady = true;
