import type {
  OfferReviewStatus,
  PricingSummary,
  ProductionPlan,
  PurchaseList,
  Recipe
} from "./types.js";
import { areJsonValuesEqual } from "./json-equality.js";
import {
  isRegisteredProductionReferencePersistenceCapability,
  isTrustedProductionReferenceValidatedEvidence,
  issueTrustedProductionReferenceValidatedEvidence
} from "./production-reference-acceptance-internal.js";

export type ProductionReferenceAcceptanceStatus = "ready" | "blocked" | "not_assessed";
export type ProductionReferenceChecklistStatus = "passed" | "blocked" | "not_assessed";

export type ProductionReferenceChecklistKey =
  | "source_provenance"
  | "offer_pricing"
  | "production_completeness"
  | "purchase_coverage"
  | "recipe_allergen_status"
  | "kitchen_acceptance";

export interface ProductionReferenceSourceEvidence {
  expectedCaseId: string;
  expectedSha256: string;
  observedSha256?: string;
  lineageReferences: readonly string[];
}

export interface ProductionReferenceOfferEvidence {
  offerId: string;
  pricingSummary?: PricingSummary;
  pricingBasis: "module_catalog_estimate" | "full_cost_model";
  approved: boolean;
  reviewStatus?: OfferReviewStatus;
}

export interface ProductionReferenceOperatorAcceptance {
  accepted: boolean;
  acceptedBy?: string;
  acceptedAt?: string;
  rescueChatUsed?: boolean;
}

/**
 * Opaque evidence issued only after persisted approval, handoff and audit
 * records have been cross-checked by a resolver. Caller strings cannot forge
 * this proof because the evaluator checks the private token registry.
 */
export interface ProductionReferenceValidatedEvidenceInput {
  sourceCaseId: string;
  sourceSha256: string;
  sourceLineageId: string;
  eventSpecId: string;
  offerId: string;
  approvalRequestId: string;
  handoffId: string;
  approvalAuditId: string;
  handoffAuditId: string;
  kitchenAcceptanceAuditId: string;
  pricingSummary: PricingSummary;
  pricingBasis: "module_catalog_estimate" | "full_cost_model";
  rescueChatUsed: false;
}

export type ProductionReferenceValidatedEvidence = Readonly<
  ProductionReferenceValidatedEvidenceInput & Pick<ProductionReferencePersistedEvidenceSnapshot, "acceptedBy" | "acceptedAt">
>;

export interface ProductionReferencePersistedEvidenceSnapshot {
  sourceCaseId: string;
  sourceSha256: string;
  sourceLineageId: string;
  eventSpecId: string;
  approvalRequestId: string;
  approvedOfferId: string;
  handoffId: string;
  approvalAuditId: string;
  handoffAuditId: string;
  kitchenAcceptanceAuditId: string;
  acceptedBy: string;
  acceptedAt: string;
  pricingSummary: PricingSummary;
  pricingBasis: "module_catalog_estimate" | "full_cost_model";
  rescueChatUsed: false;
}

export type ProductionReferenceSyncEvidenceReader = (
  input: ProductionReferenceValidatedEvidenceInput
) => ProductionReferencePersistedEvidenceSnapshot | undefined;

export type ProductionReferenceAsyncEvidenceReader = (
  input: ProductionReferenceValidatedEvidenceInput
) => Promise<ProductionReferencePersistedEvidenceSnapshot | undefined>;

export type ProductionReferencePersistedEvidenceReader =
  | ProductionReferenceSyncEvidenceReader
  | ProductionReferenceAsyncEvidenceReader;

/**
 * A resolver capability is created by a server adapter that is already bound
 * to the authoritative offer, handoff and audit stores.  The evaluator never
 * accepts a snapshot object directly: only a capability registered here may
 * read persisted records and issue an opaque evidence token.
 */
export interface ProductionReferencePersistenceCapability {
  readonly readPersistedEvidence: ProductionReferencePersistedEvidenceReader;
}

export type ProductionReferenceSyncPersistenceCapability = {
  readonly readPersistedEvidence: ProductionReferenceSyncEvidenceReader;
};

export type ProductionReferenceAsyncPersistenceCapability = {
  readonly readPersistedEvidence: ProductionReferenceAsyncEvidenceReader;
};

