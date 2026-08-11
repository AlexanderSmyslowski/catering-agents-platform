import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertBusinessId,
  areJsonValuesEqual,
  formatCaseDisplayName,
  validateAcceptedEventSpec,
  validateCaseEvent,
  validateEventRequest,
  validateOfferCase,
  validateOfferDraft,
  validateProductionCase,
  validateProductionDraft,
  validateProductionPlan,
  validatePurchaseList,
  validateRecipe,
  type AuditEntry,
  type AcceptedEventSpec,
  type BusinessScopedPersistentCollection,
  type CaseEvent,
  type EventRequest,
  type OfferCase,
  type OfferDraft,
  type ProductionCase,
  type ProductionDraft,
  type ProductionClarificationAnswer,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "../shared-core/src/index.js";
import {
  createBusinessScopedPersistentCollection,
  createPersistentCollection,
  establishLegacyCollectionWriteFence,
  resolveCollectionQueryable,
  resolveDataRoot,
  type CollectionStorageOptions,
  type Queryable
} from "../shared-core/src/persistence.js";
import {
  validateClarificationDraftForStorage,
  validateProductionClarificationAnswerForStorage,
  validateProductionFeedbackDraftForStorage,
  type ClarificationDraft,
  type ProductionFeedbackDraft
} from "../production-service/src/repositories/production-store.js";
import {
  validateIntakeShadowRunForStorage,
  type IntakeShadowRun
} from "../intake-service/src/store.js";

interface MigrationManifest {
  completed: Record<string, { completedAt: string; sourceCount: number; targetCount: number; hash: string; legacyHandoffDiscarded?: boolean; discardedHandoffCount?: number; strippedHandoffHash?: string; legacyProductionStates?: Array<{ draftId: string; formerStatus: string; sourceHash: string }> }>;
}

interface MigrationUnitResult {
  name: "stage-a-001-audit" | "stage-a-002-offers" | "stage-a-003-production-drafts" | "stage-a-004-production-v2" | "stage-a-005-intake-cases";
  status: "migrated" | "already_migrated";
}

export interface LocalBusinessScopeMigrationOptions extends CollectionStorageOptions {
  businessId: string;
  legacyFileWritersQuiesced?: boolean;
  testOnlyAllowPgMemCooperativeFence?: boolean;
  faultInjector?: (phase:
    | "after_record_publish"
    | "after_offer_record_publish"
    | "after_production_draft_record_publish"
    | "after_production_v2_record_publish"
    | "before_intake_record_publish"
    | "after_intake_record_publish"
    | "before_intake_manifest_publish"
    | "after_intake_manifest_publish"
    | "before_manifest_publish"
    | "after_manifest_publish"
  ) => void;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashRecords(records: unknown[]): string {
  return createHash("sha256").update(stableJson(records)).digest("hex");
}

function legacyIdentifierReferences(value: unknown): string[] {
  const references: string[] = [];
  const visit = (nested: unknown, key?: string): void => {
    if (typeof nested === "string") {
      if (
        key !== "businessId" &&
        (!key || /Ids?$/u.test(key)) &&
        nested.length > 0 &&
        nested.length <= 240
      ) {
        references.push(nested);
      }
      return;
    }
    if (Array.isArray(nested)) {
      if (!key || /Ids$/u.test(key)) nested.forEach((item) => visit(item));
      return;
    }
    if (!nested || typeof nested !== "object") return;
    for (const [nestedKey, nestedValue] of Object.entries(nested as Record<string, unknown>)) {
      visit(nestedValue, nestedKey);
    }
  };
  visit(value);
  return [...new Set(references)];
}

function normalizeLegacyProductionDraft(draft: Record<string, unknown>, businessId: string): ProductionDraft {
  if (draft.businessId !== undefined && draft.businessId !== businessId) {
    throw new Error("Legacy-ProductionDraft passt nicht zum konfigurierten Betriebskontext.");
  }
  const formerStatus = String(draft.status ?? "pending_review");
  const mustReapprove = formerStatus === "approved" || formerStatus === "applied" ||
    draft.appliedAt !== undefined || draft.approvalRequestId !== undefined;
  const normalized = { ...draft };
  delete normalized.approvalRequestId;
  delete normalized.approvedBy;
  delete normalized.approvedAt;
  delete normalized.appliedBy;
  delete normalized.appliedAt;
  delete normalized.appliedArtifactIds;
  return validateProductionDraft({
    ...normalized,
    businessId,
    revision: typeof normalized.revision === "number" ? normalized.revision : 1,
    status: mustReapprove ? "pending_review" : normalized.status,
    ...(mustReapprove ? { legacyApprovalState: "unverified" } : {})
  } as ProductionDraft);
}

function oldStageThreeProductionDraftProjection(
  draft: Record<string, unknown>,
  businessId: string
): ProductionDraft | undefined {
  try {
    return validateProductionDraft({
      ...draft,
      businessId,
      revision: typeof draft.revision === "number" ? draft.revision : 1
    } as ProductionDraft);
  } catch {
    return undefined;
  }
}

function manifestPath(options: LocalBusinessScopeMigrationOptions, businessId: string): string {
  return path.join(resolveDataRoot(options.rootDir), "businesses", businessId, "migrations", "business-scope-manifest.json");
}

function readManifest(options: LocalBusinessScopeMigrationOptions, businessId: string): MigrationManifest {
  const filePath = manifestPath(options, businessId);
  return existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, "utf8")) as MigrationManifest
    : { completed: {} };
}

