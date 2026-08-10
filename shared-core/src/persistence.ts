import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readdirSync,
  readFileSync,
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
  validate?: (value: T) => T;
  seed?: T[];
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
    if (typeof embeddedBusinessId === "string" && embeddedBusinessId !== context.businessId) {
      throw new Error("Payload passt nicht zum vertrauenswürdigen Betriebskontext.");
    }
  }
  return item;
}

function versionOf(value: unknown): number | undefined {
  if (value && typeof value === "object" && typeof (value as { version?: unknown }).version === "number") {
    return (value as { version: number }).version;
  }
  return undefined;
}

class FileBackedBusinessScopedCollection<T> implements BusinessScopedPersistentCollection<T> {
  constructor(private readonly options: PersistentCollectionOptions<T>) {}

  async list(context: BusinessContext): Promise<T[]> {
    const directory = this.directoryFor(context);
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
      .filter((filename) => filename.endsWith(".json"))
      .sort((left, right) => left.localeCompare(right))
      .map((filename) => this.normalize(JSON.parse(readFileSync(path.join(directory, filename), "utf8")) as T));
  }

  async get(context: BusinessContext, id: string): Promise<T | undefined> {
    const filePath = this.filePathFor(context, id);
    if (!existsSync(filePath)) return undefined;
    return this.normalize(JSON.parse(readFileSync(filePath, "utf8")) as T);
  }

  async set(context: BusinessContext, item: T): Promise<void> {
    const normalized = this.normalize(assertScopedPayload(context, item));
    const filePath = this.filePathFor(context, this.options.getId(normalized));
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(normalized, null, 2));
  }

  async insert(context: BusinessContext, item: T): Promise<"created" | "exists"> {
    const normalized = this.normalize(assertScopedPayload(context, item));
    const filePath = this.filePathFor(context, this.options.getId(normalized));
    mkdirSync(path.dirname(filePath), { recursive: true });
    try {
      const fd = openSync(filePath, "wx");
      try {
        writeFileSync(fd, JSON.stringify(normalized, null, 2));
      } finally {
        closeSync(fd);
      }
      return "created";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
      throw error;
    }
  }

  async compareAndSet(context: BusinessContext, id: string, expectedVersion: number, item: T): Promise<"updated" | "conflict" | "missing"> {
    const normalized = this.normalize(assertScopedPayload(context, item));
    const filePath = this.filePathFor(context, id);
    if (!existsSync(filePath)) return "missing";
    const existing = this.normalize(JSON.parse(readFileSync(filePath, "utf8")) as T);
    if (versionOf(existing) !== expectedVersion) return "conflict";
    writeFileSync(filePath, JSON.stringify(normalized, null, 2));
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
}

class PostgresBackedBusinessScopedCollection<T> implements BusinessScopedPersistentCollection<T> {
  constructor(private readonly queryable: Queryable, private readonly options: PersistentCollectionOptions<T>) {}

  async list(context: BusinessContext): Promise<T[]> {
    await this.ensureInitialized();
    const result = await this.queryable.query(
      "SELECT payload FROM catering_business_records WHERE business_id = $1 AND collection_name = $2 ORDER BY record_id",
      [assertBusinessId(context.businessId), this.options.collectionName]
    );
    return result.rows.map((row) => this.normalize(parsePayload<T>(row.payload)));
  }

  async get(context: BusinessContext, id: string): Promise<T | undefined> {
    await this.ensureInitialized();
    const result = await this.queryable.query(
      "SELECT payload FROM catering_business_records WHERE business_id = $1 AND collection_name = $2 AND record_id = $3 LIMIT 1",
      [assertBusinessId(context.businessId), this.options.collectionName, id]
    );
    return result.rows[0] ? this.normalize(parsePayload<T>(result.rows[0].payload)) : undefined;
  }

  async set(context: BusinessContext, item: T): Promise<void> {
    await this.ensureInitialized();
    const normalized = this.normalize(assertScopedPayload(context, item));
    await this.queryable.query(
      "INSERT INTO catering_business_records (business_id, collection_name, record_id, payload, updated_at) VALUES ($1, $2, $3, $4::jsonb, NOW()) ON CONFLICT (business_id, collection_name, record_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
      [assertBusinessId(context.businessId), this.options.collectionName, this.options.getId(normalized), JSON.stringify(normalized)]
    );
  }

  async insert(context: BusinessContext, item: T): Promise<"created" | "exists"> {
    await this.ensureInitialized();
    const normalized = this.normalize(assertScopedPayload(context, item));
    const result = await this.queryable.query(
      "INSERT INTO catering_business_records (business_id, collection_name, record_id, payload, updated_at) VALUES ($1, $2, $3, $4::jsonb, NOW()) ON CONFLICT DO NOTHING RETURNING record_id",
      [assertBusinessId(context.businessId), this.options.collectionName, this.options.getId(normalized), JSON.stringify(normalized)]
    );
    return result.rows.length === 1 ? "created" : "exists";
  }

  async compareAndSet(context: BusinessContext, id: string, expectedVersion: number, item: T): Promise<"updated" | "conflict" | "missing"> {
    await this.ensureInitialized();
    const normalized = this.normalize(assertScopedPayload(context, item));
    const businessId = assertBusinessId(context.businessId);
    const result = await this.queryable.query(
      "UPDATE catering_business_records SET payload = $4::jsonb, updated_at = NOW() WHERE business_id = $1 AND collection_name = $2 AND record_id = $3 AND (payload->>'version')::integer = $5 RETURNING record_id",
      [businessId, this.options.collectionName, id, JSON.stringify(normalized), expectedVersion]
    );
    if (result.rows.length === 1) return "updated";
    return (await this.get(context, id)) ? "conflict" : "missing";
  }

  private normalize(value: T): T {
    return this.options.validate ? this.options.validate(value) : value;
  }

  private async ensureInitialized(): Promise<void> {
    const key = this.queryable as object;
    const initializers = initCache.get(key) ?? new Map<string, Promise<void>>();
    initCache.set(key, initializers);
    if (!initializers.has("catering_business_records")) {
      initializers.set("catering_business_records", this.queryable.query(
        "CREATE TABLE IF NOT EXISTS catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))"
      ).then(() => undefined));
    }
    await initializers.get("catering_business_records");
  }
}

export function createBusinessScopedPersistentCollection<T>(options: PersistentCollectionOptions<T>): BusinessScopedPersistentCollection<T> {
  const databaseUrl = resolveDatabaseUrl(options.databaseUrl);
  const queryable = options.pgPool ?? (databaseUrl ? getCachedPool(databaseUrl) : undefined);
  return queryable
    ? new PostgresBackedBusinessScopedCollection(queryable, options)
    : new FileBackedBusinessScopedCollection(options);
}
