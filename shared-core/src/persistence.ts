import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  fsyncSync,
  linkSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";
import { assertBusinessId, type BusinessContext } from "./business-context.js";

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
}

function sanitizeKey(key: string): string {
  return encodeURIComponent(key);
}

function parsePayload<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
}

const poolCache = new Map<string, Pool>();
const initCache = new WeakMap<object, Map<string, Promise<void>>>();

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
      AND version_number >= 2
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

    INSERT INTO catering_schema_migrations (unit_name, version_number, completed_at)
    VALUES ('catering_business_records', 2, NOW())
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
  // pg-mem cannot parse PostgreSQL DO blocks; this adapter-only path mirrors schema v2 without becoming a production fallback.
  await createPgMemTable(queryable, "catering_schema_migrations", "CREATE TABLE catering_schema_migrations (unit_name TEXT PRIMARY KEY, version_number INTEGER NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await createPgMemTable(queryable, "catering_business_records", "CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, version_number INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
  await queryable.query("ALTER TABLE catering_business_records ADD COLUMN IF NOT EXISTS version_number INTEGER");
  await queryable.query("UPDATE catering_business_records SET version_number = (payload ->> 'version')::numeric::integer WHERE version_number IS NULL AND CASE WHEN payload -> 'version' BETWEEN '0'::jsonb AND '2147483647'::jsonb AND (payload -> 'version')::text <> 'null' THEN (payload ->> 'version')::numeric = (payload ->> 'version')::numeric::integer ELSE FALSE END");
  await queryable.query("INSERT INTO catering_schema_migrations (unit_name, version_number, completed_at) VALUES ('catering_business_records', 2, NOW()) ON CONFLICT (unit_name) DO UPDATE SET version_number = 2, completed_at = NOW()");
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

class FileBackedCollection<T> implements PersistentCollection<T> {
  private readonly directory: string;

  private readonly items = new Map<string, T>();

  private readonly getId: (item: T) => string;

  private readonly validate?: (value: T) => T;

  constructor(options: PersistentCollectionOptions<T>) {
    this.getId = options.getId;
    this.validate = options.validate;
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
    const normalized = this.validate ? this.validate(item) : item;
    const id = this.getId(normalized);
    this.items.set(id, normalized);
    this.writeToDisk(id, normalized);
  }

  private ensureSeed(seed: T[]): void {
    for (const item of seed) {
      const normalized = this.validate ? this.validate(item) : item;
      const id = this.getId(normalized);
      if (!this.items.has(id)) {
        this.items.set(id, normalized);
        this.writeToDisk(id, normalized);
      }
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
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as T;
      const normalized = this.validate ? this.validate(parsed) : parsed;
      this.items.set(this.getId(normalized), normalized);
    }
  }

  private writeToDisk(id: string, item: T): void {
    const filePath = path.join(this.directory, `${sanitizeKey(id)}.json`);
    writeFileSync(filePath, JSON.stringify(item, null, 2));
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
    await this.queryable.query(
      `
        INSERT INTO catering_records (collection_name, record_id, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (collection_name, record_id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [this.collectionName, this.getId(normalized), JSON.stringify(normalized)]
    );
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
                VALUES ($1, $2, $3::jsonb, NOW())
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
    atomicWrite(
      filePath,
      JSON.stringify(normalized, null, 2),
      () => this.options.fileFaultInjector?.("before_record_replace"),
      () => this.options.fileFaultInjector?.("after_record_replace")
    );
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
    const filePath = this.filePathFor(context, id);
    if (!existsSync(filePath)) return "missing";
    const existing = this.normalizeForContext(context, JSON.parse(readFileSync(filePath, "utf8")) as T, id);
    if (collectionVersion(existing, this.options.getVersion) !== expectedVersion) return "conflict";
    if (this.options.getId(normalized) !== id) throw new Error("Payload-ID passt nicht zum angeforderten Record.");
    atomicWrite(
      filePath,
      JSON.stringify(normalized, null, 2),
      () => this.options.fileFaultInjector?.("before_record_replace"),
      () => this.options.fileFaultInjector?.("after_record_replace")
    );
    return "updated";
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
    const schemaUnit = "catering_business_records:v2";
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
