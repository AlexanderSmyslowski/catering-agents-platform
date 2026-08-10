import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createBusinessScopedPersistentCollection, type Queryable } from "../shared-core/src/persistence.js";

const connectionString = process.env.CATERING_TEST_POSTGRES_URL;
const describeWithPostgres = connectionString ? describe : describe.skip;
const schemaMigrationLock = [1_128_355_397, 2] as const;
const pool = connectionString ? new Pool({ connectionString }) : undefined;

interface VersionedRecord {
  id: string;
  version: number;
}

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function withIsolatedSchema(
  name: string,
  run: (first: PoolClient, second: PoolClient, schema: string) => Promise<void>
): Promise<void> {
  const schema = `task1_h8_${name}_${process.pid}_${Date.now()}`;
  await pool!.query(`CREATE SCHEMA ${quotedIdentifier(schema)}`);
  const first = await pool!.connect();
  const second = await pool!.connect();
  try {
    await first.query(`SET search_path TO ${quotedIdentifier(schema)}`);
    await second.query(`SET search_path TO ${quotedIdentifier(schema)}`);
    await run(first, second, schema);
  } finally {
    first.release();
    second.release();
    await pool!.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
  }
}

function collection(queryable: Queryable) {
  return createBusinessScopedPersistentCollection<VersionedRecord>({
    collectionName: "concurrency",
    getId: (record) => record.id,
    pgPool: queryable
  });
}

async function schemaVersion(client: PoolClient): Promise<number | undefined> {
  const table = await client.query("SELECT to_regclass('catering_schema_migrations') AS name");
  if (!table.rows[0]?.name) return undefined;
  const result = await client.query(
    "SELECT version_number FROM catering_schema_migrations WHERE unit_name = 'catering_business_records'"
  );
  return result.rows[0]?.version_number;
}