export interface ProductionReferenceAcceptanceInput {
  caseId: string;
  source: ProductionReferenceSourceEvidence;
  offer: ProductionReferenceOfferEvidence;
  production: {
    plan: ProductionPlan;
    purchaseList: PurchaseList;
    recipes: readonly Recipe[];
  };
  operatorAcceptance?: ProductionReferenceOperatorAcceptance;
  validatedEvidence?: ProductionReferenceValidatedEvidence;
}

export interface ProductionReferenceAcceptanceIssue {
  code: string;
  message: string;
}

export interface ProductionReferenceChecklistItem {
  key: ProductionReferenceChecklistKey;
  status: ProductionReferenceChecklistStatus;
  issues: ProductionReferenceAcceptanceIssue[];
}

export interface ProductionReferenceAcceptanceResult {
  status: ProductionReferenceAcceptanceStatus;
  checklist: ProductionReferenceChecklistItem[];
  blockers: ProductionReferenceAcceptanceIssue[];
}

const validSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validIsoTimestamp = (value: unknown): value is string => {
  if (!nonEmpty(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};

const normalizeName = (value: string): string =>
  value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("de-DE");

const positiveFiniteQuantity = (quantity: unknown): quantity is { amount: number; unit: string } => {
  if (!quantity || typeof quantity !== "object" || Array.isArray(quantity)) return false;
  const candidate = quantity as { amount?: unknown; unit?: unknown };
  return typeof candidate.amount === "number"
    && Number.isFinite(candidate.amount)
    && candidate.amount > 0
    && nonEmpty(candidate.unit);
};

const validMoney = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).every((key) => key === "amount" || key === "currency")
    && typeof candidate.amount === "number"
    && Number.isFinite(candidate.amount)
    && candidate.amount >= 0
    && nonEmpty(candidate.currency);
};

const validPricingSummary = (value: unknown): value is PricingSummary => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).every((key) => key === "subtotal" || key === "perPerson" || key === "notes")
    && validMoney(candidate.subtotal)
    && (candidate.perPerson === undefined || validMoney(candidate.perPerson))
    && (candidate.notes === undefined || (Array.isArray(candidate.notes) && candidate.notes.every((note) => nonEmpty(note))));
};

const evidenceInputKeys = new Set([
  "sourceCaseId",
  "sourceSha256",
  "sourceLineageId",
  "eventSpecId",
  "offerId",
  "approvalRequestId",
  "handoffId",
  "approvalAuditId",
  "handoffAuditId",
  "kitchenAcceptanceAuditId",
  "pricingSummary",
  "pricingBasis",
  "rescueChatUsed"
]);

const persistedEvidenceKeys = new Set([
  "sourceCaseId",
  "sourceSha256",
  "sourceLineageId",
  "eventSpecId",
  "approvalRequestId",
  "approvedOfferId",
  "handoffId",
  "approvalAuditId",
  "handoffAuditId",
  "kitchenAcceptanceAuditId",
  "acceptedBy",
  "acceptedAt",
  "pricingSummary",
  "pricingBasis",
  "rescueChatUsed"
]);

function hasOnlyKeys(value: object, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function validEvidenceInput(value: unknown): value is ProductionReferenceValidatedEvidenceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (!hasOnlyKeys(candidate, evidenceInputKeys)) return false;
  const requiredStringKeys = [
    "sourceCaseId",
    "sourceLineageId",
    "eventSpecId",
    "offerId",
    "approvalRequestId",
    "handoffId",
    "approvalAuditId",
    "handoffAuditId",
    "kitchenAcceptanceAuditId"
  ];
  return requiredStringKeys.every((key) => nonEmpty(candidate[key]))
    && validSha256(candidate.sourceSha256)
    && validPricingSummary(candidate.pricingSummary)
    && (candidate.pricingBasis === "module_catalog_estimate" || candidate.pricingBasis === "full_cost_model")
    && candidate.rescueChatUsed === false;
}