function fsyncDirectory(directory: string): void {
  const fd = openSync(directory, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeManifest(
  options: LocalBusinessScopeMigrationOptions,
  businessId: string,
  manifest: MigrationManifest,
  unitPhases?: {
    before: "before_intake_manifest_publish";
    after: "after_intake_manifest_publish";
  }
): void {
  const filePath = manifestPath(options, businessId);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = openSync(temporaryPath, "wx");
    try {
      writeFileSync(fd, JSON.stringify(manifest, null, 2));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    if (unitPhases) options.faultInjector?.(unitPhases.before);
    options.faultInjector?.("before_manifest_publish");
    renameSync(temporaryPath, filePath);
    // This local migration contract requires directory fsync support (macOS/Linux).
    fsyncDirectory(path.dirname(filePath));
    options.faultInjector?.("after_manifest_publish");
    if (unitPhases) options.faultInjector?.(unitPhases.after);
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
      fsyncDirectory(path.dirname(filePath));
    }
  }
}

async function pgCompletion(queryable: Queryable, businessId: string, name: string): Promise<boolean> {
  await queryable.query("CREATE TABLE IF NOT EXISTS catering_business_migrations (business_id TEXT NOT NULL, unit_name TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source_count INTEGER NOT NULL, target_count INTEGER NOT NULL, hash TEXT NOT NULL, legacy_handoff_discarded BOOLEAN NOT NULL DEFAULT FALSE, discarded_handoff_count INTEGER NOT NULL DEFAULT 0, stripped_handoff_hash TEXT, legacy_production_states JSONB, PRIMARY KEY (business_id, unit_name))");
  await queryable.query("ALTER TABLE catering_business_migrations ADD COLUMN IF NOT EXISTS legacy_handoff_discarded BOOLEAN NOT NULL DEFAULT FALSE");
  await queryable.query("ALTER TABLE catering_business_migrations ADD COLUMN IF NOT EXISTS discarded_handoff_count INTEGER NOT NULL DEFAULT 0");
  await queryable.query("ALTER TABLE catering_business_migrations ADD COLUMN IF NOT EXISTS stripped_handoff_hash TEXT");
  await queryable.query("ALTER TABLE catering_business_migrations ADD COLUMN IF NOT EXISTS legacy_production_states JSONB");
  return (await queryable.query("SELECT unit_name FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2", [businessId, name])).rows.length > 0;
}

async function recordPgCompletion(
  queryable: Queryable,
  businessId: string,
  name: string,
  sourceCount: number,
  targetCount: number,
  hash: string,
  handoffEvidence: { discarded: boolean; count: number; hash?: string } = { discarded: false, count: 0 },
  legacyProductionStates?: Array<{ draftId: string; formerStatus: string; sourceHash: string }>
): Promise<void> {
  await queryable.query(
    "INSERT INTO catering_business_migrations (business_id, unit_name, source_count, target_count, hash, legacy_handoff_discarded, discarded_handoff_count, stripped_handoff_hash, legacy_production_states) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) ON CONFLICT DO NOTHING",
    [businessId, name, sourceCount, targetCount, hash, handoffEvidence.discarded, handoffEvidence.count, handoffEvidence.hash ?? null, legacyProductionStates ? JSON.stringify(legacyProductionStates) : null]
  );
}

async function migrateProductionDrafts(
  options: LocalBusinessScopeMigrationOptions,
  businessId: string,
  queryable: Queryable | undefined,
  manifest: MigrationManifest | undefined
): Promise<MigrationUnitResult> {
  const name = "stage-a-003-production-drafts" as const;
  if (queryable ? await pgCompletion(queryable, businessId, name) : manifest?.completed[name]) {
    return { name, status: "already_migrated" };
  }

  const legacy = createPersistentCollection<Record<string, unknown>>({
    collectionName: "production/drafts",
    getId: (draft) => String(draft.draftId),
    rootDir: queryable ? undefined : options.rootDir,
    pgPool: queryable
  });
  const target = createBusinessScopedPersistentCollection<ProductionDraft>({
    collectionName: "production/drafts",
    getId: (draft) => draft.draftId,
    validate: validateProductionDraft,
    rootDir: queryable ? undefined : options.rootDir,
    pgPool: queryable
  });
  const sourceDrafts = await legacy.list();
  const transformed = sourceDrafts.map((draft) => normalizeLegacyProductionDraft(draft, businessId));
  for (const draft of transformed) {
    await target.insert({ businessId }, draft);
  }

  const targetDrafts = await target.list({ businessId });
  const expectedHash = hashRecords(
    [...transformed].sort((left, right) => left.draftId.localeCompare(right.draftId))
  );
  const actualHash = hashRecords(
    [...targetDrafts].sort((left, right) => left.draftId.localeCompare(right.draftId))
  );
  if (transformed.length !== targetDrafts.length || expectedHash !== actualHash) {
    throw new Error("ProductionDraft-Migration konnte nicht verifiziert werden.");
  }

  options.faultInjector?.("after_production_draft_record_publish");
  const completion = {
    completedAt: new Date().toISOString(),
    sourceCount: sourceDrafts.length,
    targetCount: targetDrafts.length,
    hash: actualHash
  };
  if (queryable) {
    await recordPgCompletion(
      queryable,
      businessId,
      name,
      sourceDrafts.length,
      targetDrafts.length,
      actualHash
    );
  } else {
    manifest!.completed[name] = completion;
    writeManifest(options, businessId, manifest!);
  }
  return { name, status: "migrated" };
}

async function migrateProductionV2(
  options: LocalBusinessScopeMigrationOptions,
  businessId: string,
  queryable: Queryable | undefined,
  manifest: MigrationManifest | undefined
): Promise<MigrationUnitResult> {
  const name = "stage-a-004-production-v2" as const;
  if (queryable ? await pgCompletion(queryable, businessId, name) : manifest?.completed[name]) {
    return { name, status: "already_migrated" };
  }

  const definitions: Array<{
    collectionName: string;
    idKey: string;
    normalize: (value: Record<string, unknown>) => Record<string, unknown>;
  }> = [
    {
      collectionName: "production/plans",
      idKey: "planId",
      normalize: (value) => validateProductionPlan(value as unknown as ProductionPlan) as unknown as Record<string, unknown>
    },
    {
      collectionName: "production/purchase-lists",
      idKey: "purchaseListId",
      normalize: (value) => validatePurchaseList(value as unknown as PurchaseList) as unknown as Record<string, unknown>
    },
    {
      collectionName: "production/clarification-answers",
      idKey: "answerId",
      normalize: (value) => validateProductionClarificationAnswerForStorage(
        value as unknown as ProductionClarificationAnswer
      ) as unknown as Record<string, unknown>
    },
    {
      collectionName: "production/clarification-drafts",
      idKey: "draftId",
      normalize: (value) => validateClarificationDraftForStorage(
        value as unknown as ClarificationDraft
      ) as unknown as Record<string, unknown>
    },
    {
      collectionName: "production/drafts",
      idKey: "draftId",
      normalize: (value) => normalizeLegacyProductionDraft(value, businessId) as unknown as Record<string, unknown>
    },
    {
      collectionName: "production/feedback-drafts",
      idKey: "feedbackId",
      normalize: (value) => validateProductionFeedbackDraftForStorage(
        value as unknown as ProductionFeedbackDraft
      ) as unknown as Record<string, unknown>
    },
    {
      collectionName: "production/recipes",
      idKey: "recipeId",
      normalize: (value) => validateRecipe(value as unknown as Recipe) as unknown as Record<string, unknown>
    }
  ];
  const expectedRecords: Array<{ collectionName: string; id: string; value: Record<string, unknown> }> = [];
  const actualRecords: Array<{ collectionName: string; id: string; value: Record<string, unknown> }> = [];
  const legacyProductionStates: Array<{ draftId: string; formerStatus: string; sourceHash: string }> = [];

  for (const definition of definitions) {
    const legacy = createPersistentCollection<Record<string, unknown>>({
      collectionName: definition.collectionName,
      getId: (value) => String(value[definition.idKey]),
      rootDir: queryable ? undefined : options.rootDir,
      pgPool: queryable
    });
    const target = createBusinessScopedPersistentCollection<Record<string, unknown>>({
      collectionName: definition.collectionName,
      getId: (value) => String(value[definition.idKey]),
      rootDir: queryable ? undefined : options.rootDir,
      pgPool: queryable
    });
    const source = await legacy.list();
    for (const raw of source) {
      if (definition.collectionName === "production/drafts") {
        legacyProductionStates.push({
          draftId: String(raw.draftId),
          formerStatus: String(raw.status ?? "pending_review"),
          sourceHash: hashRecords([raw])
        });
      }
      const value = definition.normalize(raw);
      const id = String(value[definition.idKey]);
      const inserted = await target.insert({ businessId }, value);
      if (inserted === "exists") {
        const oldStageThreeProjection = definition.collectionName === "production/drafts"
          ? oldStageThreeProductionDraftProjection(raw, businessId) as unknown as Record<string, unknown> | undefined
          : undefined;
        const replacement = oldStageThreeProjection
          ? await target.compareAndSetExact({ businessId }, id, oldStageThreeProjection, value)
          : "conflict";
        if (replacement !== "updated") {
          const existing = await target.get({ businessId }, id);
          if (!areJsonValuesEqual(existing, value)) {
            throw new Error(
              `${definition.collectionName}/${id} weicht von der sicher erkennbaren Legacy-Projektion ab oder wurde gleichzeitig verändert.`
            );
          }
        }
      }
      expectedRecords.push({ collectionName: definition.collectionName, id, value });
    }
    for (const value of await target.list({ businessId })) {
      actualRecords.push({
        collectionName: definition.collectionName,
        id: String(value[definition.idKey]),
        value
      });
    }
  }

  const byIdentity = <T extends { collectionName: string; id: string }>(records: T[]) =>
    [...records].sort((left, right) =>
      `${left.collectionName}:${left.id}`.localeCompare(`${right.collectionName}:${right.id}`)
    );
  const expectedHash = hashRecords(byIdentity(expectedRecords));
  const actualHash = hashRecords(byIdentity(actualRecords));
  if (expectedRecords.length !== actualRecords.length || expectedHash !== actualHash) {
    throw new Error("Production-v2-Migration konnte nicht verifiziert werden.");
  }

  options.faultInjector?.("after_production_v2_record_publish");
  const completion = {
    completedAt: new Date().toISOString(),
    sourceCount: expectedRecords.length,
    targetCount: actualRecords.length,
    hash: actualHash,
    legacyProductionStates
  };
  if (queryable) {
    await recordPgCompletion(
      queryable,
      businessId,
      name,
      expectedRecords.length,
      actualRecords.length,
      actualHash,
      undefined,
      legacyProductionStates
    );
  } else {
    manifest!.completed[name] = completion;
    writeManifest(options, businessId, manifest!);
  }
  return { name, status: "migrated" };
}

type ScopedMigrationRecord = {
  collectionName: string;
  id: string;
  value: unknown;
};

function sortMigrationRecords(records: ScopedMigrationRecord[]): ScopedMigrationRecord[] {
  return [...records].sort((left, right) =>
    `${left.collectionName}:${left.id}`.localeCompare(`${right.collectionName}:${right.id}`)
  );
}

async function insertIdentical<T>(
  target: BusinessScopedPersistentCollection<T>,
  businessId: string,
  id: string,
  item: T,
  collectionName: string
): Promise<void> {
  if (await target.insert({ businessId }, item) === "created") return;
  const existing = await target.get({ businessId }, id);
  if (!areJsonValuesEqual(existing, item)) {
    throw new Error(`${collectionName}/${id} existiert bereits mit abweichendem Inhalt.`);
  }
}

function deterministicMigrationId(prefix: string, value: string): string {
  const digest = createHash("sha256").update(`${prefix}:${value}`).digest("hex").slice(0, 32);
  return `${prefix}-${digest}`;
}

function timestampFromEventDate(eventDate: string | undefined): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate ?? "")) return undefined;
  const timestamp = `${eventDate}T00:00:00.000Z`;
  return Number.isNaN(Date.parse(timestamp)) ? undefined : timestamp;
}

