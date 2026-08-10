import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import {
  createBusinessScopedPersistentCollection,
  type Queryable
} from "../shared-core/src/persistence.js";

interface ScopedRecord {
  id: string;
  value: string;
  version: number;
  businessId?: string;
}

const dataRoots: string[] = [];

interface CasWorkerResult {
  writer: string;
  result: "updated" | "conflict" | "missing";
}

afterEach(async () => {
  for (const dataRoot of dataRoots.splice(0)) {
    await import("node:fs/promises").then(({ rm }) => rm(dataRoot, { recursive: true, force: true }));
  }
});

function createScopedTestCollection(mode: "file" | "postgres") {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-scope-"));
  dataRoots.push(rootDir);
  const pgPool: Queryable | undefined = mode === "postgres"
    ? newDb().adapters.createPg().Pool.prototype
    : undefined;

  if (mode === "postgres") {
    const db = newDb();
    const { Pool } = db.adapters.createPg();
    return createBusinessScopedPersistentCollection<ScopedRecord>({
      collectionName: "scoped-test-records",
      getId: (record) => record.id,
      pgPool: new Pool()
    });
  }

  return createBusinessScopedPersistentCollection<ScopedRecord>({
    collectionName: "scoped-test-records",
    getId: (record) => record.id,
    rootDir
  });
}

