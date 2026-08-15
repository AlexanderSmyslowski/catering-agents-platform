import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createLegacyMigrationReader
} from "../shared-core/src/persistence.js";
import * as sharedCore from "../shared-core/src/index.js";

const forbiddenLegacyImports = [
  "createPersistentCollection",
  "createLegacyMigrationReader"
];

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function importedLegacySymbols(source: string): string[] {
  return [...source.matchAll(/import[\s\S]*?from\s+["'][^"']*persistence(?:\.[cm]?[jt]s)?["'];?/g)]
    .flatMap(([statement]) =>
      forbiddenLegacyImports.filter((symbol) => new RegExp(`\\b${symbol}\\b`).test(statement))
    );
}

describe("unscoped persistence import boundary", () => {
  it("keeps writable legacy persistence out of product code and the public barrel", () => {
    const productionRoots = [
      "offer-service",
      "intake-service",
      "production-service",
      "backoffice-ui",
      "scripts"
    ];
    const violations = productionRoots.flatMap((root) =>
      sourceFiles(path.resolve(root))
        .filter((filePath) => filePath !== path.resolve("scripts/migrate-local-business-scope.ts"))
        .flatMap((filePath) =>
          importedLegacySymbols(readFileSync(filePath, "utf8")).map(
            (symbol) => `${path.relative(process.cwd(), filePath)} imports ${symbol}`
          )
        )
    );

    expect(violations).toEqual([]);
    expect(sharedCore).toHaveProperty("createBusinessScopedPersistentCollection");
    expect(sharedCore).not.toHaveProperty("createPersistentCollection");
    expect(sharedCore).not.toHaveProperty("createLegacyMigrationReader");
  });

  it("provides migration code a reader with no writable collection methods", async () => {
    const reader = createLegacyMigrationReader<{ recordId: string }>({
      collectionName: "boundary/legacy-reader",
      getId: (record) => record.recordId,
      rootDir: path.join(tmpdir(), `unscoped-persistence-import-boundary-${randomUUID()}`)
    });

    expect(await reader.list()).toEqual([]);
    expect(await reader.get("missing")).toBeUndefined();
    expect(reader).not.toHaveProperty("set");
    expect(reader).not.toHaveProperty("insert");
  });

  it("does not forward a legacy seed into the read-only migration reader", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), `unscoped-persistence-reader-seed-${randomUUID()}-`));
    // Adversarial runtime input bypasses the static type so the boundary also proves sanitization.
    const reader = createLegacyMigrationReader<{ recordId: string }>(
      {
        collectionName: "boundary/legacy-reader-seed",
        getId: (record: { recordId: string }) => record.recordId,
        rootDir,
        // Keep this contract on the file-backed reader even when a suite-wide database env leaks in.
        databaseUrl: "",
        seed: [{ recordId: "must-not-be-written" }]
      } as never
    );

    expect(await reader.list()).toEqual([]);
    expect(readdirSync(path.join(rootDir, "boundary/legacy-reader-seed"))).toEqual([]);
  });
});
