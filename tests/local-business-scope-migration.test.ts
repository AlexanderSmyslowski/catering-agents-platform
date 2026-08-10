import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { AuditLogStore } from "../shared-core/src/audit-log.js";
import {
  createEventRequestFromText,
  createOfferDraft,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  validateProductionDraft,
  type AuditEntry,
  type OfferDraft,
  type ProductionDraft,
  type Queryable
} from "../shared-core/src/index.js";
import { runLocalBusinessScopeMigration } from "../scripts/migrate-local-business-scope.js";
import { createBusinessScopedPersistentCollection, createPersistentCollection } from "../shared-core/src/persistence.js";

const dataRoots: string[] = [];
const confirmedLegacyFileWriters = { legacyFileWritersQuiesced: true } as const;
const testOnlyPgMemFence = { testOnlyAllowPgMemCooperativeFence: true } as const;

async function waitForPath(filePath: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(filePath)) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${filePath}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function childResult(child: ChildProcess): Promise<{ code: number | null; stderr: string }> {
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
  const code = await new Promise<number | null>((resolve) => child.once("close", resolve));
  return { code, stderr };
}

function makeFixtureWritable(filePath: string): void {
  if (!existsSync(filePath)) return;
  const stats = lstatSync(filePath);
  if (stats.isSymbolicLink()) return;
  if (!stats.isDirectory()) {
    chmodSync(filePath, 0o644);
    return;
  }
  chmodSync(filePath, 0o755);
  for (const entry of readdirSync(filePath)) makeFixtureWritable(path.join(filePath, entry));
}

