import { createHash } from "node:crypto";
import type { BusinessContext, BusinessId } from "./business-context.js";
import type { ByoLlmDataClass } from "./data-classification.js";
import { areJsonValuesEqual } from "./json-equality.js";
import type { BusinessScopedPersistentCollection } from "./persistence.js";

export type CaseStatus = "open" | "completed" | "archived";
export type CaseProduct = "offer" | "production";
export type CaseEventRole = "user" | "assistant" | "system";
export type CaseEventVisibility = "operational" | "commercial";
export type CaseEventKind =
  | "case_created"
  | "case_copied"
  | "source_added"
  | "instruction"
  | "draft_created"
  | "review_decision"
  | "revision_created"
  | "approval"
  | "result"
  | "legacy_unverified"
  | "error";

export interface CaseSourceRef {
  sourceId: string;
  documentId?: string;
  requestId?: string;
  filename?: string;
  mimeType?: string;
  sha256?: string;
  dataClass: ByoLlmDataClass;
  addedAt: string;
}

export interface CaseRevisionRef {
  artifactType: "OfferDraft" | "ProductionDraft";
  artifactId: string;
  revision: number;
  createdAt: string;
  supersedesArtifactId?: string;
}

export interface CaseEvent {
  businessId: BusinessId;
  eventId: string;
  caseId: string;
  sequence: number;
  at: string;
  role: CaseEventRole;
  kind: CaseEventKind;
  text: string;
  visibility?: CaseEventVisibility;
  sourceId?: string;
  artifactId?: string;
  sourceRef?: CaseSourceRef;
  revisionRef?: CaseRevisionRef;
}

export interface CaseBase {
  schemaVersion: "1.0";
  businessId: BusinessId;
  caseId: string;
  displayName: string;
  status: CaseStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  copiedFromCaseId?: string;
}

export interface OfferCase extends CaseBase {
  product: "offer";
  approvedOfferId?: string;
  productionHandoffId?: string;
}

export interface ProductionCase extends CaseBase {
  product: "production";
  productionHandoffId?: string;
  sourceSpecId?: string;
  approvedProductionSpecId?: string;
  currentPlanId?: string;
  currentPurchaseListId?: string;
}

export type CateringCase = OfferCase | ProductionCase;

