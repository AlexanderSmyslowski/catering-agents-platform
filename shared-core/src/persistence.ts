import {
  constants,
  existsSync,
  fchmodSync,
  mkdirSync,
  openSync,
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";
import { assertBusinessId, type BusinessContext } from "./business-context.js";
import { areJsonValuesEqual } from "./json-equality.js";

export interface Queryable {
  query: (
    sql: string,
    params?: unknown[]
  ) => Promise<{
    rows: Array<Record<string, unknown>>;
  }>;
}

export interface CollectionStorageOptions {
  rootDir?: string;
  databaseUrl?: string;
  pgPool?: Queryable;
}

export interface PersistentCollectionOptions<T> extends CollectionStorageOptions {
  collectionName: string;
  getId: (item: T) => string;
  getVersion?: (item: T) => number | undefined;
  validate?: (value: T) => T;
  seed?: T[];
  fileFaultInjector?: (phase:
    | "before_record_publish"
    | "after_record_publish"
    | "before_record_replace"
    | "after_record_replace"
  ) => void;
}

export interface PersistentCollection<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  set(item: T): Promise<void>;
  insert(item: T): Promise<"created" | "exists">;
}

/**
 * Migration code can inspect pre-business-scope records, but cannot reopen
 * the retired global write path once scoped storage is active.
 */
export interface LegacyMigrationReader<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
}

function sanitizeKey(key: string): string {
  return encodeURIComponent(key);
}

function parsePayload<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
}

const poolCache = new Map<string, Pool>();
const initCache = new WeakMap<object, Map<string, Promise<void>>>();
const LEGACY_WRITE_FENCE_FILENAME = ".business-scope-migration-write-fence";
const LEGACY_WRITE_FENCE_TABLE = "catering_legacy_collection_write_fences";

const BUSINESS_RECORDS_SCHEMA_MIGRATION = `
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(1128355397, 2);

  CREATE TABLE IF NOT EXISTS catering_schema_migrations (
    unit_name TEXT PRIMARY KEY,
    version_number INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  IF NOT EXISTS (
    SELECT 1
    FROM catering_schema_migrations
    WHERE unit_name = 'catering_business_records'
      AND version_number >= 3
  ) THEN
    CREATE TABLE IF NOT EXISTS catering_business_records (
      business_id TEXT NOT NULL,
      collection_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      version_number INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (business_id, collection_name, record_id)
    );

    ALTER TABLE catering_business_records
      ADD COLUMN IF NOT EXISTS version_number INTEGER;

    UPDATE catering_business_records
    SET version_number = ((payload ->> 'version')::numeric)::integer
    WHERE version_number IS NULL
      AND CASE
        WHEN jsonb_typeof(payload -> 'version') = 'number' THEN
          CASE
            WHEN (payload ->> 'version')::numeric BETWEEN 0 AND 2147483647 THEN
              (payload ->> 'version')::numeric = trunc((payload ->> 'version')::numeric)
            ELSE FALSE
          END
        ELSE FALSE
      END;

    UPDATE catering_business_records
    SET version_number = ((payload ->> 'revision')::numeric)::integer
    WHERE version_number IS NULL
      AND NOT (payload ? 'version')
      AND CASE
        WHEN jsonb_typeof(payload -> 'revision') = 'number' THEN
          CASE
            WHEN (payload ->> 'revision')::numeric BETWEEN 0 AND 2147483647 THEN
              (payload ->> 'revision')::numeric = trunc((payload ->> 'revision')::numeric)
            ELSE FALSE
          END
        ELSE FALSE
      END;

    INSERT INTO catering_schema_migrations (unit_name, version_number, completed_at)
    VALUES ('catering_business_records', 3, NOW())
    ON CONFLICT (unit_name) DO UPDATE
    SET version_number = GREATEST(catering_schema_migrations.version_number, EXCLUDED.version_number),
        completed_at = NOW();
  END IF;
END
$migration$;
`;

function isPgMemDoParserError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const stack = error.stack ?? "";
  return stack.includes("node_modules/pg-mem/")
    && error.message.includes("invalid syntax")
    && error.message.includes("Unexpected input");
}

function isPgMemDuplicateRelation(error: unknown, relationName: string): boolean {
  if (!(error instanceof Error)) return false;
  return (error.stack ?? "").includes("node_modules/pg-mem/")
    && error.message.startsWith(`relation "${relationName}" already exists`);
}

async function createPgMemTable(queryable: Queryable, relationName: string, sql: string): Promise<void> {
  try {
    await queryable.query(sql);
  } catch (error) {
    if (!isPgMemDuplicateRelation(error, relationName)) throw error;
  }
}

