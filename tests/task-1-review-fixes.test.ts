import { chmodSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import { createBusinessScopedPersistentCollection, createPersistentCollection } from "../shared-core/src/persistence.js";
import { hostedMultiBusinessReady } from "../shared-core/src/business-context.js";
import { runLocalBusinessScopeMigration } from "../scripts/migrate-local-business-scope.js";

const roots: string[] = [];

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

afterEach(async () => Promise.all(roots.splice(0).map((root) => {
  makeFixtureWritable(root);
  return rm(root, { recursive: true, force: true });
})));

function root(): string {
  const value = mkdtempSync(path.join(tmpdir(), "task-1-review-"));
  roots.push(value);
  return value;
}

function filesBelow(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(filePath) : [filePath];
  });
}

function expectNoTemporaryFiles(directory: string): void {
  expect(filesBelow(directory).filter((filePath) => filePath.endsWith(".tmp"))).toEqual([]);
}

function collection(mode: "file" | "postgres", validate?: (record: Record<string, unknown>) => Record<string, unknown>) {
  if (mode === "postgres") {
    const { Pool } = newDb().adapters.createPg();
    return createBusinessScopedPersistentCollection({ collectionName: "review-records", getId: (record) => String(record.id), pgPool: new Pool(), validate });
  }
  return createBusinessScopedPersistentCollection({ collectionName: "review-records", getId: (record) => String(record.id), rootDir: root(), validate });
}