describeWithPostgres("PostgreSQL scoped-record schema v3 concurrency", () => {
  it("serializes two fresh-schema initializers from separate sessions", async () => {
    await withIsolatedSchema("fresh", async (first, second) => {
      let initializersStarted = 0;
      let releaseInitializers!: () => void;
      const bothInitializersStarted = new Promise<void>((resolve) => { releaseInitializers = resolve; });
      const queryable = (client: PoolClient): Queryable => ({
        async query(sql, params) {
          if (sql.includes("pg_advisory_xact_lock")) {
            initializersStarted += 1;
            if (initializersStarted === 2) releaseInitializers();
            await bothInitializersStarted;
          }
          const result = await client.query(sql, params);
          if (sql.startsWith("SELECT 1 FROM information_schema.tables")) {
            initializersStarted += 1;
            if (initializersStarted === 2) releaseInitializers();
            await bothInitializersStarted;
          }
          return result;
        }
      });

      await expect(Promise.all([
        collection(queryable(first)).list({ businessId: "alpha" }),
        collection(queryable(second)).list({ businessId: "alpha" })
      ])).resolves.toEqual([[], []]);
      await expect(schemaVersion(first)).resolves.toBe(3);
    });
  });

  it("serializes two old-schema backfills and records version 3 once", async () => {
    await withIsolatedSchema("old", async (first, second) => {
      await first.query("CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
      const versions: Array<[string, unknown, number | null]> = [
        ["zero", 0, 0],
        ["one", 1, 1],
        ["max", 2_147_483_647, 2_147_483_647],
        ["missing", undefined, null],
        ["null", null, null],
        ["string", "1", null],
        ["text", "not-a-number", null],
        ["fraction", 1.5, null],
        ["negative", -1, null],
        ["overflow", 2_147_483_648, null]
      ];
      for (const [id, version] of versions) {
        const payload = version === undefined ? { id } : { id, version };
        await first.query(
          "INSERT INTO catering_business_records (business_id, collection_name, record_id, payload) VALUES ('alpha', 'concurrency', $1, $2::jsonb)",
          [id, JSON.stringify(payload)]
        );
      }
      await first.query(
        "INSERT INTO catering_business_records (business_id, collection_name, record_id, payload) VALUES ('alpha', 'concurrency', 'revision-one', '{\"id\":\"revision-one\",\"revision\":1}')"
      );
      let initializersStarted = 0;
      let releaseInitializers!: () => void;
      const bothInitializersStarted = new Promise<void>((resolve) => { releaseInitializers = resolve; });
      const queryable = (client: PoolClient): Queryable => ({
        async query(sql, params) {
          if (sql.includes("pg_advisory_xact_lock")) {
            initializersStarted += 1;
            if (initializersStarted === 2) releaseInitializers();
            await bothInitializersStarted;
          }
          const result = await client.query(sql, params);
          if (sql.startsWith("SELECT business_id, collection_name, record_id, payload, version_number")) {
            initializersStarted += 1;
            if (initializersStarted === 2) releaseInitializers();
            await bothInitializersStarted;
          }
          return result;
        }
      });

      await expect(Promise.all([
        collection(queryable(first)).list({ businessId: "alpha" }),
        collection(queryable(second)).list({ businessId: "alpha" })
      ])).resolves.toHaveLength(2);
      await expect(schemaVersion(first)).resolves.toBe(3);
      const markers = await first.query("SELECT count(*)::integer AS count FROM catering_schema_migrations WHERE unit_name = 'catering_business_records'");
      expect(markers.rows[0]?.count).toBe(1);
      const stored = await first.query("SELECT record_id, version_number FROM catering_business_records ORDER BY record_id");
      expect(Object.fromEntries(stored.rows.map((row) => [row.record_id, row.version_number]))).toEqual(
        {
          ...Object.fromEntries(versions.map(([id, , expected]) => [id, expected])),
          "revision-one": 1
        }
      );
    });
  });

  it("does not overwrite a regular set started during the version-3 backfill", async () => {
    await withIsolatedSchema("writer", async (migratorClient, writerClient) => {
      await migratorClient.query("CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
      await migratorClient.query("INSERT INTO catering_business_records (business_id, collection_name, record_id, payload) VALUES ('alpha', 'concurrency', 'same', '{\"id\":\"same\",\"version\":1}')");
      await migratorClient.query("SELECT pg_advisory_lock($1, $2)", [...schemaMigrationLock]);

      let migrationMode: "legacy" | "serialized" | undefined;
      let releaseMigrationPoint!: () => void;
      const migrationPointReached = new Promise<void>((resolve) => { releaseMigrationPoint = resolve; });
      let releaseWriterQuery!: () => void;
      const writerQueryStarted = new Promise<void>((resolve) => { releaseWriterQuery = resolve; });
      let releaseWriterCompleted!: () => void;
      const writerCompleted = new Promise<void>((resolve) => { releaseWriterCompleted = resolve; });

      const migratorQueryable: Queryable = {
        async query(sql, params) {
          if (sql.includes("pg_advisory_xact_lock")) {
            migrationMode = "serialized";
            releaseMigrationPoint();
            await writerQueryStarted;
            return migratorClient.query(sql, params);
          }
          const result = await migratorClient.query(sql, params);
          if (sql.startsWith("SELECT business_id, collection_name, record_id, payload, version_number")) {
            migrationMode = "legacy";
            releaseMigrationPoint();
            await writerCompleted;
          }
          return result;
        }
      };
      const writerQueryable: Queryable = {
        async query(sql, params) {
          if (migrationMode === "legacy") {
            if (sql.startsWith("SELECT 1 FROM information_schema.tables")) return { rows: [{ column: 1 }] };
            if (sql.startsWith("SELECT business_id, collection_name, record_id, payload, version_number")) return { rows: [] };
          }
          if (sql.includes("pg_advisory_xact_lock") || sql.startsWith("INSERT INTO catering_business_records")) {
            releaseWriterQuery();
          }
          const result = await writerClient.query(sql, params);
          if (sql.startsWith("INSERT INTO catering_business_records")) releaseWriterCompleted();
          return result;
        }
      };

      const migration = collection(migratorQueryable).list({ businessId: "alpha" });
      await migrationPointReached;
      const writer = collection(writerQueryable).set({ businessId: "alpha" }, { id: "same", version: 2 });
      await writerQueryStarted;
      await migration;
      await migratorClient.query("SELECT pg_advisory_unlock($1, $2)", [...schemaMigrationLock]);
      await writer;

      const stored = await migratorClient.query("SELECT payload, version_number FROM catering_business_records WHERE record_id = 'same'");
      expect(stored.rows[0]?.payload).toMatchObject({ version: 2 });
      expect(stored.rows[0]?.version_number).toBe(2);
      await expect(schemaVersion(migratorClient)).resolves.toBe(3);
    });
  });

  it("rolls back the table change, backfill, and version marker together", async () => {
    await withIsolatedSchema("rollback", async (first) => {
      await first.query("CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
      await first.query("INSERT INTO catering_business_records (business_id, collection_name, record_id, payload) VALUES ('alpha', 'concurrency', 'same', '{\"id\":\"same\",\"version\":1}')");
      await first.query("CREATE FUNCTION reject_backfill() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'reject backfill'; END $$");
      await first.query("CREATE TRIGGER reject_backfill BEFORE UPDATE ON catering_business_records FOR EACH ROW EXECUTE FUNCTION reject_backfill()");

      await expect(collection(first).list({ businessId: "alpha" })).rejects.toThrow("reject backfill");
      const versionColumn = await first.query("SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'catering_business_records' AND column_name = 'version_number'");
      expect(versionColumn.rows).toHaveLength(0);
      await expect(schemaVersion(first)).resolves.toBeUndefined();
    });
  });
});

afterAll(async () => {
  await pool?.end();
});