async function runPgMemBusinessRecordsMigration(queryable: Queryable): Promise<void> {
  // pg-mem cannot parse PostgreSQL DO blocks; this adapter-only path mirrors schema v3 without becoming a production fallback.
  await createPgMemTable(queryable, "catering_schema_migrations", "CREATE TABLE catering_schema_migrations (unit_name TEXT PRIMARY KEY, version_number INTEGER NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await createPgMemTable(queryable, "catering_business_records", "CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, version_number INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
  await queryable.query("ALTER TABLE catering_business_records ADD COLUMN IF NOT EXISTS version_number INTEGER");
  await queryable.query("UPDATE catering_business_records SET version_number = (payload ->> 'version')::numeric::integer WHERE version_number IS NULL AND CASE WHEN payload -> 'version' BETWEEN '0'::jsonb AND '2147483647'::jsonb AND (payload -> 'version')::text <> 'null' THEN (payload ->> 'version')::numeric = (payload ->> 'version')::numeric::integer ELSE FALSE END");
  await queryable.query("UPDATE catering_business_records SET version_number = (payload ->> 'revision')::numeric::integer WHERE version_number IS NULL AND payload -> 'version' IS NULL AND CASE WHEN payload -> 'revision' BETWEEN '0'::jsonb AND '2147483647'::jsonb AND (payload -> 'revision')::text <> 'null' THEN (payload ->> 'revision')::numeric = (payload ->> 'revision')::numeric::integer ELSE FALSE END");
  await queryable.query("INSERT INTO catering_schema_migrations (unit_name, version_number, completed_at) VALUES ('catering_business_records', 3, NOW()) ON CONFLICT (unit_name) DO UPDATE SET version_number = 3, completed_at = NOW()");
}

async function runBusinessRecordsSchemaMigration(queryable: Queryable): Promise<void> {
  try {
    // One statement pins arbitrary pool/wrapper implementations to one PostgreSQL transaction and session.
    await queryable.query(BUSINESS_RECORDS_SCHEMA_MIGRATION);
  } catch (error) {
    if (!isPgMemDoParserError(error)) throw error;
    await runPgMemBusinessRecordsMigration(queryable);
  }
}

function getCachedPool(connectionString: string): Pool {
  const existing = poolCache.get(connectionString);
  if (existing) {
    return existing;
  }

  const config: PoolConfig = {
    connectionString
  };
  const pool = new Pool(config);
  poolCache.set(connectionString, pool);
  return pool;
}

export function resolveCollectionQueryable(options: CollectionStorageOptions): Queryable | undefined {
  if (options.pgPool) return options.pgPool;
  const databaseUrl = resolveDatabaseUrl(options.databaseUrl);
  return databaseUrl ? getCachedPool(databaseUrl) : undefined;
}

export function resolveDataRoot(rootDir?: string): string {
  return rootDir ?? process.env.CATERING_DATA_ROOT ?? path.join(process.cwd(), "data");
}

export function resolveDatabaseUrl(databaseUrl?: string): string | undefined {
  return (
    databaseUrl ??
    process.env.CATERING_DATABASE_URL ??
    process.env.DATABASE_URL
  );
}

function legacyWriteFencePath(directory: string): string {
  return path.join(directory, LEGACY_WRITE_FENCE_FILENAME);
}

function collectionWriteLockTarget(directory: string): string {
  return `${directory}.collection-write`;
}

function lstatIfPresent(filePath: string) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function ensureSafeCollectionDirectory(rootDir: string | undefined, collectionName: string): string {
  const root = path.resolve(resolveDataRoot(rootDir));
  mkdirSync(root, { recursive: true });
  const directory = path.resolve(root, collectionName);
  const relative = path.relative(root, directory);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Legacy collection path must remain beneath the data root.");
  }

  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const existing = lstatIfPresent(current);
    if (!existing) {
      mkdirSync(current);
      continue;
    }
    if (existing.isSymbolicLink()) {
      throw new Error(`Legacy collection path contains a symbolic link: ${current}`);
    }
    if (!existing.isDirectory()) {
      throw new Error(`Legacy collection path is not a directory: ${current}`);
    }
  }
  return directory;
}