function validPersistedSnapshot(value: unknown): value is ProductionReferencePersistedEvidenceSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (!hasOnlyKeys(candidate, persistedEvidenceKeys)) return false;
  return nonEmpty(candidate.sourceCaseId)
    && validSha256(candidate.sourceSha256)
    && nonEmpty(candidate.sourceLineageId)
    && nonEmpty(candidate.eventSpecId)
    && nonEmpty(candidate.approvalRequestId)
    && nonEmpty(candidate.approvedOfferId)
    && nonEmpty(candidate.handoffId)
    && nonEmpty(candidate.approvalAuditId)
    && nonEmpty(candidate.handoffAuditId)
    && nonEmpty(candidate.kitchenAcceptanceAuditId)
    && nonEmpty(candidate.acceptedBy)
    && validIsoTimestamp(candidate.acceptedAt)
    && validPricingSummary(candidate.pricingSummary)
    && (candidate.pricingBasis === "module_catalog_estimate" || candidate.pricingBasis === "full_cost_model")
    && candidate.rescueChatUsed === false;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return !!value
    && (typeof value === "object" || typeof value === "function")
    && typeof (value as { then?: unknown }).then === "function";
}

function issueValidatedEvidenceToken(
  input: ProductionReferenceValidatedEvidenceInput,
  pricingBasis: ProductionReferenceValidatedEvidenceInput["pricingBasis"],
  pricingSummary: PricingSummary,
  acceptedBy: string,
  acceptedAt: string
): ProductionReferenceValidatedEvidence {
  const immutablePricingSummary = Object.freeze({
    subtotal: Object.freeze({ ...pricingSummary.subtotal }),
    ...(pricingSummary.perPerson
      ? { perPerson: Object.freeze({ ...pricingSummary.perPerson }) }
      : {}),
    ...(pricingSummary.notes
      ? { notes: Object.freeze([...pricingSummary.notes]) }
      : {})
  }) as unknown as PricingSummary;
  return issueTrustedProductionReferenceValidatedEvidence({
    ...input,
    acceptedBy,
    acceptedAt,
    pricingSummary: immutablePricingSummary,
    pricingBasis
  });
}

/**
 * Resolver boundary for persisted evidence. It asks a registered server
 * capability to read the authoritative records, cross-checks the immutable
 * identifiers, and only then issues the opaque token consumed by the
 * evaluator. A caller-supplied snapshot (or an unregistered fake capability)
 * is rejected deterministically.
 */
export function resolveProductionReferenceValidatedEvidence(
  input: ProductionReferenceValidatedEvidenceInput,
  capability: ProductionReferenceSyncPersistenceCapability
): ProductionReferenceValidatedEvidence | undefined;
export function resolveProductionReferenceValidatedEvidence(
  input: ProductionReferenceValidatedEvidenceInput,
  capability: ProductionReferenceAsyncPersistenceCapability
): Promise<ProductionReferenceValidatedEvidence | undefined>;
export function resolveProductionReferenceValidatedEvidence(
  input: ProductionReferenceValidatedEvidenceInput,
  capability: ProductionReferencePersistenceCapability
): ProductionReferenceValidatedEvidence | undefined | Promise<ProductionReferenceValidatedEvidence | undefined>;
export function resolveProductionReferenceValidatedEvidence(
  input: ProductionReferenceValidatedEvidenceInput,
  capability: ProductionReferencePersistenceCapability
): ProductionReferenceValidatedEvidence | undefined | Promise<ProductionReferenceValidatedEvidence | undefined> {
  let inputIsValid = false;
  try {
    inputIsValid = validEvidenceInput(input)
      && !!capability
      && typeof capability === "object"
      && isRegisteredProductionReferencePersistenceCapability(capability);
  } catch {
    return undefined;
  }
  if (!inputIsValid) {
    return undefined;
  }

  const validatePersisted = (persisted: ProductionReferencePersistedEvidenceSnapshot | undefined): ProductionReferenceValidatedEvidence | undefined => {
    try {
      if (!validPersistedSnapshot(persisted)) return undefined;
      const matches = persisted.sourceCaseId === input.sourceCaseId
        && persisted.sourceSha256 === input.sourceSha256
        && persisted.sourceLineageId === input.sourceLineageId
        && persisted.eventSpecId === input.eventSpecId
        && persisted.approvedOfferId === input.offerId
        && persisted.approvalRequestId === input.approvalRequestId
        && persisted.handoffId === input.handoffId
        && persisted.approvalAuditId === input.approvalAuditId
        && persisted.handoffAuditId === input.handoffAuditId
        && persisted.kitchenAcceptanceAuditId === input.kitchenAcceptanceAuditId
        && areJsonValuesEqual(persisted.pricingSummary, input.pricingSummary)
        && persisted.rescueChatUsed === input.rescueChatUsed;
      return matches
        ? issueValidatedEvidenceToken(input, persisted.pricingBasis, persisted.pricingSummary, persisted.acceptedBy, persisted.acceptedAt)
        : undefined;
    } catch {
      return undefined;
    }
  };

  try {
    const persisted = capability.readPersistedEvidence(input);
    if (isPromiseLike(persisted)) {
      return Promise.resolve(persisted).then(
        (value) => validatePersisted(value as ProductionReferencePersistedEvidenceSnapshot | undefined),
        () => undefined
      );
    }
    return validatePersisted(persisted);
  } catch {
    return undefined;
  }
}