export interface CaseSummary {
  caseId: string;
  product: CaseProduct;
  displayName: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export function summarizeCase(value: CateringCase): CaseSummary {
  return {
    caseId: value.caseId,
    product: value.product,
    displayName: value.displayName,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

export interface CaseDisplayNameInput {
  customerName?: string;
  eventTypeLabel?: string;
  eventDate?: string;
  attendeeCount?: number;
  fallbackDate: string;
}

export interface CopyCaseForNewEventInput {
  caseId: string;
  now: string;
}

export interface CopiedCase<TCase extends CateringCase> {
  case: TCase;
  initialEvents: CaseEvent[];
}

export class CaseStoreConflictError extends Error {
  readonly code = "CASE_STORE_CONFLICT";
  readonly statusCode = 409;

  constructor(product: CaseProduct, caseId: string) {
    super(`Der ${product === "offer" ? "Angebots" : "Produktions"}auftrag ${caseId} existiert bereits mit anderen Daten.`);
    this.name = "CaseStoreConflictError";
  }
}

function compactText(value: string | undefined): string | undefined {
  const compact = value?.normalize("NFKC").replace(/\s+/gu, " ").trim();
  return compact || undefined;
}

function formatIsoDate(value: string | undefined): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value ?? "");
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatCaseDisplayName(input: CaseDisplayNameInput): string {
  const eventDate = formatIsoDate(input.eventDate);
  const attendeeLabel = Number.isSafeInteger(input.attendeeCount) && (input.attendeeCount ?? 0) > 0
    ? `${input.attendeeCount} ${input.attendeeCount === 1 ? "Person" : "Personen"}`
    : undefined;
  const parts = [
    compactText(input.customerName),
    compactText(input.eventTypeLabel),
    eventDate,
    attendeeLabel
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) return parts.join(" - ");

  const fallbackDate = formatIsoDate(input.fallbackDate);
  if (!fallbackDate) throw new Error("fallbackDate muss ein gültiges ISO-Datum enthalten.");
  return `Neuer Auftrag - ${fallbackDate}`;
}

export function normalizeCaseSearchText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("de-DE");
}

export function initialCaseEventForCase(value: CateringCase): CaseEvent {
  const eventId = `case-initial-${createHash("sha256")
    .update(`${value.businessId}\0${value.product}\0${value.caseId}`)
    .digest("hex")
    .slice(0, 32)}`;

  if (value.copiedFromCaseId) {
    return {
      businessId: value.businessId,
      eventId,
      caseId: value.caseId,
      sequence: 1,
      at: value.createdAt,
      role: "system",
      kind: "case_copied",
      text: "Auftrag aus einem vorherigen Auftrag kopiert.",
      artifactId: value.copiedFromCaseId
    };
  }

  return {
    businessId: value.businessId,
    eventId,
    caseId: value.caseId,
    sequence: 1,
    at: value.createdAt,
    role: "system",
    kind: "case_created",
    text: "Auftrag angelegt."
  };
}

interface CasePersistenceCollections<TCase extends CateringCase> {
  cases: BusinessScopedPersistentCollection<TCase>;
  events: BusinessScopedPersistentCollection<CaseEvent>;
}

export async function persistCaseWithInitialEvent<TCase extends CateringCase>(
  collections: CasePersistenceCollections<TCase>,
  context: BusinessContext,
  item: TCase,
  initialEvent: CaseEvent
): Promise<"created" | "exists"> {
  if (item.businessId !== context.businessId || initialEvent.businessId !== context.businessId) {
    throw new Error("Auftrag und Anfangsereignis passen nicht zum vertrauenswürdigen Betriebskontext.");
  }
  const existing = await collections.cases.get(context, item.caseId);

  if (existing) {
    if (!areJsonValuesEqual(existing, item)) throw new CaseStoreConflictError(item.product, item.caseId);
    const persistedInitial = await collections.events.get(context, initialEvent.eventId);
    if (persistedInitial) {
      if (!areJsonValuesEqual(persistedInitial, initialEvent)) {
        throw new CaseStoreConflictError(item.product, item.caseId);
      }
      return "exists";
    }
    const existingHistory = (await collections.events.list(context))
      .filter((event) => event.caseId === item.caseId);
    if (existingHistory.length > 0) throw new CaseStoreConflictError(item.product, item.caseId);
    if (await collections.events.insert(context, initialEvent) !== "created") {
      const racedInitial = await collections.events.get(context, initialEvent.eventId);
      if (!racedInitial || !areJsonValuesEqual(racedInitial, initialEvent)) {
        throw new CaseStoreConflictError(item.product, item.caseId);
      }
    }
    return "exists";
  }

  const orphanedInitial = await collections.events.get(context, initialEvent.eventId);
  if (orphanedInitial && !areJsonValuesEqual(orphanedInitial, initialEvent)) {
    throw new CaseStoreConflictError(item.product, item.caseId);
  }
  if (!orphanedInitial && await collections.events.insert(context, initialEvent) !== "created") {
    const racedInitial = await collections.events.get(context, initialEvent.eventId);
    if (!racedInitial || !areJsonValuesEqual(racedInitial, initialEvent)) {
      throw new CaseStoreConflictError(item.product, item.caseId);
    }
  }

  // The case is the visibility marker in file mode; a crash before it leaves a deterministic, retryable event.
  const outcome = await collections.cases.insert(context, item);
  if (outcome === "created") return outcome;
  const racedCase = await collections.cases.get(context, item.caseId);
  if (racedCase && areJsonValuesEqual(racedCase, item)) return "exists";
  throw new CaseStoreConflictError(item.product, item.caseId);
}

export function sortCasesByLatestActivity<TCase extends CateringCase>(
  cases: TCase[],
  events: CaseEvent[]
): TCase[] {
  const latestEventByCase = new Map<string, number>();
  for (const event of events) {
    const instant = Date.parse(event.at);
    if (!Number.isFinite(instant)) continue;
    latestEventByCase.set(event.caseId, Math.max(latestEventByCase.get(event.caseId) ?? 0, instant));
  }

  const activityInstant = (item: TCase): number => Math.max(
    Date.parse(item.updatedAt),
    latestEventByCase.get(item.caseId) ?? 0
  );

  return [...cases].sort((left, right) =>
    activityInstant(right) - activityInstant(left) || left.caseId.localeCompare(right.caseId)
  );
}

export function copyCaseForNewEvent(
  source: OfferCase,
  input: CopyCaseForNewEventInput
): CopiedCase<OfferCase>;
export function copyCaseForNewEvent(
  source: ProductionCase,
  input: CopyCaseForNewEventInput
): CopiedCase<ProductionCase>;
export function copyCaseForNewEvent(
  source: CateringCase,
  input: CopyCaseForNewEventInput
): CopiedCase<CateringCase> {
  const base = {
    schemaVersion: "1.0" as const,
    businessId: source.businessId,
    caseId: input.caseId,
    displayName: source.displayName,
    status: "open" as const,
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
    copiedFromCaseId: source.caseId
  };
  const copiedCase: CateringCase = source.product === "offer"
    ? { ...base, product: "offer" }
    : { ...base, product: "production" };

  return {
    case: copiedCase,
    initialEvents: [initialCaseEventForCase(copiedCase)]
  };
}
