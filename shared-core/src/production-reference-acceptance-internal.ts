import type {
  ProductionReferenceAsyncPersistenceCapability,
  ProductionReferencePersistedEvidenceReader,
  ProductionReferencePersistenceCapability,
  ProductionReferencePersistedEvidenceSnapshot,
  ProductionReferenceSyncPersistenceCapability,
  ProductionReferenceValidatedEvidence,
  ProductionReferenceValidatedEvidenceInput
} from "./production-reference-acceptance.js";

// These registries are intentionally kept outside the public package surface.
// Only a server boundary that imports this internal module can create a
// capability or issue an evidence token.
const validatedEvidenceTokens = new WeakSet<object>();
const registeredPersistenceCapabilities = new WeakSet<object>();

export function createTrustedProductionReferencePersistenceCapability(
  readPersistedEvidence: (input: ProductionReferenceValidatedEvidenceInput) => ProductionReferencePersistedEvidenceSnapshot | undefined
): ProductionReferenceSyncPersistenceCapability;
export function createTrustedProductionReferencePersistenceCapability(
  readPersistedEvidence: (input: ProductionReferenceValidatedEvidenceInput) => Promise<ProductionReferencePersistedEvidenceSnapshot | undefined>
): ProductionReferenceAsyncPersistenceCapability;
export function createTrustedProductionReferencePersistenceCapability(
  readPersistedEvidence: ProductionReferencePersistedEvidenceReader
): ProductionReferencePersistenceCapability {
  if (typeof readPersistedEvidence !== "function") {
    throw new TypeError("A persisted evidence reader is required.");
  }
  const capability = Object.freeze({ readPersistedEvidence });
  registeredPersistenceCapabilities.add(capability);
  return capability;
}

export function isRegisteredProductionReferencePersistenceCapability(
  value: unknown
): value is ProductionReferencePersistenceCapability {
  return !!value && typeof value === "object" && registeredPersistenceCapabilities.has(value);
}

export function issueTrustedProductionReferenceValidatedEvidence(
  token: ProductionReferenceValidatedEvidence
): ProductionReferenceValidatedEvidence {
  const issued = Object.freeze({ ...token });
  validatedEvidenceTokens.add(issued);
  return issued;
}

export function isTrustedProductionReferenceValidatedEvidence(
  value: unknown
): value is ProductionReferenceValidatedEvidence {
  return !!value && typeof value === "object" && validatedEvidenceTokens.has(value);
}