const statusRank: Record<ProductionReferenceChecklistStatus, number> = {
  passed: 0,
  not_assessed: 1,
  blocked: 2
};

function emptyChecklist(): ProductionReferenceChecklistItem[] {
  return [
    "source_provenance",
    "offer_pricing",
    "production_completeness",
    "purchase_coverage",
    "recipe_allergen_status",
    "kitchen_acceptance"
  ].map((key) => ({
    key: key as ProductionReferenceChecklistKey,
    status: "passed",
    issues: []
  }));
}

function addIssue(
  checklist: ProductionReferenceChecklistItem[],
  key: ProductionReferenceChecklistKey,
  status: ProductionReferenceChecklistStatus,
  issue: ProductionReferenceAcceptanceIssue
): void {
  const item = checklist.find((entry) => entry.key === key);
  if (!item) return;
  if (statusRank[status] > statusRank[item.status]) item.status = status;
  if (!item.issues.some((existing) => existing.code === issue.code)) {
    item.issues.push(issue);
  }
}

function checkSource(
  input: ProductionReferenceAcceptanceInput,
  checklist: ProductionReferenceChecklistItem[]
): void {
  const { source } = input;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "source_evidence_malformed",
      message: "Quellnachweis ist strukturell ungültig und wird fail-closed blockiert."
    });
    return;
  }
  if (source.expectedCaseId !== input.caseId || !nonEmpty(input.caseId)) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "source_case_mismatch",
      message: "Quellvertrag und Referenzfall-ID stimmen nicht überein."
    });
  }
  if (!validSha256(source.expectedSha256) || !validSha256(source.observedSha256)) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "source_provenance_missing",
      message: "Erwarteter und tatsächlich gelesener Quellhash sind nicht vollständig belegt."
    });
  } else if (source.expectedSha256 !== source.observedSha256) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "source_hash_mismatch",
      message: "Der gelesene Quellinhalt ist nicht an die Referenzerwartung gebunden."
    });
  }
  if (!Array.isArray(source.lineageReferences)) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "source_evidence_malformed",
      message: "Quellnachweis enthält keine auswertbare Provenienzliste."
    });
  } else if (source.lineageReferences.length === 0 || source.lineageReferences.some((reference) => !nonEmpty(reference))) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "source_lineage_missing",
      message: "Mindestens eine nicht-sensitive Quellen-/Provenienzreferenz fehlt."
    });
  }
}

function checkOffer(
  offer: ProductionReferenceOfferEvidence,
  checklist: ProductionReferenceChecklistItem[]
): void {
  if (!nonEmpty(offer.offerId) || !offer.pricingSummary || !Number.isFinite(offer.pricingSummary.subtotal.amount) || offer.pricingSummary.subtotal.amount < 0 || !nonEmpty(offer.pricingSummary.subtotal.currency)) {
    addIssue(checklist, "offer_pricing", "blocked", {
      code: "offer_pricing_basis_missing",
      message: "Angebot und die vom aktuellen Modell getragene Preisbasis fehlen."
    });
  }
  if (!offer.approved || !offer.reviewStatus || offer.reviewStatus.priceReviewStatus !== "verified" || offer.reviewStatus.taxReviewStatus !== "verified" || offer.reviewStatus.allergenReviewStatus !== "verified" || offer.reviewStatus.hygieneTemperatureReviewStatus !== "verified" || !offer.reviewStatus.sourceSecured || !offer.reviewStatus.publishApproved) {
    addIssue(checklist, "offer_pricing", "blocked", {
      code: "offer_review_incomplete",
      message: "Preis-, Steuer-, Allergen-, Hygiene- oder Quellenfreigabe ist nicht vollständig belegt."
    });
  }
  if (offer.pricingBasis !== "module_catalog_estimate") {
    addIssue(checklist, "offer_pricing", "blocked", {
      code: "full_cost_basis_unavailable",
      message: "Das aktuelle Domänenmodell trägt keine vollständige Kostenaufschlüsselung für full_cost_model."
    });
  }
}