function caseDisplayName(
  spec: AcceptedEventSpec,
  fallbackTimestamp: string
): string {
  return formatCaseDisplayName({
    customerName: spec.customer?.name,
    eventTypeLabel: spec.event.type,
    eventDate: spec.event.date,
    attendeeCount: spec.attendees.expected,
    fallbackDate: fallbackTimestamp
  });
}

function caseEventId(product: "offer" | "production", caseId: string, sequence: number): string {
  return `legacy-${product}-case-event-${String(sequence).padStart(4, "0")}-${createHash("sha256")
    .update(`${caseId}:${sequence}`)
    .digest("hex")
    .slice(0, 24)}`;
}

async function migrateIntakeAndCases(
  options: LocalBusinessScopeMigrationOptions,
  businessId: string,
  queryable: Queryable | undefined,
  manifest: MigrationManifest | undefined
): Promise<MigrationUnitResult> {
  const name = "stage-a-005-intake-cases" as const;
  if (queryable ? await pgCompletion(queryable, businessId, name) : manifest?.completed[name]) {
    return { name, status: "already_migrated" };
  }
  const storage = { rootDir: queryable ? undefined : options.rootDir, pgPool: queryable };
  const context = { businessId };
  const expected: ScopedMigrationRecord[] = [];
  const actual: ScopedMigrationRecord[] = [];

  const intakeDefinitions = [
    {
      collectionName: "intake/requests",
      id: (item: EventRequest) => item.requestId,
      validate: validateEventRequest
    },
    {
      collectionName: "intake/specs",
      id: (item: AcceptedEventSpec) => item.specId,
      validate: validateAcceptedEventSpec
    },
    {
      collectionName: "intake/shadow-runs",
      id: (item: IntakeShadowRun) => item.shadowRunId,
      validate: validateIntakeShadowRunForStorage
    }
  ] as const;
  const intakeSourceCounts: number[] = [];
  const migratedRequests: EventRequest[] = [];

  options.faultInjector?.("before_intake_record_publish");
  for (const definition of intakeDefinitions) {
    type Item = Parameters<typeof definition.validate>[0];
    const legacy = createPersistentCollection<Item>({
      collectionName: definition.collectionName,
      getId: definition.id as (item: Item) => string,
      validate: definition.validate as (item: Item) => Item,
      ...storage
    });
    const target = createBusinessScopedPersistentCollection<Item>({
      collectionName: definition.collectionName,
      getId: definition.id as (item: Item) => string,
      validate: definition.validate as (item: Item) => Item,
      ...storage
    });
    const source = await legacy.list();
    intakeSourceCounts.push(source.length);
    if (definition.collectionName === "intake/requests") {
      migratedRequests.push(...source as EventRequest[]);
    }
    for (const item of source) {
      const id = definition.id(item as never);
      await insertIdentical(target, businessId, id, item, definition.collectionName);
      expected.push({ collectionName: definition.collectionName, id, value: item });
    }
    for (const item of await target.list(context)) {
      actual.push({ collectionName: definition.collectionName, id: definition.id(item as never), value: item });
    }
  }

  const scopedOffers = createBusinessScopedPersistentCollection<OfferDraft>({
    collectionName: "offers/drafts",
    getId: (item) => item.draftId,
    getVersion: (item) => item.revision,
    validate: validateOfferDraft,
    ...storage
  });
  const scopedProductionDrafts = createBusinessScopedPersistentCollection<ProductionDraft>({
    collectionName: "production/drafts",
    getId: (item) => item.draftId,
    validate: validateProductionDraft,
    ...storage
  });
  const legacyOffers = createPersistentCollection<Record<string, unknown>>({
    collectionName: "offers/drafts",
    getId: (item) => String(item.draftId),
    ...storage
  });
  const legacyProductionDrafts = createPersistentCollection<Record<string, unknown>>({
    collectionName: "production/drafts",
    getId: (item) => String(item.draftId),
    ...storage
  });
  const offerDrafts = await scopedOffers.list(context);
  const productionDrafts = await scopedProductionDrafts.list(context);
  const rawOffersById = new Map((await legacyOffers.list()).map((item) => [String(item.draftId), item]));
  const rawProductionById = new Map((await legacyProductionDrafts.list()).map((item) => [String(item.draftId), item]));
  const requestsById = new Map(migratedRequests.map((request) => [request.requestId, request]));

  const offerCases = createBusinessScopedPersistentCollection<OfferCase>({
    collectionName: "offers/cases",
    getId: (item) => item.caseId,
    getVersion: (item) => item.version,
    validate: validateOfferCase,
    ...storage
  });
  const offerEvents = createBusinessScopedPersistentCollection<CaseEvent>({
    collectionName: "offers/case-events",
    getId: (item) => item.eventId,
    validate: validateCaseEvent,
    ...storage
  });
  for (const draft of offerDrafts) {
    const requestTimestamp = draft.proposedEventSpec.sourceLineage
      .map((lineage) => requestsById.get(lineage.reference)?.source.receivedAt)
      .find((value): value is string => Boolean(value));
    const createdAt = requestTimestamp ?? timestampFromEventDate(draft.proposedEventSpec.event.date)
      ?? "1970-01-01T00:00:00.000Z";
    const caseId = deterministicMigrationId("legacy-offer-case", draft.draftId);
    const item = validateOfferCase({
      schemaVersion: "1.0",
      businessId,
      caseId,
      displayName: caseDisplayName(draft.proposedEventSpec, createdAt),
      status: "open",
      version: 1,
      createdAt,
      updatedAt: createdAt,
      product: "offer"
    });
    const events: CaseEvent[] = [
      validateCaseEvent({
        businessId,
        eventId: caseEventId("offer", caseId, 1),
        caseId,
        sequence: 1,
        at: createdAt,
        role: "system",
        kind: "case_created",
        text: "Aus einem vorhandenen Angebotsentwurf angelegt."
      }),
      validateCaseEvent({
        businessId,
        eventId: caseEventId("offer", caseId, 2),
        caseId,
        sequence: 2,
        at: createdAt,
        role: "assistant",
        kind: "draft_created",
        text: "Vorhandener Angebotsentwurf übernommen; eine neue Freigabe ist erforderlich.",
        artifactId: draft.draftId,
        revisionRef: {
          artifactType: "OfferDraft",
          artifactId: draft.draftId,
          revision: draft.revision,
          createdAt
        }
      })
    ];
    const legacyHandoff = rawOffersById.get(draft.draftId)?.productionHandoff;
    if (legacyHandoff !== undefined) {
      const references = legacyIdentifierReferences(legacyHandoff);
      for (const artifactId of references.length > 0 ? references : [draft.draftId]) {
        const sequence = events.length + 1;
        events.push(validateCaseEvent({
          businessId,
          eventId: caseEventId("offer", caseId, sequence),
          caseId,
          sequence,
          at: createdAt,
          role: "system",
          kind: "legacy_unverified",
          text: "Ein früherer Ergebnisbezug wurde nur als ungeprüfter Hinweis übernommen.",
          artifactId
        }));
      }
    }
    await insertIdentical(offerCases, businessId, caseId, item, "offers/cases");
    expected.push({ collectionName: "offers/cases", id: caseId, value: item });
    for (const event of events) {
      await insertIdentical(offerEvents, businessId, event.eventId, event, "offers/case-events");
      expected.push({ collectionName: "offers/case-events", id: event.eventId, value: event });
    }
  }
  for (const item of await offerCases.list(context)) {
    actual.push({ collectionName: "offers/cases", id: item.caseId, value: item });
  }
  for (const item of await offerEvents.list(context)) {
    actual.push({ collectionName: "offers/case-events", id: item.eventId, value: item });
  }

  const productionCases = createBusinessScopedPersistentCollection<ProductionCase>({
    collectionName: "production/cases",
    getId: (item) => item.caseId,
    getVersion: (item) => item.version,
    validate: validateProductionCase,
    ...storage
  });
  const productionEvents = createBusinessScopedPersistentCollection<CaseEvent>({
    collectionName: "production/case-events",
    getId: (item) => item.eventId,
    validate: validateCaseEvent,
    ...storage
  });
  for (const draft of productionDrafts) {
    const createdAt = draft.createdAt;
    const caseId = deterministicMigrationId("legacy-production-case", draft.draftId);
    const item = validateProductionCase({
      schemaVersion: "1.0",
      businessId,
      caseId,
      displayName: draft.draftArtifacts.eventSpec
        ? caseDisplayName(draft.draftArtifacts.eventSpec, createdAt)
        : formatCaseDisplayName({ fallbackDate: createdAt }),
      status: "open",
      version: 1,
      createdAt,
      updatedAt: createdAt,
      product: "production"
    });
    const events: CaseEvent[] = [
      validateCaseEvent({
        businessId,
        eventId: caseEventId("production", caseId, 1),
        caseId,
        sequence: 1,
        at: createdAt,
        role: "system",
        kind: "case_created",
        text: "Aus einem vorhandenen Produktionsentwurf angelegt."
      }),
      validateCaseEvent({
        businessId,
        eventId: caseEventId("production", caseId, 2),
        caseId,
        sequence: 2,
        at: createdAt,
        role: "assistant",
        kind: "draft_created",
        text: "Vorhandener Produktionsentwurf übernommen; eine neue Freigabe ist erforderlich.",
        artifactId: draft.draftId,
        revisionRef: {
          artifactType: "ProductionDraft",
          artifactId: draft.draftId,
          revision: draft.revision,
          createdAt
        }
      })
    ];
    const raw = rawProductionById.get(draft.draftId);
    if (raw && (
      raw.status === "approved" || raw.status === "applied" || raw.approvalRequestId !== undefined ||
      raw.approvedAt !== undefined || raw.appliedAt !== undefined || raw.appliedArtifactIds !== undefined
    )) {
      const references = legacyIdentifierReferences({
        approvalRequestId: raw.approvalRequestId,
        appliedArtifactIds: raw.appliedArtifactIds
      });
      // Re-approval remains mandatory, but concrete legacy IDs stay traceable as unverified evidence.
      for (const artifactId of references.length > 0 ? references : [draft.draftId]) {
        const sequence = events.length + 1;
        events.push(validateCaseEvent({
          businessId,
          eventId: caseEventId("production", caseId, sequence),
          caseId,
          sequence,
          at: createdAt,
          role: "system",
          kind: "legacy_unverified",
          text: "Ein früherer Freigabe- oder Ergebnisbezug wurde nur als ungeprüfter Hinweis übernommen.",
          artifactId
        }));
      }
    }
    await insertIdentical(productionCases, businessId, caseId, item, "production/cases");
    expected.push({ collectionName: "production/cases", id: caseId, value: item });
    for (const event of events) {
      await insertIdentical(productionEvents, businessId, event.eventId, event, "production/case-events");
      expected.push({ collectionName: "production/case-events", id: event.eventId, value: event });
    }
  }
  for (const item of await productionCases.list(context)) {
    actual.push({ collectionName: "production/cases", id: item.caseId, value: item });
  }
  for (const item of await productionEvents.list(context)) {
    actual.push({ collectionName: "production/case-events", id: item.eventId, value: item });
  }

  const expectedHash = hashRecords(sortMigrationRecords(expected));
  const actualHash = hashRecords(sortMigrationRecords(actual));
  if (expected.length !== actual.length || expectedHash !== actualHash) {
    throw new Error("Intake- und Case-Migration konnte nicht verifiziert werden.");
  }
  options.faultInjector?.("after_intake_record_publish");

  const sourceCount = intakeSourceCounts.reduce((total, count) => total + count, 0)
    + offerDrafts.length + productionDrafts.length;
  const completion = {
    completedAt: new Date().toISOString(),
    sourceCount,
    targetCount: actual.length,
    hash: actualHash
  };
  if (queryable) {
    options.faultInjector?.("before_intake_manifest_publish");
    await recordPgCompletion(queryable, businessId, name, sourceCount, actual.length, actualHash);
    options.faultInjector?.("after_intake_manifest_publish");
  } else {
    manifest!.completed[name] = completion;
    writeManifest(options, businessId, manifest!, {
      before: "before_intake_manifest_publish",
      after: "after_intake_manifest_publish"
    });
  }
  return { name, status: "migrated" };
}