function legacyProductionDraft(draftId: string): ProductionDraft {
  const eventSpec = normalizeEventRequestToSpec(createEventRequestFromText({
    requestId: `request-${draftId}`,
    channel: "text",
    rawText: "Lunch fuer 20 Personen."
  }));
  return validateProductionDraft({
    schemaVersion: SCHEMA_VERSION,
    draftId,
    status: "pending_review",
    createdAt: "2026-08-10T00:00:00.000Z",
    source: {
      kind: "manual_import",
      receivedAt: "2026-08-10T00:00:00.000Z",
      sourceRef: "legacy-production-draft"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [{
      cardId: `card-${draftId}`,
      kind: "event_data",
      title: "Event pruefen",
      summary: "Legacy-Entwurf",
      decision: "pending",
      targetPath: "$.draftArtifacts.eventSpec",
      targetId: eventSpec.specId,
      requiredApproval: true
    }],
    draftArtifacts: { eventSpec }
  });
}

afterEach(async () => {
  await Promise.all(dataRoots.splice(0).map((rootDir) => {
    makeFixtureWritable(rootDir);
    return rm(rootDir, { recursive: true, force: true });
  }));
});

describe("local business scope migration", () => {
  it("fails closed in file mode without explicit legacy-writer quiescence confirmation", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-quiescence-"));
    dataRoots.push(rootDir);

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).rejects.toThrow(
      "Legacy file writers must be confirmed quiescent"
    );
    expect(existsSync(path.join(rootDir, "audit/events/.business-scope-migration-write-fence"))).toBe(false);
  });

  it("rejects a symlinked legacy collection without touching its external target", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-symlink-directory-"));
    const externalDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-external-directory-"));
    dataRoots.push(rootDir, externalDir);
    mkdirSync(path.join(rootDir, "audit"), { recursive: true });
    symlinkSync(externalDir, path.join(rootDir, "audit/events"));

    await expect(runLocalBusinessScopeMigration({
      rootDir,
      businessId: "local",
      legacyFileWritersQuiesced: true
    })).rejects.toThrow(/symbolic link/i);
    expect(existsSync(path.join(externalDir, ".business-scope-migration-write-fence"))).toBe(false);
    expect(lstatSync(externalDir).mode & 0o777).toBe(0o700);
  });

  it("rejects symlinked legacy entries without chmod or reading their targets", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-symlink-entry-"));
    const externalDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-external-entry-"));
    dataRoots.push(rootDir, externalDir);
    const collectionDir = path.join(rootDir, "audit/events");
    const externalFile = path.join(externalDir, "outside.json");
    mkdirSync(collectionDir, { recursive: true });
    writeFileSync(externalFile, JSON.stringify({ auditId: "outside" }), { mode: 0o600 });
    symlinkSync(externalFile, path.join(collectionDir, "inside.json"));

    await expect(runLocalBusinessScopeMigration({
      rootDir,
      businessId: "local",
      legacyFileWritersQuiesced: true
    })).rejects.toThrow(/symbolic link/i);
    expect(lstatSync(externalFile).mode & 0o777).toBe(0o600);
    expect(readFileSync(externalFile, "utf8")).toBe(JSON.stringify({ auditId: "outside" }));
  });

  it("waits for an in-flight cooperative file writer before taking the migration snapshot", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-in-flight-writer-"));
    dataRoots.push(rootDir);
    const legacy = createPersistentCollection<Omit<AuditEntry, "businessId">>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir
    });
    await legacy.set({
      auditId: "in-flight",
      at: "2026-08-10T00:00:00.000Z",
      action: "legacy.audit",
      entityType: "Legacy",
      entityId: "in-flight",
      actor: { name: "Operator", source: "test" },
      summary: "before"
    });

    const enteredPath = path.join(rootDir, "writer-entered");
    const releasePath = path.join(rootDir, "release-writer");
    const migrationStartedPath = path.join(rootDir, "migration-started");
    const migrationResultPath = path.join(rootDir, "migration-result");
    const persistenceUrl = pathToFileURL(path.resolve("shared-core/src/persistence.ts")).href;
    const migrationUrl = pathToFileURL(path.resolve("scripts/migrate-local-business-scope.ts")).href;
    const writerScript = path.join(rootDir, "writer.mjs");
    const migrationScript = path.join(rootDir, "migration.mjs");
    writeFileSync(writerScript, `
      import { existsSync, writeFileSync } from "node:fs";
      const { createPersistentCollection } = await import(${JSON.stringify(persistenceUrl)});
      const collection = createPersistentCollection({
        collectionName: "audit/events",
        getId: (entry) => entry.auditId,
        rootDir: ${JSON.stringify(rootDir)},
        fileFaultInjector(phase) {
          if (phase !== "before_record_replace") return;
          writeFileSync(${JSON.stringify(enteredPath)}, "entered");
          const sleeper = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
          while (!existsSync(${JSON.stringify(releasePath)})) Atomics.wait(sleeper, 0, 0, 10);
        }
      });
      await collection.set({
        auditId: "in-flight",
        at: "2026-08-10T00:00:00.000Z",
        action: "legacy.audit",
        entityType: "Legacy",
        entityId: "in-flight",
        actor: { name: "Operator", source: "test" },
        summary: "included"
      });
    `);
    writeFileSync(migrationScript, `
      import { writeFileSync } from "node:fs";
      const { runLocalBusinessScopeMigration } = await import(${JSON.stringify(migrationUrl)});
      writeFileSync(${JSON.stringify(migrationStartedPath)}, "started");
      const result = await runLocalBusinessScopeMigration({
        rootDir: ${JSON.stringify(rootDir)},
        businessId: "local",
        legacyFileWritersQuiesced: true
      });
      writeFileSync(${JSON.stringify(migrationResultPath)}, JSON.stringify(result));
    `);

    const writer = spawn(process.execPath, ["--import", "tsx", writerScript], { stdio: ["ignore", "ignore", "pipe"] });
    await waitForPath(enteredPath);
    const migrator = spawn(process.execPath, ["--import", "tsx", migrationScript], { stdio: ["ignore", "ignore", "pipe"] });
    await waitForPath(migrationStartedPath);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(existsSync(migrationResultPath)).toBe(false);

    writeFileSync(releasePath, "release");
    const [writerOutcome, migrationOutcome] = await Promise.all([childResult(writer), childResult(migrator)]);
    expect(writerOutcome).toEqual({ code: 0, stderr: "" });
    expect(migrationOutcome).toEqual({ code: 0, stderr: "" });
    const scoped = createBusinessScopedPersistentCollection<AuditEntry>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir
    });
    await expect(scoped.get({ businessId: "local" }, "in-flight")).resolves.toMatchObject({ summary: "included" });
  });

  it("copies legacy audit records once and preserves the source", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-"));
    dataRoots.push(rootDir);
    const legacyAudit = createPersistentCollection<Omit<AuditEntry, "businessId">>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir
    });
    await legacyAudit.set({
      auditId: "audit-legacy-1",
      at: "2026-08-10T00:00:00.000Z",
      action: "legacy.audit",
      entityType: "Legacy",
      entityId: "legacy-1",
      actor: { name: "Operator", source: "test" },
      summary: "legacy entry"
    });

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toMatchObject({
      units: [
        { name: "stage-a-001-audit", status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toMatchObject({
      units: [
        { name: "stage-a-001-audit", status: "already_migrated" },
        { name: "stage-a-002-offers", status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "already_migrated" }
      ]
    });

    await expect(legacyAudit.list()).resolves.toHaveLength(1);
    await expect(new AuditLogStore({ rootDir }).listRecentFor({ businessId: "local" }, 10)).resolves.toHaveLength(1);
  });

  it("reports the empty offer unit on first run and retry", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-empty-"));
    dataRoots.push(rootDir);

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: "already_migrated" },
        { name: "stage-a-002-offers", status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "already_migrated" }
      ]
    });
  });

  it("records file evidence for every discarded handoff while preserving the legacy source", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-offers-"));
    dataRoots.push(rootDir);
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir });
    const draft = createOfferDraft(createEventRequestFromText({ requestId: "legacy-offer", channel: "text", rawText: "Lunch fuer 20 Personen." }));
    const legacyDraft = { ...draft, productionHandoff: { legacy: true } };
    await legacy.set(legacyDraft);

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toMatchObject({
      units: [
        { name: "stage-a-001-audit", status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });

    await expect(legacy.list()).resolves.toEqual([legacyDraft]);
    const scoped = createBusinessScopedPersistentCollection<OfferDraft>({ collectionName: "offers/drafts", getId: (item) => item.draftId, rootDir });
    const migrated = await scoped.get({ businessId: "local" }, draft.draftId);
    expect(migrated).not.toHaveProperty("productionHandoff");
    const manifest = JSON.parse(readFileSync(path.join(rootDir, "businesses/local/migrations/business-scope-manifest.json"), "utf8"));
    expect(manifest.completed["stage-a-002-offers"]).toMatchObject({
      sourceCount: 1,
      targetCount: 1,
      legacyHandoffDiscarded: true,
      discardedHandoffCount: 1
    });
    expect(manifest.completed["stage-a-002-offers"].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.completed["stage-a-002-offers"].strippedHandoffHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("resumes the file offer migration after records publish before completion", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-resume-"));
    dataRoots.push(rootDir);
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir });
    await legacy.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-resume", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });

    await expect(runLocalBusinessScopeMigration({
      rootDir,
      businessId: "local",
      ...confirmedLegacyFileWriters,
      faultInjector: (phase) => { if (phase === "after_offer_record_publish") throw new Error("stop"); }
    })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
  });

  it("records and retries PostgreSQL offer completion evidence without deleting legacy records", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), pgPool: pool });
    const legacyDraft = { ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-pg", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } };
    await legacy.set(legacyDraft);

    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local", ...testOnlyPgMemFence })).resolves.toMatchObject({
      units: [
        { status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local", ...testOnlyPgMemFence })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: "already_migrated" },
        { name: "stage-a-002-offers", status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "already_migrated" }
      ]
    });
    await expect(legacy.list()).resolves.toEqual([legacyDraft]);
    const completion = await pool.query("SELECT source_count, target_count, hash, legacy_handoff_discarded, discarded_handoff_count, stripped_handoff_hash FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2", ["local", "stage-a-002-offers"]);
    expect(completion.rows[0]).toMatchObject({ source_count: 1, target_count: 1, legacy_handoff_discarded: true, discarded_handoff_count: 1 });
    expect(completion.rows[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(completion.rows[0]?.stripped_handoff_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when pg-mem is used without the explicit test-only cooperative fallback", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();

    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local" })).rejects.toThrow(
      "Real PostgreSQL is required for raw-SQL migration fencing"
    );
  });

  it("resumes PostgreSQL offer migration after record publication", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacy = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), pgPool: pool });
    await legacy.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-pg-resume", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });

    await expect(runLocalBusinessScopeMigration({
      pgPool: pool,
      businessId: "local",
      ...testOnlyPgMemFence,
      faultInjector: (phase) => { if (phase === "after_offer_record_publish") throw new Error("stop"); }
    })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local", ...testOnlyPgMemFence })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
  });

  it("backfills discarded-handoff evidence for already-complete file and PostgreSQL units", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-backfill-"));
    dataRoots.push(rootDir);
    const legacyFile = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), rootDir });
    await legacyFile.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-backfill-file", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });
    const manifestPath = path.join(rootDir, "businesses/local/migrations/business-scope-manifest.json");
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ completed: {
      "stage-a-001-audit": { completedAt: "2026-08-10T00:00:00.000Z", sourceCount: 0, targetCount: 0, hash: "a".repeat(64) },
      "stage-a-002-offers": { completedAt: "2026-08-10T00:00:00.000Z", sourceCount: 1, targetCount: 1, hash: "b".repeat(64), legacyHandoffDiscarded: true, strippedHandoffHash: "c".repeat(64) }
    } }));
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    const backfilledManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(backfilledManifest.completed["stage-a-002-offers"].discardedHandoffCount).toBe(1);

    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacyPg = createPersistentCollection<Record<string, unknown>>({ collectionName: "offers/drafts", getId: (draft) => String(draft.draftId), pgPool: pool });
    await legacyPg.set({ ...createOfferDraft(createEventRequestFromText({ requestId: "legacy-backfill-pg", channel: "text", rawText: "Lunch fuer 20 Personen." })), productionHandoff: { legacy: true } });
    await pool.query("CREATE TABLE catering_business_migrations (business_id TEXT NOT NULL, unit_name TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source_count INTEGER NOT NULL, target_count INTEGER NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (business_id, unit_name))");
    await pool.query("INSERT INTO catering_business_migrations (business_id, unit_name, source_count, target_count, hash) VALUES ('local', 'stage-a-001-audit', 0, 0, $1), ('local', 'stage-a-002-offers', 1, 1, $2)", ["a".repeat(64), "b".repeat(64)]);
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local", ...testOnlyPgMemFence })).resolves.toMatchObject({
      units: [
        { status: "already_migrated" },
        { status: "already_migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" }
      ]
    });
    const completion = await pool.query("SELECT legacy_handoff_discarded, discarded_handoff_count, stripped_handoff_hash FROM catering_business_migrations WHERE unit_name = 'stage-a-002-offers'");
    expect(completion.rows[0]).toMatchObject({ legacy_handoff_discarded: true, discarded_handoff_count: 1 });
    expect(completion.rows[0]?.stripped_handoff_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("resumes an append-only file migration of legacy ProductionDrafts with count and hash evidence", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-production-drafts-"));
    dataRoots.push(rootDir);
    const legacy = createPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      rootDir
    });
    const source = legacyProductionDraft("production-draft-legacy-file");
    await legacy.set(source);

    await expect(runLocalBusinessScopeMigration({
      rootDir,
      businessId: "local",
      ...confirmedLegacyFileWriters,
      faultInjector: (phase: string) => {
        if (phase === "after_production_draft_record_publish") throw new Error("stop");
      }
    })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toMatchObject({
      units: [{ status: "already_migrated" }, { status: "already_migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "migrated"
      }]
    });
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters })).resolves.toMatchObject({
      units: [{ status: "already_migrated" }, { status: "already_migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "already_migrated"
      }]
    });

    await expect(legacy.list()).resolves.toEqual([source]);
    const scoped = createBusinessScopedPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      rootDir
    });
    await expect(scoped.get({ businessId: "local" }, source.draftId)).resolves.toEqual({
      ...source,
      businessId: "local"
    });
    const manifest = JSON.parse(readFileSync(
      path.join(rootDir, "businesses/local/migrations/business-scope-manifest.json"),
      "utf8"
    ));
    expect(manifest.completed["stage-a-003-production-drafts"]).toMatchObject({
      sourceCount: 1,
      targetCount: 1
    });
    expect(manifest.completed["stage-a-003-production-drafts"].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("migrates legacy PostgreSQL ProductionDrafts once and preserves completion evidence", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacy = createPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      pgPool: pool
    });
    const source = legacyProductionDraft("production-draft-legacy-pg");
    await legacy.set(source);

    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local", ...testOnlyPgMemFence })).resolves.toMatchObject({
      units: [{ status: "migrated" }, { status: "migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "migrated"
      }]
    });
    await expect(runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local", ...testOnlyPgMemFence })).resolves.toMatchObject({
      units: [{ status: "already_migrated" }, { status: "already_migrated" }, {
        name: "stage-a-003-production-drafts",
        status: "already_migrated"
      }]
    });

    await expect(legacy.list()).resolves.toEqual([source]);
    const scoped = createBusinessScopedPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      pgPool: pool
    });
    await expect(scoped.get({ businessId: "local" }, source.draftId)).resolves.toEqual({
      ...source,
      businessId: "local"
    });
    const completion = await pool.query(
      "SELECT source_count, target_count, hash FROM catering_business_migrations WHERE business_id = $1 AND unit_name = $2",
      ["local", "stage-a-003-production-drafts"]
    );
    expect(completion.rows[0]).toMatchObject({ source_count: 1, target_count: 1 });
    expect(completion.rows[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps fenced file sources readable while cooperative and mode-bit guards reject later writes", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-file-fence-"));
    dataRoots.push(rootDir);
    const legacyAudit = createPersistentCollection<Omit<AuditEntry, "businessId">>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir
    });
    const auditEntry = {
      auditId: "audit-before-fence",
      at: "2026-08-10T00:00:00.000Z",
      action: "legacy.audit",
      entityType: "Legacy",
      entityId: "legacy-before-fence",
      actor: { name: "Operator", source: "test" },
      summary: "before fence"
    } satisfies Omit<AuditEntry, "businessId">;
    const legacyOffers = createPersistentCollection<OfferDraft>({
      collectionName: "offers/drafts",
      getId: (draft) => String(draft.draftId),
      rootDir
    });
    const offer = createOfferDraft(createEventRequestFromText({
      requestId: "offer-before-fence",
      channel: "text",
      rawText: "Lunch fuer 20 Personen."
    }));
    const legacyDrafts = createPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      rootDir
    });
    const productionDraft = legacyProductionDraft("production-before-fence");
    await legacyAudit.set(auditEntry);
    await legacyOffers.set(offer);
    await legacyDrafts.set(productionDraft);

    await runLocalBusinessScopeMigration({ rootDir, businessId: "local", ...confirmedLegacyFileWriters });

    expect(lstatSync(path.join(rootDir, "audit/events")).mode & 0o777).toBe(0o555);
    expect(() => writeFileSync(
      path.join(rootDir, "audit/events/audit-before-fence.json"),
      JSON.stringify({ ...auditEntry, summary: "raw late replacement" })
    )).toThrow(/EACCES|EPERM/);
    expect(() => writeFileSync(
      path.join(rootDir, "offers/drafts/raw-late-insert.json"),
      JSON.stringify({ draftId: "raw-late-insert" })
    )).toThrow(/EACCES|EPERM/);
    await expect(legacyAudit.set({ ...auditEntry, summary: "late replacement" })).rejects.toThrow();
    await expect(legacyOffers.insert(createOfferDraft(createEventRequestFromText({
      requestId: "offer-after-fence",
      channel: "text",
      rawText: "Lunch fuer 30 Personen."
    })))).rejects.toThrow();
    await expect(legacyDrafts.set(legacyProductionDraft("production-after-fence"))).rejects.toThrow();
    await expect(legacyAudit.list()).resolves.toEqual([auditEntry]);
    await expect(legacyOffers.list()).resolves.toEqual([offer]);
    await expect(legacyDrafts.list()).resolves.toEqual([productionDraft]);
  });

  it("fences already-open PostgreSQL legacy writers while keeping every source readable", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool: Queryable = new Pool();
    const legacyAudit = createPersistentCollection<Omit<AuditEntry, "businessId">>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      pgPool: pool
    });
    const auditEntry = {
      auditId: "audit-before-pg-fence",
      at: "2026-08-10T00:00:00.000Z",
      action: "legacy.audit",
      entityType: "Legacy",
      entityId: "legacy-before-pg-fence",
      actor: { name: "Operator", source: "test" },
      summary: "before fence"
    } satisfies Omit<AuditEntry, "businessId">;
    const legacyOffers = createPersistentCollection<OfferDraft>({
      collectionName: "offers/drafts",
      getId: (draft) => String(draft.draftId),
      pgPool: pool
    });
    const offer = createOfferDraft(createEventRequestFromText({
      requestId: "offer-before-pg-fence",
      channel: "text",
      rawText: "Lunch fuer 20 Personen."
    }));
    const legacyDrafts = createPersistentCollection<ProductionDraft>({
      collectionName: "production/drafts",
      getId: (draft) => draft.draftId,
      validate: validateProductionDraft,
      pgPool: pool
    });
    const productionDraft = legacyProductionDraft("production-before-pg-fence");
    await legacyAudit.set(auditEntry);
    await legacyOffers.set(offer);
    await legacyDrafts.set(productionDraft);

    await runLocalBusinessScopeMigration({ pgPool: pool, businessId: "local", ...testOnlyPgMemFence });

    await expect(legacyAudit.set({ ...auditEntry, summary: "late replacement" })).rejects.toThrow();
    await expect(legacyOffers.insert(createOfferDraft(createEventRequestFromText({
      requestId: "offer-after-pg-fence",
      channel: "text",
      rawText: "Lunch fuer 30 Personen."
    })))).rejects.toThrow();
    await expect(legacyDrafts.set(legacyProductionDraft("production-after-pg-fence"))).rejects.toThrow();
    await expect(legacyAudit.list()).resolves.toEqual([auditEntry]);
    await expect(legacyOffers.list()).resolves.toEqual([offer]);
    await expect(legacyDrafts.list()).resolves.toEqual([productionDraft]);
  });
});