function checkEvidenceBinding(
  input: ProductionReferenceAcceptanceInput,
  checklist: ProductionReferenceChecklistItem[]
): void {
  const evidence = input.validatedEvidence;
  if (!evidence || typeof evidence !== "object" || !isTrustedProductionReferenceValidatedEvidence(evidence)) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "persisted_evidence_unverified",
      message: "Provenienz, Freigabe, Übergabe und Küchenabnahme sind nicht über persistierte Evidenz-IDs verifiziert."
    });
    return;
  }
  if (
    evidence.sourceCaseId !== input.caseId
    || evidence.sourceSha256 !== input.source.expectedSha256
    || evidence.sourceSha256 !== input.source.observedSha256
    || evidence.eventSpecId !== input.production.plan.eventSpecId
    || !Array.isArray(input.source.lineageReferences)
    || !input.source.lineageReferences.includes(evidence.sourceLineageId)
  ) {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "persisted_source_evidence_mismatch",
      message: "Persistierte Quell- und Provenienz-IDs stimmen nicht mit dem geprüften Inhalt überein."
    });
  }
  if (
    evidence.offerId !== input.offer.offerId
    || !areJsonValuesEqual(evidence.pricingSummary, input.offer.pricingSummary)
    || evidence.pricingBasis !== "module_catalog_estimate"
  ) {
    addIssue(checklist, "offer_pricing", "blocked", {
      code: "persisted_offer_evidence_mismatch",
      message: "Persistierte Angebots- und Kostenbasis-IDs stimmen nicht mit dem geprüften Angebot überein."
    });
  }
  if (
    !input.operatorAcceptance
    || evidence.acceptedBy !== input.operatorAcceptance.acceptedBy
    || evidence.acceptedAt !== input.operatorAcceptance.acceptedAt
  ) {
    addIssue(checklist, "kitchen_acceptance", "blocked", {
      code: "persisted_operator_acceptance_mismatch",
      message: "Operator und Zeitpunkt der Küchenabnahme stimmen nicht mit dem persistierten Auditnachweis überein."
    });
  }
  if ([
    evidence.approvalRequestId,
    evidence.handoffId,
    evidence.approvalAuditId,
    evidence.handoffAuditId,
    evidence.kitchenAcceptanceAuditId
  ].some((id) => !nonEmpty(id))) {
    addIssue(checklist, "kitchen_acceptance", "blocked", {
      code: "persisted_evidence_ids_missing",
      message: "Freigabe-, Übergabe- oder Abnahmebeleg enthält keine vollständigen Persistenz-IDs."
    });
  }
  if (evidence.rescueChatUsed !== false) {
    addIssue(checklist, "kitchen_acceptance", "blocked", {
      code: "kitchen_acceptance_rescue_chat_unproven",
      message: "Der Ausschluss einer parallelen Rettungsunterhaltung ist nicht explizit mit false belegt."
    });
  }
}