export async function runLocalBusinessScopeMigration(options: LocalBusinessScopeMigrationOptions): Promise<{ units: MigrationUnitResult[] }> {
  const businessId = assertBusinessId(options.businessId);
  const name = "stage-a-001-audit" as const;
  const offerName = "stage-a-002-offers" as const;
  const queryable = resolveCollectionQueryable(options);
  if (!queryable && options.legacyFileWritersQuiesced !== true) {
    throw new Error("Legacy file writers must be confirmed quiescent before migration.");
  }
  for (const collectionName of [
    "audit/events",
    "intake/requests",
    "intake/specs",
    "intake/shadow-runs",
    "offers/drafts",
    "production/plans",
    "production/purchase-lists",
    "production/clarification-answers",
    "production/clarification-drafts",
    "production/drafts",
    "production/feedback-drafts",
    "production/recipes"
  ] as const) {
    await establishLegacyCollectionWriteFence({
      collectionName,
      rootDir: queryable ? undefined : options.rootDir,
      pgPool: queryable,
      legacyFileWritersQuiesced: options.legacyFileWritersQuiesced,
      testOnlyAllowPgMemCooperativeFence: options.testOnlyAllowPgMemCooperativeFence
    });
  }
  const manifest = queryable ? undefined : readManifest(options, businessId);
  const units: MigrationUnitResult[] = [];

  if (!(queryable ? await pgCompletion(queryable, businessId, name) : manifest?.completed[name])) {
  const legacy = createPersistentCollection<AuditEntry>({
    collectionName: "audit/events",
    getId: (entry) => entry.auditId,
    rootDir: queryable ? undefined : options.rootDir,
    pgPool: queryable
  });
  const target = createBusinessScopedPersistentCollection<AuditEntry>({
    collectionName: "audit/events",
    getId: (entry) => entry.auditId,
    rootDir: queryable ? undefined : options.rootDir,
    pgPool: queryable
  });
  const sourceEntries = await legacy.list();
  const scopedEntries = sourceEntries.map((entry) => ({ ...entry, businessId }));
  for (const entry of scopedEntries) await target.insert({ businessId }, entry);
  const targetEntries = await target.list({ businessId });
  const expectedHash = hashRecords(scopedEntries.sort((left, right) => left.auditId.localeCompare(right.auditId)));
  const actualHash = hashRecords(targetEntries.sort((left, right) => left.auditId.localeCompare(right.auditId)));
  if (scopedEntries.length !== targetEntries.length || expectedHash !== actualHash) {
    throw new Error("Audit-Migration konnte nicht verifiziert werden.");
  }

  options.faultInjector?.("after_record_publish");

  const completion = {
    completedAt: new Date().toISOString(),
    sourceCount: sourceEntries.length,
    targetCount: targetEntries.length,
    hash: actualHash
  };
  if (queryable) {
    await recordPgCompletion(queryable, businessId, name, sourceEntries.length, targetEntries.length, actualHash);
  } else {
    manifest!.completed[name] = completion;
    writeManifest(options, businessId, manifest!);
  }
  units.push({ name, status: "migrated" });
  } else {
    units.push({ name, status: "already_migrated" });
  }

  const legacyOffers = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir: queryable ? undefined : options.rootDir, pgPool: queryable });
  const sourceOffers = await legacyOffers.list();
  const strippedHandoffs = sourceOffers.map((draft) => draft.productionHandoff).filter((handoff) => handoff !== undefined);
  const strippedHandoffHash = hashRecords(strippedHandoffs);
  if (queryable ? await pgCompletion(queryable, businessId, offerName) : manifest?.completed[offerName]) {
    if (queryable) {
      await queryable.query(
        "UPDATE catering_business_migrations SET legacy_handoff_discarded = $3, discarded_handoff_count = $4, stripped_handoff_hash = $5 WHERE business_id = $1 AND unit_name = $2 AND stripped_handoff_hash IS NULL",
        [businessId, offerName, strippedHandoffs.length > 0, strippedHandoffs.length, strippedHandoffHash]
      );
    } else if (manifest!.completed[offerName]!.discardedHandoffCount === undefined) {
      manifest!.completed[offerName] = {
        ...manifest!.completed[offerName]!,
        legacyHandoffDiscarded: strippedHandoffs.length > 0,
        discardedHandoffCount: strippedHandoffs.length,
        strippedHandoffHash
      };
      writeManifest(options, businessId, manifest!);
    }
    units.push({ name: offerName, status: "already_migrated" });
    units.push(await migrateProductionDrafts(options, businessId, queryable, manifest));
    units.push(await migrateProductionV2(options, businessId, queryable, manifest));
    units.push(await migrateIntakeAndCases(options, businessId, queryable, manifest));
    return { units };
  }
  const scopedOffers = createBusinessScopedPersistentCollection<OfferDraft>({ collectionName: "offers/drafts", getId: (draft) => draft.draftId, getVersion: (draft) => draft.revision, validate: validateOfferDraft, rootDir: queryable ? undefined : options.rootDir, pgPool: queryable });
  const transformed = sourceOffers.map((legacyDraft) => {
    const { productionHandoff: _discarded, ...draft } = legacyDraft;
    return validateOfferDraft({ ...draft, businessId, revision: typeof draft.revision === "number" ? draft.revision : 1 } as OfferDraft);
  });
  for (const draft of transformed) await scopedOffers.insert({ businessId }, draft);
  const targetOffers = await scopedOffers.list({ businessId });
  const expectedOfferHash = hashRecords(transformed.sort((left, right) => left.draftId.localeCompare(right.draftId)));
  const actualOfferHash = hashRecords(targetOffers.sort((left, right) => left.draftId.localeCompare(right.draftId)));
  if (transformed.length !== targetOffers.length || expectedOfferHash !== actualOfferHash) throw new Error("Offer-Migration konnte nicht verifiziert werden.");
  options.faultInjector?.("after_offer_record_publish");
  const offerCompletion = { completedAt: new Date().toISOString(), sourceCount: sourceOffers.length, targetCount: targetOffers.length, hash: actualOfferHash, legacyHandoffDiscarded: strippedHandoffs.length > 0, discardedHandoffCount: strippedHandoffs.length, strippedHandoffHash };
  if (queryable) await recordPgCompletion(queryable, businessId, offerName, sourceOffers.length, targetOffers.length, actualOfferHash, { discarded: strippedHandoffs.length > 0, count: strippedHandoffs.length, hash: strippedHandoffHash });
  else { manifest!.completed[offerName] = offerCompletion; writeManifest(options, businessId, manifest!); }
  units.push({ name: offerName, status: "migrated" });
  units.push(await migrateProductionDrafts(options, businessId, queryable, manifest));
  units.push(await migrateProductionV2(options, businessId, queryable, manifest));
  units.push(await migrateIntakeAndCases(options, businessId, queryable, manifest));
  return { units };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = process.argv.indexOf("--business-id");
  const businessId = index >= 0 ? process.argv[index + 1] : undefined;
  const legacyFileWritersQuiesced = process.argv.includes("--confirm-legacy-file-writers-quiesced");
  if (!businessId) {
    console.error("--business-id ist erforderlich.");
    process.exitCode = 1;
  } else {
    runLocalBusinessScopeMigration({ businessId, legacyFileWritersQuiesced })
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
  }
}
