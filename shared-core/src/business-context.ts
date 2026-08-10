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

export const hostedMultiBusinessReady = false;