function checkProduction(
  plan: ProductionPlan,
  purchaseList: PurchaseList,
  checklist: ProductionReferenceChecklistItem[]
): void {
  if (plan.readiness.status !== "complete" || plan.isFallback === true || plan.unresolvedItems.length > 0 || (plan.blockingIssues?.length ?? 0) > 0 || plan.productionBatches.length === 0 || plan.kitchenSheets.length === 0) {
    addIssue(checklist, "production_completeness", "blocked", {
      code: "production_basis_incomplete",
      message: "Produktionsplan ist nicht vollständig operativ oder enthält ungelöste Punkte."
    });
  }
  if (purchaseList.eventSpecId !== plan.eventSpecId || purchaseList.items.length === 0 || purchaseList.totals.itemCount !== purchaseList.items.length) {
    addIssue(checklist, "purchase_coverage", "blocked", {
      code: "purchase_list_incomplete",
      message: "Einkaufsliste fehlt, verweist auf eine andere Spezifikation oder ist inkonsistent."
    });
  }
  for (const item of purchaseList.items) {
    if (
      !positiveFiniteQuantity({ amount: item.purchaseQty, unit: item.purchaseUnit })
      || !positiveFiniteQuantity({ amount: item.normalizedQty, unit: item.normalizedUnit })
      || !Array.isArray(item.sourceRecipes)
    ) {
      addIssue(checklist, "purchase_coverage", "blocked", {
        code: "purchase_quantity_invalid",
        message: `Einkaufsposition ${item.displayName} hat keine positive, endliche und einheitenbezogene Menge.`
      });
    }
  }

  const readiness = plan.componentReadiness ?? [];
  if (readiness.length === 0 || readiness.some((component) => component.status !== "operational" || !component.hasProductionBatch || !component.hasKitchenSheet || !component.includedInPurchaseList || component.blocksProduction)) {
    addIssue(checklist, "production_completeness", "blocked", {
      code: "production_component_incomplete",
      message: "Mindestens eine Komponente ist nicht vollständig als operativer Batch, Küchenkarte und Einkaufsposition belegt."
    });
  }

  const batchIds = plan.productionBatches.map((batch) => batch.componentId);
  const sheetIds = plan.kitchenSheets.map((sheet) => sheet.componentId);
  const expectedComponentIds = new Set(batchIds);
  const sheetComponentIds = new Set(sheetIds);
  const readinessIds = readiness.map((component) => component.componentId);
  const readinessSet = new Set(readinessIds);
  if (
    expectedComponentIds.size !== batchIds.length
    || sheetComponentIds.size !== sheetIds.length
    || expectedComponentIds.size !== sheetComponentIds.size
    || [...expectedComponentIds].some((id) => !sheetComponentIds.has(id))
    || readinessSet.size !== readinessIds.length
    || readinessSet.size !== expectedComponentIds.size
    || readinessIds.some((id) => !expectedComponentIds.has(id))
    || [...expectedComponentIds].some((id) => !readinessSet.has(id))
  ) {
    addIssue(checklist, "production_completeness", "blocked", {
      code: "production_component_readiness_mismatch",
      message: "Komponentenbereitschaft ist nicht bijektiv an alle Batch- und Küchenkarten-IDs gebunden."
    });
  }

  for (const batch of plan.productionBatches) {
    if (batch.recipeId && batch.ingredients.length === 0) {
      addIssue(checklist, "production_completeness", "blocked", {
        code: "production_batch_incomplete",
        message: `Produktionsbatch ${batch.batchId} enthält keine skalierte Zutatenmenge.`
      });
    }
    const sheet = plan.kitchenSheets.find((candidate) => candidate.componentId === batch.componentId);
    const validQuantity = Boolean(
      sheet?.productionQty &&
      Number.isFinite(sheet.productionQty.amount) &&
      sheet.productionQty.amount > 0 &&
      nonEmpty(sheet.productionQty.unit)
    );
    const validRecipeWork = Boolean(
      nonEmpty(batch.recipeId) &&
      sheet?.recipeId === batch.recipeId &&
      (sheet.ingredients.length ?? 0) > 0 &&
      (sheet.steps.length ?? 0) > 0
    );
    const procurementNotes = sheet?.procurementNotes;
    const validProcurementWork = Boolean(
      !nonEmpty(batch.recipeId) &&
      !nonEmpty(sheet?.recipeId) &&
      Array.isArray(procurementNotes) &&
      procurementNotes.length > 0 &&
      procurementNotes.every((note) => nonEmpty(note))
    );
    if (!sheet || !nonEmpty(sheet.title) || !nonEmpty(sheet.station) || !nonEmpty(sheet.prepWindow) || !validQuantity || (!validRecipeWork && !validProcurementWork) || (sheet.blockingNotes?.length ?? 0) > 0) {
      addIssue(checklist, "production_completeness", "blocked", {
        code: "kitchen_sheet_incomplete",
        message: `Küchenkarte für Komponente ${batch.componentId} enthält keine vollständige Menge und Arbeitsanweisung.`
      });
    }
  }

  for (const batch of plan.productionBatches) {
    for (const ingredient of batch.ingredients) {
      if (!positiveFiniteQuantity(ingredient.quantity)) {
        addIssue(checklist, "production_completeness", "blocked", {
          code: "ingredient_quantity_invalid",
          message: `Zutat ${ingredient.name} hat keine positive, endliche und einheitenbezogene Menge.`
        });
      }
      const covered = purchaseList.items.some((item) =>
        normalizeName(item.displayName) === normalizeName(ingredient.name)
        && Array.isArray(item.sourceRecipes)
        && item.sourceRecipes.includes(batch.recipeId)
        && positiveFiniteQuantity({ amount: item.purchaseQty, unit: item.purchaseUnit })
        && positiveFiniteQuantity({ amount: item.normalizedQty, unit: item.normalizedUnit })
      );
      if (!covered) {
        addIssue(checklist, "purchase_coverage", "blocked", {
          code: "purchase_coverage_missing",
          message: `Zutat ${ingredient.name} aus Rezept ${batch.recipeId} fehlt in der Einkaufsliste.`
        });
      }
    }
  }
  for (const sheet of plan.kitchenSheets) {
    for (const ingredient of sheet.ingredients) {
      if (!positiveFiniteQuantity(ingredient.quantity)) {
        addIssue(checklist, "production_completeness", "blocked", {
          code: "ingredient_quantity_invalid",
          message: `Zutat ${ingredient.name} auf Küchenkarte ${sheet.componentId} hat keine positive, endliche und einheitenbezogene Menge.`
        });
      }
    }
  }
}

