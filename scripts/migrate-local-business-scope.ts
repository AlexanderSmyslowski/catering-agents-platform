import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertBusinessId, type AuditEntry } from "../shared-core/src/index.js";
import {
  createBusinessScopedPersistentCollection,
  createPersistentCollection,
  resolveDataRoot,
  type CollectionStorageOptions
} from "../shared-core/src/persistence.js";

interface MigrationManifest {
  completed: Record<string, { completedAt: string; sourceCount: number; targetCount: number; hash: string }>;
}

interface MigrationUnitResult {
  name: "stage-a-001-audit";
  status: "migrated" | "already_migrated";
}

export interface LocalBusinessScopeMigrationOptions extends CollectionStorageOptions {
  businessId: string;
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

function manifestPath(options: LocalBusinessScopeMigrationOptions): string {
  return path.join(resolveDataRoot(options.rootDir), "migrations", "business-scope-manifest.json");
}

function readManifest(options: LocalBusinessScopeMigrationOptions): MigrationManifest {
  const filePath = manifestPath(options);
  return existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, "utf8")) as MigrationManifest
    : { completed: {} };
}

function writeManifest(options: LocalBusinessScopeMigrationOptions, manifest: MigrationManifest): void {
  const filePath = manifestPath(options);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(manifest, null, 2));
}

export async function runLocalBusinessScopeMigration(options: LocalBusinessScopeMigrationOptions): Promise<{ units: MigrationUnitResult[] }> {
  const businessId = assertBusinessId(options.businessId);
  const manifest = readManifest(options);
  const name = "stage-a-001-audit" as const;
  if (manifest.completed[name]) return { units: [{ name, status: "already_migrated" }] };

  const legacy = createPersistentCollection<AuditEntry>({
    collectionName: "audit/events",
    getId: (entry) => entry.auditId,
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });
  const target = createBusinessScopedPersistentCollection<AuditEntry>({
    collectionName: "audit/events",
    getId: (entry) => entry.auditId,
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
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

  manifest.completed[name] = {
    completedAt: new Date().toISOString(),
    sourceCount: sourceEntries.length,
    targetCount: targetEntries.length,
    hash: actualHash
  };
  writeManifest(options, manifest);
  return { units: [{ name, status: "migrated" }] };
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