describe("Task 1 review fixes", () => {
  it.each([buildIntakeApp, buildOfferApp, buildProductionApp, buildPrintExportApp])("opens hosted construction only behind the code-owned readiness gate", (build) => {
    expect(hostedMultiBusinessReady).toBe(true);
    expect(() => build({ env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: "secret" } } as never)).not.toThrow();
  });

  it("binds an intake audit to the builder business context instead of process env", async () => {
    const dataRoot = root();
    const app = buildIntakeApp({ rootDir: dataRoot, env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_DEV_AUTH: "true" } });
    try {
      await app.inject({ method: "POST", url: "/v1/intake/seed-demo", headers: { "x-actor-name": "Betriebs-/Audit-Operator" } });
      expect((await app.inject({ method: "GET", url: "/health" })).json().counts.auditEvents).toBeGreaterThan(0);
    } finally { await app.close(); }
  });

  it("reuses one builder-resolved actor for an audit context and payload", async () => {
    const dataRoot = root();
    const auditLog = {
      async logFor(context: object, input: { actor: object }) {
        if (context !== input.actor) throw new Error("actor identity drifted");
        return { auditId: "audit-1" };
      },
      async countFor() { return 0; }
    };
    const app = buildIntakeApp({
      rootDir: dataRoot,
      auditLog: auditLog as never,
      env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_DEV_AUTH: "true" }
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/intake/normalize",
        headers: { "x-actor-name": "Intake-Mitarbeiter" },
        payload: { text: "Sommerfest für 20 Personen" }
      });
      expect(response.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });

  it.each(["file", "postgres"] as const)("enforces canonical payload and CAS parity in %s", async (mode) => {
    const context = { businessId: "alpha" };
    const scoped = collection(mode);
    await expect(scoped.set(context, { id: "bad", version: 1, businessId: 123 })).rejects.toThrow("Betriebskontext");
    await expect(scoped.set(context, { id: "same", version: "bad" })).rejects.toThrow("Version");
    await expect(scoped.compareAndSet(context, "missing", 1, { id: "missing", version: 2 })).resolves.toBe("missing");
  });

  it.each(["file", "postgres"] as const)("rejects the complete invalid incoming version matrix in %s", async (mode) => {
    const context = { businessId: "alpha" };
    const invalidVersions = [1.5, -1, 2_147_483_648, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    for (const [index, version] of invalidVersions.entries()) {
      const scoped = collection(mode);
      await expect(scoped.set(context, { id: `set-${index}`, version })).rejects.toThrow("Version");
      await expect(scoped.insert(context, { id: `insert-${index}`, version })).rejects.toThrow("Version");
      await scoped.set(context, { id: `cas-${index}`, version: 1 });
      await expect(scoped.compareAndSet(context, `cas-${index}`, 1, { id: `cas-${index}`, version })).rejects.toThrow("Version");
    }
  });

  it.each(["file", "postgres"] as const)("rejects the complete invalid expected-version matrix in %s", async (mode) => {
    const context = { businessId: "alpha" };
    const scoped = collection(mode);
    await scoped.set(context, { id: "same", version: 1 });

    for (const expectedVersion of [1.5, -1, 2_147_483_648, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      await expect(scoped.compareAndSet(context, "same", expectedVersion, { id: "same", version: 2 })).rejects.toThrow("Version");
    }
  });

  it.each(["file", "postgres"] as const)("validates a normalized version before storage access in %s", async (mode) => {
    const scoped = collection(mode, (record) => ({ ...record, version: 1.5 }));
    await expect(scoped.set({ businessId: "alpha" }, { id: "same", version: 1 })).rejects.toThrow("Version");
  });

  it("rejects an invalid postgres version before the first query", async () => {
    let queryCount = 0;
    const scoped = createBusinessScopedPersistentCollection({
      collectionName: "query-order",
      getId: (record: { id: string; version: number }) => record.id,
      pgPool: {
        async query() {
          queryCount += 1;
          throw new Error("query executed");
        }
      }
    });

    await expect(scoped.set({ businessId: "alpha" }, { id: "same", version: 1.5 })).rejects.toThrow("Version");
    expect(queryCount).toBe(0);
  });

  it.each(["file", "postgres"] as const)("checks payload identity after validation in %s", async (mode) => {
    const scoped = collection(mode, (record) => ({ ...record, businessId: "beta" }));
    await expect(scoped.insert({ businessId: "alpha" }, { id: "same", version: 1 })).rejects.toThrow("Betriebskontext");
  });

  it("records migration completion independently for each business", async () => {
    const dataRoot = root();
    const legacy = createPersistentCollection<{ auditId: string; at: string }>({ collectionName: "audit/events", getId: (entry) => entry.auditId, rootDir: dataRoot });
    await legacy.set({ auditId: "legacy", at: "2026-08-10T00:00:00.000Z" });
    const migratedUnits = [
      { name: "stage-a-001-audit", status: "migrated" },
      { name: "stage-a-002-offers", status: "migrated" },
      { name: "stage-a-003-production-drafts", status: "migrated" },
      { name: "stage-a-004-production-v2", status: "migrated" },
      { name: "stage-a-005-intake-cases", status: "migrated" }
    ];
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "alpha", legacyFileWritersQuiesced: true })).resolves.toEqual({ units: migratedUnits });
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "beta", legacyFileWritersQuiesced: true })).resolves.toEqual({ units: migratedUnits });
  });

  it("leaves no false file record after an injected pre-publish failure", async () => {
    const dataRoot = root();
    const options = { collectionName: "fault-records", getId: (record: { id: string }) => record.id, rootDir: dataRoot };
    const failing = createBusinessScopedPersistentCollection({ ...options, fileFaultInjector: () => { throw new Error("stop"); } });
    await expect(failing.insert({ businessId: "alpha" }, { id: "same" })).rejects.toThrow("stop");
    const retry = createBusinessScopedPersistentCollection(options);
    await expect(retry.insert({ businessId: "alpha" }, { id: "same" })).resolves.toBe("created");
    expectNoTemporaryFiles(dataRoot);
  });

  it("leaves a retryable durable record and no temp file after an injected post-publish failure", async () => {
    const dataRoot = root();
    const options = { collectionName: "fault-records", getId: (record: { id: string }) => record.id, rootDir: dataRoot };
    const failing = createBusinessScopedPersistentCollection({
      ...options,
      fileFaultInjector: (phase) => { if (phase === "after_record_publish") throw new Error("stop"); }
    });

    await expect(failing.insert({ businessId: "alpha" }, { id: "same" })).rejects.toThrow("stop");
    expectNoTemporaryFiles(dataRoot);
    const retry = createBusinessScopedPersistentCollection(options);
    await expect(retry.insert({ businessId: "alpha" }, { id: "same" })).resolves.toBe("exists");
    await expect(retry.get({ businessId: "alpha" }, "same")).resolves.toMatchObject({ id: "same" });
  });

  it.each([
    ["before_record_replace", "old"],
    ["after_record_replace", "new"]
  ] as const)("keeps the expected record and removes temps after %s", async (phase, expectedValue) => {
    const dataRoot = root();
    const options = { collectionName: "fault-records", getId: (record: { id: string; value: string }) => record.id, rootDir: dataRoot };
    const initial = createBusinessScopedPersistentCollection(options);
    await initial.set({ businessId: "alpha" }, { id: "same", value: "old" });
    const failing = createBusinessScopedPersistentCollection({
      ...options,
      fileFaultInjector: (seenPhase) => { if (seenPhase === phase) throw new Error("stop"); }
    });

    await expect(failing.set({ businessId: "alpha" }, { id: "same", value: "new" })).rejects.toThrow("stop");
    expectNoTemporaryFiles(dataRoot);
    await expect(initial.get({ businessId: "alpha" }, "same")).resolves.toMatchObject({ value: expectedValue });
  });

  it("retries after record publication when manifest publication was interrupted", async () => {
    const dataRoot = root();
    const legacy = createPersistentCollection<{ auditId: string; at: string }>({ collectionName: "audit/events", getId: (entry) => entry.auditId, rootDir: dataRoot });
    await legacy.set({ auditId: "legacy", at: "2026-08-10T00:00:00.000Z" });
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "alpha", legacyFileWritersQuiesced: true, faultInjector: (phase) => { if (phase === "before_manifest_publish") throw new Error("stop"); } })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "alpha", legacyFileWritersQuiesced: true })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: "migrated" },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" },
        { name: "stage-a-004-production-v2", status: "migrated" },
        { name: "stage-a-005-intake-cases", status: "migrated" }
      ]
    });
    expectNoTemporaryFiles(dataRoot);
  });

  it.each([
    ["after_record_publish", "migrated"],
    ["before_manifest_publish", "migrated"],
    ["after_manifest_publish", "already_migrated"]
  ] as const)("recovers cleanly from migration fault %s", async (phase, retryStatus) => {
    const dataRoot = root();
    const legacy = createPersistentCollection<{ auditId: string; at: string }>({ collectionName: "audit/events", getId: (entry) => entry.auditId, rootDir: dataRoot });
    await legacy.set({ auditId: "legacy", at: "2026-08-10T00:00:00.000Z" });

    await expect(runLocalBusinessScopeMigration({
      rootDir: dataRoot,
      businessId: "alpha",
      legacyFileWritersQuiesced: true,
      faultInjector: (seenPhase) => { if (seenPhase === phase) throw new Error("stop"); }
    })).rejects.toThrow("stop");
    expectNoTemporaryFiles(dataRoot);
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "alpha", legacyFileWritersQuiesced: true })).resolves.toEqual({
      units: [
        { name: "stage-a-001-audit", status: retryStatus },
        { name: "stage-a-002-offers", status: "migrated" },
        { name: "stage-a-003-production-drafts", status: "migrated" },
        { name: "stage-a-004-production-v2", status: "migrated" },
        { name: "stage-a-005-intake-cases", status: "migrated" }
      ]
    });
    expectNoTemporaryFiles(dataRoot);
  });

  it("upgrades an old postgres scoped table before compare-and-set", async () => {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    await pool.query("CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
    await pool.query("INSERT INTO catering_business_records (business_id, collection_name, record_id, payload) VALUES ('alpha', 'old-records', 'same', '{\"id\":\"same\",\"version\":1}')");
    const scoped = createBusinessScopedPersistentCollection({ collectionName: "old-records", getId: (record: { id: string; version: number }) => record.id, pgPool: pool });
    await expect(scoped.compareAndSet({ businessId: "alpha" }, "same", 1, { id: "same", version: 2 })).resolves.toBe("updated");
  });

  it("initializes one postgres schema concurrently through independent queryables", async () => {
    let tableExists = false;
    let informationQueries = 0;
    let releaseInformationQueries!: () => void;
    const bothInformationQueriesStarted = new Promise<void>((resolve) => { releaseInformationQueries = resolve; });
    const query = async (sql: string) => {
      if (sql.startsWith("SELECT 1 FROM information_schema.tables")) {
        informationQueries += 1;
        if (informationQueries === 2) releaseInformationQueries();
        await bothInformationQueriesStarted;
        return { rows: [] };
      }
      if (sql.startsWith("CREATE TABLE")) {
        if (tableExists && !sql.includes("IF NOT EXISTS")) throw new Error("relation already exists");
        tableExists = true;
        return { rows: [] };
      }
      return { rows: [] };
    };
    const firstQueryable = { query };
    const secondQueryable = { query };
    const first = createBusinessScopedPersistentCollection({ collectionName: "concurrent", getId: (record: { id: string }) => record.id, pgPool: firstQueryable });
    const second = createBusinessScopedPersistentCollection({ collectionName: "concurrent", getId: (record: { id: string }) => record.id, pgPool: secondQueryable });

    await expect(Promise.all([
      first.list({ businessId: "alpha" }),
      second.list({ businessId: "alpha" })
    ])).resolves.toEqual([[], []]);
  });

  it("initializes the scoped table in the active postgres schema", async () => {
    let activeSchemaTableExists = false;
    const query = async (sql: string) => {
      if (sql.startsWith("SELECT 1 FROM information_schema.tables")) {
        const scopedToActiveSchema = sql.includes("table_schema = current_schema()");
        return { rows: scopedToActiveSchema ? [] : [{ column: 1 }] };
      }
      if (sql.startsWith("CREATE TABLE")) {
        activeSchemaTableExists = true;
        return { rows: [] };
      }
      if (sql.startsWith("ALTER TABLE") && !activeSchemaTableExists) {
        throw new Error("active schema table does not exist");
      }
      return { rows: [] };
    };
    const scoped = createBusinessScopedPersistentCollection({
      collectionName: "active-schema",
      getId: (record: { id: string }) => record.id,
      pgPool: { query }
    });

    await expect(scoped.list({ businessId: "alpha" })).resolves.toEqual([]);
  });

  it("does not mask a real postgres initialization error as pg-mem compatibility", async () => {
    const databaseError = Object.assign(new Error("permission denied"), { code: "42501" });
    let queryCount = 0;
    const scoped = createBusinessScopedPersistentCollection({
      collectionName: "database-error",
      getId: (record: { id: string }) => record.id,
      pgPool: {
        async query() {
          queryCount += 1;
          throw databaseError;
        }
      }
    });

    await expect(scoped.list({ businessId: "alpha" })).rejects.toBe(databaseError);
    expect(queryCount).toBe(1);
  });

  it("backfills only valid legacy Int32 versions", async () => {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    await pool.query("CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
    const versions: Array<[string, unknown, number | null]> = [
      ["zero", 0, 0],
      ["max", 2_147_483_647, 2_147_483_647],
      ["missing", undefined, null],
      ["null", null, null],
      ["string", "1", null],
      ["text", "not-a-number", null],
      ["boolean", true, null],
      ["fraction", 1.5, null],
      ["negative", -1, null],
      ["overflow", 2_147_483_648, null]
    ];
    for (const [id, version] of versions) {
      const payload = version === undefined ? { id } : { id, version };
      await pool.query("INSERT INTO catering_business_records (business_id, collection_name, record_id, payload) VALUES ($1, $2, $3, $4::jsonb)", ["alpha", "legacy-matrix", id, JSON.stringify(payload)]);
    }
    const scoped = createBusinessScopedPersistentCollection({ collectionName: "legacy-matrix", getId: (record: { id: string }) => record.id, pgPool: pool });
    await scoped.list({ businessId: "alpha" });

    const stored = await pool.query("SELECT record_id, version_number FROM catering_business_records WHERE collection_name = $1 ORDER BY record_id", ["legacy-matrix"]);
    expect(Object.fromEntries(stored.rows.map((row: { record_id: string; version_number: number | null }) => [row.record_id, row.version_number]))).toEqual(
      Object.fromEntries(versions.map(([id, , expected]) => [id, expected]))
    );
  });
});