function checkRecipes(
  plan: ProductionPlan,
  recipes: readonly Recipe[],
  checklist: ProductionReferenceChecklistItem[]
): void {
  const recipesById = new Map(recipes.map((recipe) => [recipe.recipeId, recipe]));
  const recipeBoundBatches = plan.productionBatches.filter((batch) => nonEmpty(batch.recipeId));
  const selectionsByComponent = new Map<string, typeof plan.recipeSelections>();
  for (const selection of plan.recipeSelections) {
    const entries = selectionsByComponent.get(selection.componentId) ?? [];
    entries.push(selection);
    selectionsByComponent.set(selection.componentId, entries);
  }
  for (const batch of recipeBoundBatches) {
    const matchingSelections = (selectionsByComponent.get(batch.componentId) ?? [])
      .filter((selection) => selection.recipeId === batch.recipeId);
    if (matchingSelections.length !== 1) {
      addIssue(checklist, "recipe_allergen_status", "blocked", {
        code: "production_recipe_selection_mismatch",
        message: `Produktionsbatch ${batch.batchId} benötigt genau eine passende geprüfte Rezeptauswahl.`
      });
    }
  }
  for (const selection of plan.recipeSelections) {
    const matchingBatch = recipeBoundBatches.find((batch) =>
      batch.componentId === selection.componentId && batch.recipeId === selection.recipeId
    );
    if (!matchingBatch) {
      addIssue(checklist, "recipe_allergen_status", "blocked", {
        code: "production_recipe_selection_mismatch",
        message: `Rezeptauswahl für Komponente ${selection.componentId} ist keinem eindeutigen Produktionsbatch zugeordnet.`
      });
    }
  }
  for (const selection of plan.recipeSelections) {
    if (!selection.recipeId || selection.autoUsedInternetRecipe) {
      addIssue(checklist, "recipe_allergen_status", "blocked", {
        code: "recipe_missing_or_untrusted",
        message: `Komponente ${selection.componentId} hat kein freigegebenes internes Rezept.`
      });
      continue;
    }
    const recipe = recipesById.get(selection.recipeId);
    if (!recipe) {
      addIssue(checklist, "recipe_allergen_status", "blocked", {
        code: "recipe_missing",
        message: `Rezept ${selection.recipeId} fehlt im Referenzsnapshot.`
      });
    }
  }
  const selectedRecipeIds = new Set<string>();
  for (const selection of plan.recipeSelections) {
    const matchingBatch = recipeBoundBatches.find((batch) =>
      batch.componentId === selection.componentId && batch.recipeId === selection.recipeId
    );
    if (
      matchingBatch
      && selection.recipeId
      && !selection.autoUsedInternetRecipe
      && recipesById.has(selection.recipeId)
    ) {
      selectedRecipeIds.add(selection.recipeId);
    }
  }
  for (const recipe of recipes) {
    if (!selectedRecipeIds.has(recipe.recipeId)) continue;
    if (recipe.source.approvalState !== "approved_internal" && recipe.source.approvalState !== "auto_usable") {
      addIssue(checklist, "recipe_allergen_status", "blocked", {
        code: "recipe_review_required",
        message: `Rezept ${recipe.recipeId} ist noch nicht fachlich freigegeben.`
      });
    }
    if (!Array.isArray(recipe.allergens) || !Array.isArray(recipe.dietTags)) {
      addIssue(checklist, "recipe_allergen_status", "blocked", {
        code: "recipe_allergen_status_missing",
        message: `Allergen- oder Ernährungsstatus fehlt für Rezept ${recipe.recipeId}.`
      });
    }
  }
  for (const sheet of plan.kitchenSheets) {
    if (sheet.recipeId && (!Array.isArray(sheet.allergens) || !Array.isArray(sheet.dietTags))) {
      addIssue(checklist, "recipe_allergen_status", "blocked", {
        code: "recipe_allergen_status_missing",
        message: `Allergen- oder Ernährungsstatus fehlt auf Küchenkarte ${sheet.componentId}.`
      });
    }
  }
}

