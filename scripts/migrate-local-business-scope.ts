import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertBusinessId, validateOfferDraft, type AuditEntry, type OfferDraft } from "../shared-core/src/index.js";
import {
  createBusinessScopedPersistentCollection,
  createPersistentCollection,
  resolveCollectionQueryable,
  resolveDataRoot,
  type CollectionStorageOptions,
  type Queryable
} from "../shared-core/src/persistence.js";

interface MigrationManifest {
  completed: Record<string, { completedAt: string; sourceCount: number; targetCount: number; hash: string; legacyHandoffDiscarded?: boolean; strippedHandoffHash?: string }>;
}

interface MigrationUnitResult {
  name: "stage-a-001-audit" | "stage-a-002-offers";
  status: "migrated" | "already_migrated";
}

export interface LocalBusinessScopeMigrationOptions extends CollectionStorageOptions {
  businessId: string;
  faultInjector?: (phase: "after_record_publish" | "before_manifest_publish" | "after_manifest_publish") => void;
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

function writeManifest(options: LocalBusinessScopeMigrationOptions, businessId: string, manifest: MigrationManifest): void {
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
    options.faultInjector?.("before_manifest_publish");
    renameSync(temporaryPath, filePath);
    // This local migration contract requires directory fsync support (macOS/Linux).
    fsyncDirectory(path.dirname(filePath));
    options.faultInjector?.("after_manifest_publish");
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
      fsyncDirectory(path.dirname(filePath));
    }
  }
}

async function pgCompletion(queryable: Queryable, businessId: string, name: string): Promise<boolean> {
  await queryable.query("CREATE TABLE IF NOT EXISTS catering_business_migrations (business_id TEXT NOT NULL, unit_name TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source_count INTEGER NOT NULL, target_count INTEGER NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (business_id, unit_name))");
  return (await queryable.query("SELECT unit_name FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2", [businessId, name])).rows.length > 0;
}

async function recordPgCompletion(queryable: Queryable, businessId: string, name: string, sourceCount: number, targetCount: number, hash: string): Promise<void> {
  await queryable.query("INSERT INTO catering_business_migrations (business_id, unit_name, source_count, target_count, hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING", [businessId, name, sourceCount, targetCount, hash]);
}

export async function runLocalBusinessScopeMigration(options: LocalBusinessScopeMigrationOptions): Promise<{ units: MigrationUnitResult[] }> {
  const businessId = assertBusinessId(options.businessId);
  const name = "stage-a-001-audit" as const;
  const offerName = "stage-a-002-offers" as const;
  const queryable = resolveCollectionQueryable(options);
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

  if (queryable ? await pgCompletion(queryable, businessId, offerName) : manifest?.completed[offerName]) {
    return { units };
  }
  const legacyOffers = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir: queryable ? undefined : options.rootDir, pgPool: queryable });
  const scopedOffers = createBusinessScopedPersistentCollection<OfferDraft>({ collectionName: "offers/drafts", getId: (draft) => draft.draftId, validate: validateOfferDraft, rootDir: queryable ? undefined : options.rootDir, pgPool: queryable });
  const sourceOffers = await legacyOffers.list();
  const strippedHandoffs = sourceOffers.map((draft) => draft.productionHandoff).filter((handoff) => handoff !== undefined);
  const transformed = sourceOffers.map((legacyDraft) => {
    const { productionHandoff: _discarded, ...draft } = legacyDraft;
    return validateOfferDraft({ ...draft, businessId, revision: typeof draft.revision === "number" ? draft.revision : 1 } as OfferDraft);
  });
  for (const draft of transformed) await scopedOffers.insert({ businessId }, draft);
  const targetOffers = await scopedOffers.list({ businessId });
  const expectedOfferHash = hashRecords(transformed.sort((left, right) => left.draftId.localeCompare(right.draftId)));
  const actualOfferHash = hashRecords(targetOffers.sort((left, right) => left.draftId.localeCompare(right.draftId)));
  if (transformed.length !== targetOffers.length || expectedOfferHash !== actualOfferHash) throw new Error("Offer-Migration konnte nicht verifiziert werden.");
  const offerCompletion = { completedAt: new Date().toISOString(), sourceCount: sourceOffers.length, targetCount: targetOffers.length, hash: actualOfferHash, legacyHandoffDiscarded: strippedHandoffs.length > 0, strippedHandoffHash: hashRecords(strippedHandoffs) };
  if (queryable) await recordPgCompletion(queryable, businessId, offerName, sourceOffers.length, targetOffers.length, actualOfferHash);
  else { manifest!.completed[offerName] = offerCompletion; writeManifest(options, businessId, manifest!); }
  if (sourceOffers.length > 0) units.push({ name: offerName, status: "migrated" });
  return { units };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = process.argv.indexOf("--business-id");
  const businessId = index >= 0 ? process.argv[index + 1] : undefined;
  if (!businessId) {
    console.error("--business-id ist erforderlich.");
    process.exitCode = 1;
  } else {
    runLocalBusinessScopeMigration({ businessId })
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
  }
}
