import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
function sanitizeKey(key) {
    return encodeURIComponent(key);
}
function parsePayload(value) {
    return typeof value === "string" ? JSON.parse(value) : value;
}
const poolCache = new Map();
const initCache = new WeakMap();
function getCachedPool(connectionString) {
    const existing = poolCache.get(connectionString);
    if (existing) {
        return existing;
    }
    const config = {
        connectionString
    };
    const pool = new Pool(config);
    poolCache.set(connectionString, pool);
    return pool;
}
export function resolveDataRoot(rootDir) {
    return rootDir ?? process.env.CATERING_DATA_ROOT ?? path.join(process.cwd(), "data");
}
export function resolveDatabaseUrl(databaseUrl) {
    return (databaseUrl ??
        process.env.CATERING_DATABASE_URL ??
        process.env.DATABASE_URL);
}
class FileBackedCollection {
    directory;
    items = new Map();
    getId;
    validate;
    constructor(options) {
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
    async list() {
        this.syncFromDisk();
        return [...this.items.entries()]
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([, value]) => value);
    }
    async get(id) {
        this.syncFromDisk();
        return this.items.get(id);
    }
    async set(item) {
        const normalized = this.validate ? this.validate(item) : item;
        const id = this.getId(normalized);
        this.items.set(id, normalized);
        this.writeToDisk(id, normalized);
    }
    ensureSeed(seed) {
        for (const item of seed) {
            const normalized = this.validate ? this.validate(item) : item;
            const id = this.getId(normalized);
            if (!this.items.has(id)) {
                this.items.set(id, normalized);
                this.writeToDisk(id, normalized);
            }
        }
    }
    syncFromDisk() {
        this.items.clear();
        if (!existsSync(this.directory)) {
            return;
        }
        const filenames = readdirSync(this.directory).filter((filename) => filename.endsWith(".json"));
        for (const filename of filenames) {
            const filePath = path.join(this.directory, filename);
            const raw = readFileSync(filePath, "utf8");
            const parsed = JSON.parse(raw);
            const normalized = this.validate ? this.validate(parsed) : parsed;
            this.items.set(this.getId(normalized), normalized);
        }
    }
    writeToDisk(id, item) {
        const filePath = path.join(this.directory, `${sanitizeKey(id)}.json`);
        writeFileSync(filePath, JSON.stringify(item, null, 2));
    }
}
class PostgresBackedCollection {
    queryable;
    collectionName;
    getId;
    validate;
    seed;
    constructor(queryable, options) {
        this.queryable = queryable;
        this.collectionName = options.collectionName;
        this.getId = options.getId;
        this.validate = options.validate;
        this.seed = options.seed;
    }
    async list() {
        await this.ensureInitialized();
        const result = await this.queryable.query(`
        SELECT payload
        FROM catering_records
        WHERE collection_name = $1
        ORDER BY record_id
      `, [this.collectionName]);
        return result.rows.map((row) => {
            const parsed = parsePayload(row.payload);
            return this.validate ? this.validate(parsed) : parsed;
        });
    }
    async get(id) {
        await this.ensureInitialized();
        const result = await this.queryable.query(`
        SELECT payload
        FROM catering_records
        WHERE collection_name = $1 AND record_id = $2
        LIMIT 1
      `, [this.collectionName, id]);
        const row = result.rows[0];
        if (!row) {
            return undefined;
        }
        const parsed = parsePayload(row.payload);
        return this.validate ? this.validate(parsed) : parsed;
    }
    async set(item) {
        await this.ensureInitialized();
        const normalized = this.validate ? this.validate(item) : item;
        await this.queryable.query(`
        INSERT INTO catering_records (collection_name, record_id, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (collection_name, record_id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `, [this.collectionName, this.getId(normalized), JSON.stringify(normalized)]);
    }
    async ensureInitialized() {
        const key = this.queryable;
        if (!initCache.has(key)) {
            initCache.set(key, this.queryable.query(`
            CREATE TABLE IF NOT EXISTS catering_records (
              collection_name TEXT NOT NULL,
              record_id TEXT NOT NULL,
              payload JSONB NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (collection_name, record_id)
            )
          `).then(async () => {
                if (!this.seed || this.seed.length === 0) {
                    return;
                }
                for (const item of this.seed) {
                    const normalized = this.validate ? this.validate(item) : item;
                    await this.queryable.query(`
                INSERT INTO catering_records (collection_name, record_id, payload, updated_at)
                VALUES ($1, $2, $3::jsonb, NOW())
                ON CONFLICT (collection_name, record_id)
                DO NOTHING
              `, [
                        this.collectionName,
                        this.getId(normalized),
                        JSON.stringify(normalized)
                    ]);
                }
            }));
        }
        await initCache.get(key);
    }
}
export function createPersistentCollection(options) {
    const databaseUrl = resolveDatabaseUrl(options.databaseUrl);
    const queryable = options.pgPool ??
        (databaseUrl ? getCachedPool(databaseUrl) : undefined);
    if (queryable) {
        return new PostgresBackedCollection(queryable, options);
    }
    return new FileBackedCollection(options);
}