function checkKitchenAcceptance(
  acceptance: ProductionReferenceOperatorAcceptance | undefined,
  checklist: ProductionReferenceChecklistItem[]
): void {
  if (!acceptance) {
    addIssue(checklist, "kitchen_acceptance", "not_assessed", {
      code: "operator_kitchen_acceptance_missing",
      message: "Eine menschliche Küchenabnahme ist noch nicht dokumentiert."
    });
    return;
  }
  if (acceptance.rescueChatUsed === true) {
    addIssue(checklist, "kitchen_acceptance", "blocked", {
      code: "kitchen_acceptance_rescue_chat_used",
      message: "Eine parallele GPT-Rettungsunterhaltung ersetzt keine Küchenabnahme."
    });
  }
  if (acceptance.rescueChatUsed !== false) {
    addIssue(checklist, "kitchen_acceptance", "blocked", {
      code: "kitchen_acceptance_rescue_chat_unproven",
      message: "rescueChatUsed muss ausdrücklich false sein; fehlende Angaben blockieren."
    });
  }
  if (!acceptance.accepted || !nonEmpty(acceptance.acceptedBy) || !validIsoTimestamp(acceptance.acceptedAt)) {
    addIssue(checklist, "kitchen_acceptance", "blocked", {
      code: "operator_kitchen_acceptance_incomplete",
      message: "Küchenabnahme muss mit Status, Operator und Zeitpunkt belegt sein."
    });
  }
}

/**
 * Evaluates a reference-order evidence bundle without deriving missing facts.
 * A green result is intentionally impossible until source, artifacts, recipe
 * status and human kitchen evidence are all explicit.
 */
export function evaluateProductionReferenceAcceptance(
  input: ProductionReferenceAcceptanceInput
): ProductionReferenceAcceptanceResult {
  const checklist = emptyChecklist();
  try {
    checkSource(input, checklist);
  } catch {
    addIssue(checklist, "source_provenance", "blocked", {
      code: "source_evidence_malformed",
      message: "Quellnachweis konnte nicht deterministisch ausgewertet werden."
    });
  }
  try {
    checkOffer(input.offer, checklist);
    checkProduction(input.production.plan, input.production.purchaseList, checklist);
    checkRecipes(input.production.plan, input.production.recipes, checklist);
    checkKitchenAcceptance(input.operatorAcceptance, checklist);
    checkEvidenceBinding(input, checklist);
  } catch {
    addIssue(checklist, "production_completeness", "blocked", {
      code: "runtime_evidence_malformed",
      message: "Laufzeitnachweis ist strukturell ungültig und wird deterministisch blockiert."
    });
  }

  const blockers = checklist.flatMap((item) => item.issues);
  const status = checklist.some((item) => item.status === "blocked")
    ? "blocked"
    : checklist.some((item) => item.status === "not_assessed")
      ? "not_assessed"
      : "ready";
  return { status, checklist, blockers };
}
