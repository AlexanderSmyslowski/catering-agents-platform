import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
});
