import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  createBusinessScopedPersistentCollection,
  createPersistentCollection,
  establishLegacyCollectionWriteFence,
  type Queryable
} from "../shared-core/src/persistence.js";

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
  it("drains an in-flight legacy write before fencing every later raw write", async () => {
    await withIsolatedSchema("legacy_fence", async (migratorClient, writerClient) => {
      const legacy = createPersistentCollection<{ id: string }>({
        collectionName: "legacy/fenced",
        getId: (record) => record.id,
        pgPool: migratorClient
      });
      await legacy.set({ id: "before" });
      await writerClient.query("BEGIN");
      await writerClient.query(
        "INSERT INTO catering_records (collection_name, record_id, payload) VALUES ('legacy/fenced', 'in-flight', '{\"id\":\"in-flight\"}')"
      );

      let fenceSettled = false;
      const fence = establishLegacyCollectionWriteFence({
        collectionName: "legacy/fenced",
        pgPool: migratorClient
      }).finally(() => { fenceSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(fenceSettled).toBe(false);

      await writerClient.query("COMMIT");
      await fence;
      await expect(legacy.list()).resolves.toEqual([{ id: "before" }, { id: "in-flight" }]);
      await expect(writerClient.query(
        "INSERT INTO catering_records (collection_name, record_id, payload) VALUES ('legacy/fenced', 'late', '{\"id\":\"late\"}')"
      )).rejects.toThrow("fenced for business-scope migration");
    });
  });

  it("rejects moving a record out of a fenced collection", async () => {
    await withIsolatedSchema("legacy_fence_move", async (migratorClient, writerClient) => {
      const legacy = createPersistentCollection<{ id: string }>({
        collectionName: "legacy/fenced",
        getId: (record) => record.id,
        pgPool: migratorClient
      });
      await legacy.set({ id: "before" });
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/fenced", pgPool: migratorClient });

      await expect(writerClient.query(
        "UPDATE catering_records SET collection_name = 'legacy/open' WHERE collection_name = 'legacy/fenced' AND record_id = 'before'"
      )).rejects.toThrow("fenced for business-scope migration");
      await expect(legacy.list()).resolves.toEqual([{ id: "before" }]);
    });
  });

  it("installs a relation-local guard in two simultaneously live schemas", async () => {
    const suffix = `${process.pid}_${Date.now()}`;
    const firstSchema = `task1_h8_fence_s1_${suffix}`;
    const secondSchema = `task1_h8_fence_s2_${suffix}`;
    await pool!.query(`CREATE SCHEMA ${quotedIdentifier(firstSchema)}`);
    await pool!.query(`CREATE SCHEMA ${quotedIdentifier(secondSchema)}`);
    const first = await pool!.connect();
    const second = await pool!.connect();
    try {
      await first.query(`SET search_path TO ${quotedIdentifier(firstSchema)}`);
      await second.query(`SET search_path TO ${quotedIdentifier(secondSchema)}`);
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/fenced", pgPool: first });
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/fenced", pgPool: second });

      await expect(first.query(
        "INSERT INTO catering_records (collection_name, record_id, payload) VALUES ('legacy/fenced', 'late-s1', '{\"id\":\"late-s1\"}')"
      )).rejects.toThrow("fenced for business-scope migration");
      await expect(second.query(
        "INSERT INTO catering_records (collection_name, record_id, payload) VALUES ('legacy/fenced', 'late-s2', '{\"id\":\"late-s2\"}')"
      )).rejects.toThrow("fenced for business-scope migration");
      const triggerCount = await pool!.query(
        `SELECT count(*)::integer AS count
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE t.tgname = 'catering_legacy_collection_write_guard'
           AND n.nspname = ANY($1::text[])`,
        [[firstSchema, secondSchema]]
      );
      expect(triggerCount.rows[0]?.count).toBe(2);
    } finally {
      first.release();
      second.release();
      await pool!.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(firstSchema)} CASCADE`);
      await pool!.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(secondSchema)} CASCADE`);
    }
  });

  it("uses the fenced table schema when a differently scoped session writes through a qualified name", async () => {
    const suffix = `${process.pid}_${Date.now()}`;
    const fencedSchema = `task1_h8_fence_target_${suffix}`;
    const writerSchema = `task1_h8_fence_writer_${suffix}`;
    await pool!.query(`CREATE SCHEMA ${quotedIdentifier(fencedSchema)}`);
    await pool!.query(`CREATE SCHEMA ${quotedIdentifier(writerSchema)}`);
    const migrator = await pool!.connect();
    const writer = await pool!.connect();
    try {
      await migrator.query(`SET search_path TO ${quotedIdentifier(fencedSchema)}`);
      await writer.query(`SET search_path TO ${quotedIdentifier(writerSchema)}`);
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/fenced", pgPool: migrator });
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/other", pgPool: writer });

      await expect(writer.query(
        `INSERT INTO ${quotedIdentifier(fencedSchema)}.catering_records (collection_name, record_id, payload)
         VALUES ('legacy/fenced', 'cross-schema-bypass', '{"id":"cross-schema-bypass"}')`
      )).rejects.toThrow("fenced for business-scope migration");
      await expect(writer.query(
        `INSERT INTO ${quotedIdentifier(fencedSchema)}.catering_records (collection_name, record_id, payload)
         VALUES ('legacy/open', 'cross-schema-open', '{"id":"cross-schema-open"}')`
      )).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      migrator.release();
      writer.release();
      await pool!.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(fencedSchema)} CASCADE`);
      await pool!.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(writerSchema)} CASCADE`);
    }
  });

  it("ignores a temporary shadow fence table when guarding a durable schema", async () => {
    await withIsolatedSchema("legacy_fence_temp_shadow", async (migratorClient, writerClient, schema) => {
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/fenced", pgPool: migratorClient });
      await writerClient.query(
        "CREATE TEMP TABLE catering_legacy_collection_write_fences (collection_name TEXT PRIMARY KEY)"
      );
      try {
        await expect(writerClient.query(
          `INSERT INTO ${quotedIdentifier(schema)}.catering_records (collection_name, record_id, payload)
           VALUES ('legacy/fenced', 'temp-shadow-bypass', '{"id":"temp-shadow-bypass"}')`
        )).rejects.toThrow("fenced for business-scope migration");
        await expect(writerClient.query(
          `INSERT INTO ${quotedIdentifier(schema)}.catering_records (collection_name, record_id, payload)
           VALUES ('legacy/open', 'temp-shadow-open', '{"id":"temp-shadow-open"}')`
        )).resolves.toMatchObject({ rowCount: 1 });
      } finally {
        await writerClient.query("DROP TABLE IF EXISTS pg_temp.catering_legacy_collection_write_fences");
      }
    });
  });

  it("participates in and can be rolled back with an existing caller transaction", async () => {
    await withIsolatedSchema("legacy_fence_nested", async (client) => {
      await client.query("BEGIN");
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/fenced", pgPool: client });
      await client.query("ROLLBACK");

      const relations = await client.query(
        "SELECT to_regclass('catering_records') AS records, to_regclass('catering_legacy_collection_write_fences') AS fences"
      );
      expect(relations.rows[0]).toEqual({ records: null, fences: null });
    });
  });

  it("keeps normal application and raw SQL writes working for unfenced collections", async () => {
    await withIsolatedSchema("legacy_fence_unfenced", async (migratorClient, writerClient) => {
      await establishLegacyCollectionWriteFence({ collectionName: "legacy/fenced", pgPool: migratorClient });
      const open = createPersistentCollection<{ id: string; value: string }>({
        collectionName: "legacy/open",
        getId: (record) => record.id,
        pgPool: writerClient
      });

      await open.set({ id: "application", value: "created" });
      await writerClient.query(
        "INSERT INTO catering_records (collection_name, record_id, payload) VALUES ('legacy/open', 'raw', '{\"id\":\"raw\",\"value\":\"created\"}')"
      );
      await writerClient.query(
        "UPDATE catering_records SET payload = '{\"id\":\"raw\",\"value\":\"updated\"}' WHERE collection_name = 'legacy/open' AND record_id = 'raw'"
      );
      await expect(open.list()).resolves.toEqual([
        { id: "application", value: "created" },
        { id: "raw", value: "updated" }
      ]);
      await writerClient.query("DELETE FROM catering_records WHERE collection_name = 'legacy/open' AND record_id = 'raw'");
      await expect(open.list()).resolves.toEqual([{ id: "application", value: "created" }]);
    });
  });

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