function assertSafeCollectionEntries(directory: string): string[] {
  const filenames = readdirSync(directory);
  for (const filename of filenames) {
    const filePath = path.join(directory, filename);
    const stats = lstatSync(filePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Legacy collection entry is a symbolic link: ${filePath}`);
    }
    if (!stats.isFile()) {
      throw new Error(`Legacy collection entry is not a regular file: ${filePath}`);
    }
  }
  return filenames;
}

function establishFileLegacyWriteFence(options: CollectionStorageOptions & { collectionName: string }): void {
  const directory = ensureSafeCollectionDirectory(options.rootDir, options.collectionName);
  const releaseCollectionLock = acquireFileLock(collectionWriteLockTarget(directory));
  try {
    const filenames = assertSafeCollectionEntries(directory);
    const markerPath = legacyWriteFencePath(directory);
    if (!lstatIfPresent(markerPath)) {
      const markerFd = openSync(
        markerPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o444
      );
      try {
        writeFileSync(markerFd, "business-scope-migration-v1\n");
        fsyncSync(markerFd);
      } finally {
        closeSync(markerFd);
      }
      filenames.push(LEGACY_WRITE_FENCE_FILENAME);
    }

    for (const filename of filenames) {
      const filePath = path.join(directory, filename);
      const fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        fchmodSync(fd, 0o444);
      } finally {
        closeSync(fd);
      }
    }
    const directoryFd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      fchmodSync(directoryFd, 0o555);
      fsyncSync(directoryFd);
    } finally {
      closeSync(directoryFd);
    }
  } finally {
    releaseCollectionLock();
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function legacyWriteFenceMigrationSql(collectionName: string): string {
  const collection = sqlLiteral(collectionName);
  return `
DO $migration$
DECLARE
  target_schema TEXT := pg_catalog.current_schema();
BEGIN
  CREATE TABLE IF NOT EXISTS catering_records (
    collection_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_name, record_id)
  );

  CREATE TABLE IF NOT EXISTS ${LEGACY_WRITE_FENCE_TABLE} (
    collection_name TEXT PRIMARY KEY,
    fenced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE OR REPLACE FUNCTION catering_guard_legacy_collection_write()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $function$
  DECLARE
    first_collection TEXT;
    second_collection TEXT;
    fenced_collection TEXT;
  BEGIN
    IF TG_OP = 'UPDATE' THEN
      first_collection := LEAST(OLD.collection_name, NEW.collection_name);
      second_collection := GREATEST(OLD.collection_name, NEW.collection_name);
    ELSIF TG_OP = 'DELETE' THEN
      first_collection := OLD.collection_name;
    ELSE
      first_collection := NEW.collection_name;
    END IF;

    PERFORM pg_advisory_xact_lock(1128355397, hashtext(first_collection));
    IF second_collection IS NOT NULL AND second_collection <> first_collection THEN
      PERFORM pg_advisory_xact_lock(1128355397, hashtext(second_collection));
    END IF;

    EXECUTE pg_catalog.format(
      'SELECT collection_name FROM %I.${LEGACY_WRITE_FENCE_TABLE} WHERE collection_name = $1 OR collection_name = $2 ORDER BY collection_name LIMIT 1',
      TG_TABLE_SCHEMA
    )
    INTO fenced_collection
    USING first_collection, second_collection;
    IF fenced_collection IS NOT NULL THEN
      RAISE EXCEPTION 'Legacy collection % is fenced for business-scope migration', fenced_collection
        USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END
  $function$;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgname = 'catering_legacy_collection_write_guard'
      AND tgrelid = pg_catalog.to_regclass(
        pg_catalog.format('%I.%I', target_schema, 'catering_records')
      )
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER catering_legacy_collection_write_guard
      BEFORE INSERT OR UPDATE OR DELETE ON catering_records
      FOR EACH ROW EXECUTE FUNCTION catering_guard_legacy_collection_write();
  END IF;

  PERFORM pg_advisory_xact_lock(1128355397, hashtext(${collection}));
  INSERT INTO ${LEGACY_WRITE_FENCE_TABLE} (collection_name)
  VALUES (${collection})
  ON CONFLICT (collection_name) DO NOTHING;
END
$migration$;
`;
}

async function establishPgMemLegacyWriteFence(queryable: Queryable, collectionName: string): Promise<void> {
  // pg-mem has no PL/pgSQL triggers; current writers still exercise the same database-resident fence row.
  await createPgMemTable(queryable, "catering_records", "CREATE TABLE catering_records (collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (collection_name, record_id))");
  await createPgMemTable(queryable, LEGACY_WRITE_FENCE_TABLE, `CREATE TABLE ${LEGACY_WRITE_FENCE_TABLE} (collection_name TEXT PRIMARY KEY, fenced_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await queryable.query(
    `INSERT INTO ${LEGACY_WRITE_FENCE_TABLE} (collection_name) VALUES ($1) ON CONFLICT (collection_name) DO NOTHING`,
    [collectionName]
  );
}

export async function establishLegacyCollectionWriteFence(
  options: CollectionStorageOptions & {
    collectionName: string;
    legacyFileWritersQuiesced?: boolean;
    testOnlyAllowPgMemCooperativeFence?: boolean;
  }
): Promise<void> {
  const queryable = resolveCollectionQueryable(options);
  if (!queryable) {
    if (options.legacyFileWritersQuiesced !== true) {
      throw new Error("Legacy file writers must be confirmed quiescent before migration.");
    }
    establishFileLegacyWriteFence(options);
    return;
  }

  try {
    // One statement remains atomic both as its own transaction and inside a caller-owned transaction.
    await queryable.query(legacyWriteFenceMigrationSql(options.collectionName));
  } catch (error) {
    if (!isPgMemDoParserError(error)) throw error;
    if (options.testOnlyAllowPgMemCooperativeFence !== true) {
      throw new Error("Real PostgreSQL is required for raw-SQL migration fencing; the pg-mem cooperative fallback is test-only.");
    }
    await establishPgMemLegacyWriteFence(queryable, options.collectionName);
  }
}

class FileBackedCollection<T> implements PersistentCollection<T> {
  private readonly directory: string;

  private readonly items = new Map<string, T>();

  private readonly getId: (item: T) => string;

  private readonly validate?: (value: T) => T;

  private readonly fileFaultInjector?: PersistentCollectionOptions<T>["fileFaultInjector"];

  constructor(options: PersistentCollectionOptions<T>) {
    this.getId = options.getId;
    this.validate = options.validate;
    this.fileFaultInjector = options.fileFaultInjector;
    this.directory = path.join(resolveDataRoot(options.rootDir), options.collectionName);
    mkdirSync(this.directory, {
      recursive: true
    });
    this.syncFromDisk();
    if (options.seed && options.seed.length > 0) {
      this.ensureSeed(options.seed);
    }
  }

  async list(): Promise<T[]> {
    this.syncFromDisk();
    return [...this.items.entries()]
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .map(([, value]) => value);
  }

  async get(id: string): Promise<T | undefined> {
    this.syncFromDisk();
    return this.items.get(id);
  }

  async set(item: T): Promise<void> {
    const releaseCollectionLock = acquireFileLock(collectionWriteLockTarget(this.directory));
    try {
      this.assertWritable();
      const normalized = this.validate ? this.validate(item) : item;
      const id = this.getId(normalized);
      const filePath = path.join(this.directory, `${sanitizeKey(id)}.json`);
      const releaseRecordLock = acquireFileLock(filePath);
      try {
        atomicWrite(
          filePath,
          JSON.stringify(normalized, null, 2),
          () => this.fileFaultInjector?.("before_record_replace"),
          () => this.fileFaultInjector?.("after_record_replace")
        );
        this.items.set(id, normalized);
      } finally {
        releaseRecordLock();
      }
    } finally {
      releaseCollectionLock();
    }
  }

  async insert(item: T): Promise<"created" | "exists"> {
    const releaseCollectionLock = acquireFileLock(collectionWriteLockTarget(this.directory));
    try {
      this.assertWritable();
      const normalized = this.validate ? this.validate(item) : item;
      const id = this.getId(normalized);
      const filePath = path.join(this.directory, `${sanitizeKey(id)}.json`);
      const releaseRecordLock = acquireFileLock(filePath);
      try {
        const inserted = atomicInsert(
          filePath,
          JSON.stringify(normalized, null, 2),
          () => this.fileFaultInjector?.("before_record_publish"),
          () => this.fileFaultInjector?.("after_record_publish")
        );
        if (inserted === "created") this.items.set(id, normalized);
        return inserted;
      } finally {
        releaseRecordLock();
      }
    } finally {
      releaseCollectionLock();
    }
  }

  private ensureSeed(seed: T[]): void {
    for (const item of seed) {
      const normalized = this.validate ? this.validate(item) : item;
      const id = this.getId(normalized);
      if (!this.items.has(id)) {
        this.writeToDisk(id, normalized);
        this.items.set(id, normalized);
      }
    }
  }

  private assertWritable(): void {
    if (lstatIfPresent(legacyWriteFencePath(this.directory))) {
      throw new Error("Legacy collection is fenced for business-scope migration.");
    }
  }

  private syncFromDisk(): void {
    this.items.clear();
    if (!existsSync(this.directory)) {
      return;
    }

    const filenames = readdirSync(this.directory).filter((filename) =>
      filename.endsWith(".json")
    );

    for (const filename of filenames) {
      const filePath = path.join(this.directory, filename);
      const stats = lstatSync(filePath);
      if (stats.isSymbolicLink()) throw new Error(`Collection entry is a symbolic link: ${filePath}`);
      if (!stats.isFile()) throw new Error(`Collection entry is not a regular file: ${filePath}`);
      const fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      let raw: string;
      try {
        raw = readFileSync(fd, "utf8");
      } finally {
        closeSync(fd);
      }
      const parsed = JSON.parse(raw) as T;
      const normalized = this.validate ? this.validate(parsed) : parsed;
      this.items.set(this.getId(normalized), normalized);
    }
  }

  private writeToDisk(id: string, item: T): void {
    const releaseCollectionLock = acquireFileLock(collectionWriteLockTarget(this.directory));
    try {
      this.assertWritable();
      const filePath = path.join(this.directory, `${sanitizeKey(id)}.json`);
      const releaseRecordLock = acquireFileLock(filePath);
      try {
        atomicWrite(filePath, JSON.stringify(item, null, 2));
      } finally {
        releaseRecordLock();
      }
    } finally {
      releaseCollectionLock();
    }
  }

}

class PostgresBackedCollection<T> implements PersistentCollection<T> {
  private readonly collectionName: string;

  private readonly getId: (item: T) => string;

  private readonly validate?: (value: T) => T;

  private readonly seed?: T[];

  constructor(
    private readonly queryable: Queryable,
    options: PersistentCollectionOptions<T>
  ) {
    this.collectionName = options.collectionName;
    this.getId = options.getId;
    this.validate = options.validate;
    this.seed = options.seed;
  }

  async list(): Promise<T[]> {
    await this.ensureInitialized();
    const result = await this.queryable.query(
      `
        SELECT payload
        FROM catering_records
        WHERE collection_name = $1
        ORDER BY record_id
      `,
      [this.collectionName]
    );

    return result.rows.map((row) => {
      const parsed = parsePayload<T>(row.payload);
      return this.validate ? this.validate(parsed) : parsed;
    });
  }

  async get(id: string): Promise<T | undefined> {
    await this.ensureInitialized();
    const result = await this.queryable.query(
      `
        SELECT payload
        FROM catering_records
        WHERE collection_name = $1 AND record_id = $2
        LIMIT 1
      `,
      [this.collectionName, id]
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    const parsed = parsePayload<T>(row.payload);
    return this.validate ? this.validate(parsed) : parsed;
  }

  async set(item: T): Promise<void> {
    await this.ensureInitialized();
    const normalized = this.validate ? this.validate(item) : item;
    const result = await this.queryable.query(
      `
        INSERT INTO catering_records (collection_name, record_id, payload, updated_at)
        SELECT $1, $2, $3::jsonb, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM ${LEGACY_WRITE_FENCE_TABLE} WHERE collection_name = $1
        )
        ON CONFLICT (collection_name, record_id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
        RETURNING record_id
      `,
      [this.collectionName, this.getId(normalized), JSON.stringify(normalized)]
    );
    if (result.rows.length === 0) {
      throw new Error("Legacy collection is fenced for business-scope migration.");
    }
  }

  async insert(item: T): Promise<"created" | "exists"> {
    await this.ensureInitialized();
    const normalized = this.validate ? this.validate(item) : item;
    const result = await this.queryable.query(
      `
        INSERT INTO catering_records (collection_name, record_id, payload, updated_at)
        SELECT $1, $2, $3::jsonb, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM ${LEGACY_WRITE_FENCE_TABLE} WHERE collection_name = $1
        )
        ON CONFLICT DO NOTHING
        RETURNING record_id
      `,
      [this.collectionName, this.getId(normalized), JSON.stringify(normalized)]
    );
    if (result.rows.length === 1) return "created";
    const fenced = await this.queryable.query(
      `SELECT collection_name FROM ${LEGACY_WRITE_FENCE_TABLE} WHERE collection_name = $1`,
      [this.collectionName]
    );
    if (fenced.rows.length > 0) {
      throw new Error("Legacy collection is fenced for business-scope migration.");
    }
    return "exists";
  }

  private async ensureInitialized(): Promise<void> {
    const key = this.queryable as object;
    const initializers = initCache.get(key) ?? new Map<string, Promise<void>>();
    initCache.set(key, initializers);
    if (!initializers.has("catering_records")) {
      initializers.set(
        "catering_records",
        this.queryable.query(
          `
            CREATE TABLE IF NOT EXISTS catering_records (
              collection_name TEXT NOT NULL,
              record_id TEXT NOT NULL,
              payload JSONB NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (collection_name, record_id)
            );

            CREATE TABLE IF NOT EXISTS ${LEGACY_WRITE_FENCE_TABLE} (
              collection_name TEXT PRIMARY KEY,
              fenced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `
        ).then(async () => {
          if (!this.seed || this.seed.length === 0) {
            return;
          }

          for (const item of this.seed) {
            const normalized = this.validate ? this.validate(item) : item;
            await this.queryable.query(
              `
                INSERT INTO catering_records (collection_name, record_id, payload, updated_at)
                SELECT $1, $2, $3::jsonb, NOW()
                WHERE NOT EXISTS (
                  SELECT 1 FROM ${LEGACY_WRITE_FENCE_TABLE} WHERE collection_name = $1
                )
                ON CONFLICT (collection_name, record_id)
                DO NOTHING
              `,
              [
                this.collectionName,
                this.getId(normalized),
                JSON.stringify(normalized)
              ]
            );
          }
        })
      );
    }

    await initializers.get("catering_records");
  }
}

export function createPersistentCollection<T>(
  options: PersistentCollectionOptions<T>
): PersistentCollection<T> {
  const databaseUrl = resolveDatabaseUrl(options.databaseUrl);
  const queryable =
    options.pgPool ??
    (databaseUrl ? getCachedPool(databaseUrl) : undefined);

  if (queryable) {
    return new PostgresBackedCollection(queryable, options);
  }

  return new FileBackedCollection(options);
}

export function createLegacyMigrationReader<T>(
  options: PersistentCollectionOptions<T>
): LegacyMigrationReader<T> {
  const collection = createPersistentCollection(options);
  return {
    list: () => collection.list(),
    get: (id) => collection.get(id)
  };
}

export interface BusinessScopedPersistentCollection<T> {
  list(context: BusinessContext): Promise<T[]>;
  get(context: BusinessContext, id: string): Promise<T | undefined>;
  set(context: BusinessContext, item: T): Promise<void>;
  insert(context: BusinessContext, item: T): Promise<"created" | "exists">;
  compareAndSet(
    context: BusinessContext,
    id: string,
    expectedVersion: number,
    item: T
  ): Promise<"updated" | "conflict" | "missing">;
  compareAndSetExact(
    context: BusinessContext,
    id: string,
    expected: T,
    item: T
  ): Promise<"updated" | "conflict" | "missing">;
}

function assertScopedPayload<T>(context: BusinessContext, item: T): T {
  assertBusinessId(context.businessId);
  if (item && typeof item === "object" && "businessId" in item) {
    const embeddedBusinessId = (item as { businessId?: unknown }).businessId;
    if (embeddedBusinessId !== context.businessId) {
      throw new Error("Payload passt nicht zum vertrauenswürdigen Betriebskontext.");
    }
  }
  return item;
}

function fsyncDirectory(directory: string): void {
  const fd = openSync(directory, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function cleanupTemporaryFile(temporaryPath: string): void {
  if (!existsSync(temporaryPath)) return;
  unlinkSync(temporaryPath);
  fsyncDirectory(path.dirname(temporaryPath));
}

interface FileLockMetadata {
  token: string;
  pid: number;
  acquiredAt: string;
}

// The lock spans the version read and atomic rename; owner metadata lets a later process recover crash residue without stealing from a live writer.
const FILE_LOCK_RETRY_MS = 10;
const FILE_LOCK_TIMEOUT_MS = 30_000;
const INCOMPLETE_FILE_LOCK_GRACE_MS = 30_000;
const fileLockSleeper = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

function waitForFileLock(): void {
  Atomics.wait(fileLockSleeper, 0, 0, FILE_LOCK_RETRY_MS);
}

function readFileLockMetadata(lockPath: string): FileLockMetadata | undefined {
  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as Partial<FileLockMetadata>;
    if (
      typeof parsed.token !== "string"
      || !Number.isSafeInteger(parsed.pid)
      || Number(parsed.pid) <= 0
      || typeof parsed.acquiredAt !== "string"
    ) {
      return undefined;
    }
    return parsed as FileLockMetadata;
  } catch {
    return undefined;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isAbandonedFileLock(lockPath: string): boolean {
  const metadata = readFileLockMetadata(lockPath);
  if (metadata) return !isProcessRunning(metadata.pid);
  try {
    return Date.now() - statSync(lockPath).mtimeMs >= INCOMPLETE_FILE_LOCK_GRACE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function createFileLock(lockPath: string, token: string): boolean {
  let fd: number;
  try {
    fd = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }

  try {
    const metadata: FileLockMetadata = {
      token,
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    };
    writeFileSync(fd, JSON.stringify(metadata));
    fsyncSync(fd);
  } catch (error) {
    try {
      unlinkSync(lockPath);
    } catch (cleanupError) {
      if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") throw cleanupError;
    }
    throw error;
  } finally {
    closeSync(fd);
  }
  fsyncDirectory(path.dirname(lockPath));
  return true;
}

function releaseFileLock(lockPath: string, token: string): void {
  const metadata = readFileLockMetadata(lockPath);
  if (!metadata || metadata.token !== token) return;
  try {
    unlinkSync(lockPath);
    fsyncDirectory(path.dirname(lockPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function reclaimAbandonedFileLock(lockPath: string): boolean {
  if (!isAbandonedFileLock(lockPath)) return false;
  // Stale-lock cleanup is itself serialized so competing recoverers cannot both unlink the same ownership path.
  const recoveryPath = `${lockPath}.recovery`;
  const recoveryToken = randomUUID();
  if (!createFileLock(recoveryPath, recoveryToken)) {
    if (isAbandonedFileLock(recoveryPath)) {
      try {
        unlinkSync(recoveryPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return false;
  }

  try {
    if (!existsSync(lockPath) || !isAbandonedFileLock(lockPath)) return false;
    try {
      unlinkSync(lockPath);
      fsyncDirectory(path.dirname(lockPath));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      throw error;
    }
  } finally {
    releaseFileLock(recoveryPath, recoveryToken);
  }
}

function acquireFileLock(filePath: string): () => void {
  const lockPath = `${filePath}.lock`;
  const token = randomUUID();
  const deadline = Date.now() + FILE_LOCK_TIMEOUT_MS;
  while (!createFileLock(lockPath, token)) {
    if (reclaimAbandonedFileLock(lockPath)) continue;
    if (Date.now() >= deadline) {
      throw new Error(`Dateisperre konnte nicht innerhalb von ${FILE_LOCK_TIMEOUT_MS} ms erworben werden: ${filePath}`);
    }
    waitForFileLock();
  }
  return () => releaseFileLock(lockPath, token);
}

function atomicWrite(filePath: string, payload: string, beforePublish?: () => void, afterPublish?: () => void): void {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = openSync(temporaryPath, "wx");
    try {
      writeFileSync(fd, payload);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    beforePublish?.();
    renameSync(temporaryPath, filePath);
    // This local-storage contract requires a filesystem with directory fsync support (macOS/Linux).
    fsyncDirectory(path.dirname(filePath));
    afterPublish?.();
  } finally {
    cleanupTemporaryFile(temporaryPath);
  }
}

function atomicInsert(filePath: string, payload: string, beforePublish?: () => void, afterPublish?: () => void): "created" | "exists" {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = openSync(temporaryPath, "wx");
    try {
      writeFileSync(fd, payload);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    beforePublish?.();
    try {
      linkSync(temporaryPath, filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
      throw error;
    }
    cleanupTemporaryFile(temporaryPath);
    afterPublish?.();
    return "created";
  } finally {
    cleanupTemporaryFile(temporaryPath);
  }
}

function versionOf(value: unknown): number | undefined {
  if (value && typeof value === "object" && typeof (value as { version?: unknown }).version === "number") {
    const version = (value as { version: number }).version;
    if (Number.isSafeInteger(version) && version >= 0 && version <= 2_147_483_647) return version;
  }
  return undefined;
}

function collectionVersion<T>(value: T, getVersion?: (item: T) => number | undefined): number | undefined {
  return getVersion ? getVersion(value) : versionOf(value);
}

function assertIncomingVersion<T>(value: T, getVersion?: (item: T) => number | undefined): void {
  const hasVersion = getVersion !== undefined || (value && typeof value === "object" && "version" in value);
  const incomingVersion = collectionVersion(value, getVersion);
  if (hasVersion && (incomingVersion === undefined || !Number.isSafeInteger(incomingVersion) || incomingVersion < 0 || incomingVersion > 2_147_483_647)) {
    throw new Error("Version muss eine sichere nicht-negative Int32-Ganzzahl sein.");
  }
}

function assertExpectedVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new Error("Erwartete Version muss eine sichere nicht-negative Int32-Ganzzahl sein.");
  }
}

class FileBackedBusinessScopedCollection<T> implements BusinessScopedPersistentCollection<T> {
  constructor(private readonly options: PersistentCollectionOptions<T>) {}

  async list(context: BusinessContext): Promise<T[]> {
    const directory = this.directoryFor(context);
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
      .filter((filename) => filename.endsWith(".json"))
      .sort((left, right) => left.localeCompare(right))
      .map((filename) => this.normalizeForContext(context, JSON.parse(readFileSync(path.join(directory, filename), "utf8")) as T));
  }

  async get(context: BusinessContext, id: string): Promise<T | undefined> {
    const filePath = this.filePathFor(context, id);
    if (!existsSync(filePath)) return undefined;
    return this.normalizeForContext(context, JSON.parse(readFileSync(filePath, "utf8")) as T, id);
  }

  async set(context: BusinessContext, item: T): Promise<void> {
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalized, this.options.getVersion);
    const filePath = this.filePathFor(context, this.options.getId(normalized));
    mkdirSync(path.dirname(filePath), { recursive: true });
    const releaseLock = acquireFileLock(filePath);
    try {
      atomicWrite(
        filePath,
        JSON.stringify(normalized, null, 2),
        () => this.options.fileFaultInjector?.("before_record_replace"),
        () => this.options.fileFaultInjector?.("after_record_replace")
      );
    } finally {
      releaseLock();
    }
  }

  async insert(context: BusinessContext, item: T): Promise<"created" | "exists"> {
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalized, this.options.getVersion);
    const filePath = this.filePathFor(context, this.options.getId(normalized));
    mkdirSync(path.dirname(filePath), { recursive: true });
    return atomicInsert(
      filePath,
      JSON.stringify(normalized, null, 2),
      () => this.options.fileFaultInjector?.("before_record_publish"),
      () => this.options.fileFaultInjector?.("after_record_publish")
    );
  }

  async compareAndSet(context: BusinessContext, id: string, expectedVersion: number, item: T): Promise<"updated" | "conflict" | "missing"> {
    assertExpectedVersion(expectedVersion);
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalized, this.options.getVersion);
    if (this.options.getId(normalized) !== id) throw new Error("Payload-ID passt nicht zum angeforderten Record.");
    const filePath = this.filePathFor(context, id);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const releaseLock = acquireFileLock(filePath);
    try {
      if (!existsSync(filePath)) return "missing";
      const existing = this.normalizeForContext(context, JSON.parse(readFileSync(filePath, "utf8")) as T, id);
      if (collectionVersion(existing, this.options.getVersion) !== expectedVersion) return "conflict";
      atomicWrite(
        filePath,
        JSON.stringify(normalized, null, 2),
        () => this.options.fileFaultInjector?.("before_record_replace"),
        () => this.options.fileFaultInjector?.("after_record_replace")
      );
      return "updated";
    } finally {
      releaseLock();
    }
  }

  async compareAndSetExact(
    context: BusinessContext,
    id: string,
    expected: T,
    item: T
  ): Promise<"updated" | "conflict" | "missing"> {
    const normalizedExpected = this.normalizeForContext(context, expected);
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalizedExpected, this.options.getVersion);
    assertIncomingVersion(normalized, this.options.getVersion);
    if (this.options.getId(normalizedExpected) !== id || this.options.getId(normalized) !== id) {
      throw new Error("Payload-ID passt nicht zum angeforderten Record.");
    }
    const filePath = this.filePathFor(context, id);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const releaseLock = acquireFileLock(filePath);
    try {
      if (!existsSync(filePath)) return "missing";
      const existing = this.normalizeForContext(
        context,
        JSON.parse(readFileSync(filePath, "utf8")) as T,
        id
      );
      if (!areJsonValuesEqual(existing, normalizedExpected)) return "conflict";
      atomicWrite(
        filePath,
        JSON.stringify(normalized, null, 2),
        () => this.options.fileFaultInjector?.("before_record_replace"),
        () => this.options.fileFaultInjector?.("after_record_replace")
      );
      return "updated";
    } finally {
      releaseLock();
    }
  }

  private directoryFor(context: BusinessContext): string {
    const businessId = assertBusinessId(context.businessId);
    return path.join(resolveDataRoot(this.options.rootDir), "businesses", businessId, this.options.collectionName);
  }

  private filePathFor(context: BusinessContext, id: string): string {
    return path.join(this.directoryFor(context), `${sanitizeKey(id)}.json`);
  }

  private normalize(value: T): T {
    return this.options.validate ? this.options.validate(value) : value;
  }

  private normalizeForContext(context: BusinessContext, value: T, expectedId?: string): T {
    const normalized = assertScopedPayload(context, this.normalize(value));
    if (expectedId && this.options.getId(normalized) !== expectedId) throw new Error("Payload-ID passt nicht zum angeforderten Record.");
    return normalized;
  }
}

class PostgresBackedBusinessScopedCollection<T> implements BusinessScopedPersistentCollection<T> {
  constructor(private readonly queryable: Queryable, private readonly options: PersistentCollectionOptions<T>) {}

  async list(context: BusinessContext): Promise<T[]> {
    await this.ensureInitialized();
    const result = await this.queryable.query(
      "SELECT payload FROM catering_business_records WHERE business_id = $1 AND collection_name = $2 ORDER BY record_id",
      [assertBusinessId(context.businessId), this.options.collectionName]
    );
    return result.rows.map((row) => this.normalizeForContext(context, parsePayload<T>(row.payload)));
  }

  async get(context: BusinessContext, id: string): Promise<T | undefined> {
    await this.ensureInitialized();
    const result = await this.queryable.query(
      "SELECT payload FROM catering_business_records WHERE business_id = $1 AND collection_name = $2 AND record_id = $3 LIMIT 1",
      [assertBusinessId(context.businessId), this.options.collectionName, id]
    );
    return result.rows[0] ? this.normalizeForContext(context, parsePayload<T>(result.rows[0].payload), id) : undefined;
  }

  async set(context: BusinessContext, item: T): Promise<void> {
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalized, this.options.getVersion);
    await this.ensureInitialized();
    await this.queryable.query(
      "INSERT INTO catering_business_records (business_id, collection_name, record_id, payload, version_number, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, NOW()) ON CONFLICT (business_id, collection_name, record_id) DO UPDATE SET payload = EXCLUDED.payload, version_number = EXCLUDED.version_number, updated_at = NOW()",
      [assertBusinessId(context.businessId), this.options.collectionName, this.options.getId(normalized), JSON.stringify(normalized), collectionVersion(normalized, this.options.getVersion) ?? null]
    );
  }

  async insert(context: BusinessContext, item: T): Promise<"created" | "exists"> {
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalized, this.options.getVersion);
    await this.ensureInitialized();
    const result = await this.queryable.query(
      "INSERT INTO catering_business_records (business_id, collection_name, record_id, payload, version_number, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, NOW()) ON CONFLICT DO NOTHING RETURNING record_id",
      [assertBusinessId(context.businessId), this.options.collectionName, this.options.getId(normalized), JSON.stringify(normalized), collectionVersion(normalized, this.options.getVersion) ?? null]
    );
    return result.rows.length === 1 ? "created" : "exists";
  }

  async compareAndSet(context: BusinessContext, id: string, expectedVersion: number, item: T): Promise<"updated" | "conflict" | "missing"> {
    assertExpectedVersion(expectedVersion);
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalized, this.options.getVersion);
    if (this.options.getId(normalized) !== id) throw new Error("Payload-ID passt nicht zum angeforderten Record.");
    const businessId = assertBusinessId(context.businessId);
    await this.ensureInitialized();
    const result = await this.queryable.query(
      "UPDATE catering_business_records SET payload = $4::jsonb, version_number = $5, updated_at = NOW() WHERE business_id = $1 AND collection_name = $2 AND record_id = $3 AND version_number = $6 RETURNING record_id",
      [businessId, this.options.collectionName, id, JSON.stringify(normalized), collectionVersion(normalized, this.options.getVersion) ?? null, expectedVersion]
    );
    if (result.rows.length === 1) return "updated";
    return (await this.get(context, id)) ? "conflict" : "missing";
  }

  async compareAndSetExact(
    context: BusinessContext,
    id: string,
    expected: T,
    item: T
  ): Promise<"updated" | "conflict" | "missing"> {
    const normalizedExpected = this.normalizeForContext(context, expected);
    const normalized = this.normalizeForContext(context, item);
    assertIncomingVersion(normalizedExpected, this.options.getVersion);
    assertIncomingVersion(normalized, this.options.getVersion);
    if (this.options.getId(normalizedExpected) !== id || this.options.getId(normalized) !== id) {
      throw new Error("Payload-ID passt nicht zum angeforderten Record.");
    }
    const businessId = assertBusinessId(context.businessId);
    await this.ensureInitialized();
    const result = await this.queryable.query(
      "UPDATE catering_business_records SET payload = $4::jsonb, version_number = $5, updated_at = NOW() WHERE business_id = $1 AND collection_name = $2 AND record_id = $3 AND payload = $6::jsonb RETURNING record_id",
      [
        businessId,
        this.options.collectionName,
        id,
        JSON.stringify(normalized),
        collectionVersion(normalized, this.options.getVersion) ?? null,
        JSON.stringify(normalizedExpected)
      ]
    );
    if (result.rows.length === 1) return "updated";
    return (await this.get(context, id)) ? "conflict" : "missing";
  }

  private normalize(value: T): T {
    return this.options.validate ? this.options.validate(value) : value;
  }

  private normalizeForContext(context: BusinessContext, value: T, expectedId?: string): T {
    const normalized = assertScopedPayload(context, this.normalize(value));
    if (expectedId && this.options.getId(normalized) !== expectedId) throw new Error("Payload-ID passt nicht zum angeforderten Record.");
    return normalized;
  }

  private async ensureInitialized(): Promise<void> {
    const key = this.queryable as object;
    const initializers = initCache.get(key) ?? new Map<string, Promise<void>>();
    initCache.set(key, initializers);
    const schemaUnit = "catering_business_records:v3";
    if (!initializers.has(schemaUnit)) {
      initializers.set(schemaUnit, runBusinessRecordsSchemaMigration(this.queryable));
    }
    await initializers.get(schemaUnit);
  }
}

export function createBusinessScopedPersistentCollection<T>(options: PersistentCollectionOptions<T>): BusinessScopedPersistentCollection<T> {
  const databaseUrl = resolveDatabaseUrl(options.databaseUrl);
  const queryable = options.pgPool ?? (databaseUrl ? getCachedPool(databaseUrl) : undefined);
  return queryable
    ? new PostgresBackedBusinessScopedCollection(queryable, options)
    : new FileBackedBusinessScopedCollection(options);
}