function startCasWorker(args: {
  rootDir: string;
  writer: string;
  pauseClaimPath: string;
  pauseReadyPath: string;
  releasePath: string;
  checkedPath: string;
}): { result: Promise<CasWorkerResult> } {
  const fixturePath = fileURLToPath(new URL("./fixtures/business-scoped-cas-worker.ts", import.meta.url));
  const child = spawn(process.execPath, [
    "--import",
    "tsx",
    fixturePath,
    args.rootDir,
    args.writer,
    args.pauseClaimPath,
    args.pauseReadyPath,
    args.releasePath,
    args.checkedPath
  ], {
    cwd: path.resolve(path.dirname(fixturePath), "../.."),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });

  const result = new Promise<CasWorkerResult>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`CAS worker ${args.writer} exited with ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()) as CasWorkerResult);
      } catch (error) {
        reject(new Error(`CAS worker ${args.writer} returned invalid output: ${stdout}\n${stderr}`, { cause: error }));
      }
    });
  });
  return { result };
}

async function waitForFile(filePath: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(filePath)) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return existsSync(filePath);
}

describe("business-scoped persistent collections", () => {
  it.each(["file", "postgres"] as const)("isolates equal record ids in %s storage", async (mode) => {
    const collection = createScopedTestCollection(mode);
    await collection.insert({ businessId: "alpha" }, { id: "same", value: "A", version: 1 });
    await collection.insert({ businessId: "beta" }, { id: "same", value: "B", version: 1 });

    await expect(collection.get({ businessId: "alpha" }, "same")).resolves.toMatchObject({ value: "A" });
    await expect(collection.get({ businessId: "beta" }, "same")).resolves.toMatchObject({ value: "B" });
  });

  it("rejects a payload whose business id differs from the trusted context", async () => {
    const collection = createScopedTestCollection("file");

    await expect(collection.set(
      { businessId: "alpha" },
      { id: "same", value: "A", version: 1, businessId: "beta" }
    )).rejects.toThrow("Betriebskontext");
  });

  it("uses insert and compare-and-set conflict semantics", async () => {
    const collection = createScopedTestCollection("file");
    const context = { businessId: "alpha" };

    await expect(collection.insert(context, { id: "same", value: "A", version: 1 })).resolves.toBe("created");
    await expect(collection.insert(context, { id: "same", value: "B", version: 1 })).resolves.toBe("exists");
    await expect(collection.compareAndSet(context, "same", 0, { id: "same", value: "B", version: 2 })).resolves.toBe("conflict");
    await expect(collection.compareAndSet(context, "same", 1, { id: "same", value: "B", version: 2 })).resolves.toBe("updated");
  });

  it("allows only one process to update from the same file-backed version", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-multiprocess-cas-"));
    dataRoots.push(rootDir);
    const context = { businessId: "alpha" };
    const collection = createBusinessScopedPersistentCollection<ScopedRecord>({
      collectionName: "multiprocess-records",
      getId: (record) => record.id,
      rootDir
    });
    await collection.insert(context, { id: "same", value: "initial", version: 1 });

    const pauseClaimPath = path.join(rootDir, "pause.claim");
    const pauseReadyPath = path.join(rootDir, "pause.ready");
    const releasePath = path.join(rootDir, "pause.release");
    const writerA = startCasWorker({
      rootDir,
      writer: "A",
      pauseClaimPath,
      pauseReadyPath,
      releasePath,
      checkedPath: path.join(rootDir, "writer-a.checked")
    });
    expect(await waitForFile(pauseReadyPath, 5_000)).toBe(true);

    const writerB = startCasWorker({
      rootDir,
      writer: "B",
      pauseClaimPath,
      pauseReadyPath,
      releasePath,
      checkedPath: path.join(rootDir, "writer-b.checked")
    });
    await waitForFile(path.join(rootDir, "writer-b.checked"), 1_000);
    writeFileSync(releasePath, "release");

    const results = await Promise.all([writerA.result, writerB.result]);
    expect(results.map(({ result }) => result).sort()).toEqual(["conflict", "updated"]);
    await expect(collection.get(context, "same")).resolves.toMatchObject({ version: 2 });
  }, 15_000);

  it("reclaims an abandoned file lock before compare-and-set", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-abandoned-cas-lock-"));
    dataRoots.push(rootDir);
    const context = { businessId: "alpha" };
    const collection = createBusinessScopedPersistentCollection<ScopedRecord>({
      collectionName: "abandoned-lock-records",
      getId: (record) => record.id,
      rootDir
    });
    await collection.insert(context, { id: "same", value: "initial", version: 1 });
    const recordPath = path.join(rootDir, "businesses", "alpha", "abandoned-lock-records", "same.json");
    const lockPath = `${recordPath}.lock`;
    writeFileSync(lockPath, "not-valid-lock-metadata");
    const oldTime = new Date(Date.now() - 60_000);
    utimesSync(lockPath, oldTime, oldTime);

    await expect(collection.compareAndSet(context, "same", 1, { id: "same", value: "updated", version: 2 })).resolves.toBe("updated");
    expect(existsSync(lockPath)).toBe(false);
  });

  it("backfills a legacy postgres offer revision before compare-and-set", async () => {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool();
    await pool.query("CREATE TABLE catering_schema_migrations (unit_name TEXT PRIMARY KEY, version_number INTEGER NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("INSERT INTO catering_schema_migrations (unit_name, version_number) VALUES ('catering_business_records', 2)");
    await pool.query("CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, version_number INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
    await pool.query("INSERT INTO catering_business_records (business_id, collection_name, record_id, payload, version_number) VALUES ('alpha', 'offers/drafts', 'offer-1', '{\"id\":\"offer-1\",\"revision\":1}', NULL)");
    const collection = createBusinessScopedPersistentCollection<{ id: string; revision: number }>({
      collectionName: "offers/drafts",
      getId: (record) => record.id,
      getVersion: (record) => record.revision,
      pgPool: pool
    });

    await expect(collection.compareAndSet(
      { businessId: "alpha" },
      "offer-1",
      1,
      { id: "offer-1", revision: 2 }
    )).resolves.toBe("updated");
    const stored = await pool.query("SELECT payload, version_number FROM catering_business_records WHERE record_id = 'offer-1'");
    expect(stored.rows[0]).toMatchObject({ payload: { id: "offer-1", revision: 2 }, version_number: 2 });
    const migration = await pool.query("SELECT version_number FROM catering_schema_migrations WHERE unit_name = 'catering_business_records'");
    expect(migration.rows[0]?.version_number).toBe(3);
  });
});
