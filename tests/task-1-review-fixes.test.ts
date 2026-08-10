import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import { createBusinessScopedPersistentCollection, createPersistentCollection } from "../shared-core/src/persistence.js";
import { runLocalBusinessScopeMigration } from "../scripts/migrate-local-business-scope.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

function root(): string {
  const value = mkdtempSync(path.join(tmpdir(), "task-1-review-"));
  roots.push(value);
  return value;
}

function collection(mode: "file" | "postgres", validate?: (record: Record<string, unknown>) => Record<string, unknown>) {
  if (mode === "postgres") {
    const { Pool } = newDb().adapters.createPg();
    return createBusinessScopedPersistentCollection({ collectionName: "review-records", getId: (record) => String(record.id), pgPool: new Pool(), validate });
  }
  return createBusinessScopedPersistentCollection({ collectionName: "review-records", getId: (record) => String(record.id), rootDir: root(), validate });
}

describe("Task 1 review fixes", () => {
  it.each([buildIntakeApp, buildOfferApp, buildProductionApp, buildPrintExportApp])("keeps every service hard-disabled for hosted construction", (build) => {
    expect(() => build({ env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: "secret" } } as never)).toThrow("Hosted Multi-Business-Betrieb ist noch nicht bereit");
  });

  it("binds an intake audit to the builder business context instead of process env", async () => {
    const dataRoot = root();
    const app = buildIntakeApp({ rootDir: dataRoot, env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_DEV_AUTH: "true" } });
    try {
      await app.inject({ method: "POST", url: "/v1/intake/seed-demo", headers: { "x-actor-name": "Betriebs-/Audit-Operator" } });
      expect((await app.inject({ method: "GET", url: "/health" })).json().counts.auditEvents).toBeGreaterThan(0);
    } finally { await app.close(); }
  });

  it.each(["file", "postgres"] as const)("enforces canonical payload and CAS parity in %s", async (mode) => {
    const context = { businessId: "alpha" };
    const scoped = collection(mode);
    await expect(scoped.set(context, { id: "bad", version: 1, businessId: 123 })).rejects.toThrow("Betriebskontext");
    await scoped.set(context, { id: "same", version: "bad" });
    await expect(scoped.compareAndSet(context, "same", 1, { id: "same", version: 2 })).resolves.toBe("conflict");
    await expect(scoped.compareAndSet(context, "missing", 1, { id: "missing", version: 2 })).resolves.toBe("missing");
  });

  it.each(["file", "postgres"] as const)("checks payload identity after validation in %s", async (mode) => {
    const scoped = collection(mode, (record) => ({ ...record, businessId: "beta" }));
    await expect(scoped.insert({ businessId: "alpha" }, { id: "same", version: 1 })).rejects.toThrow("Betriebskontext");
  });

  it("records migration completion independently for each business", async () => {
    const dataRoot = root();
    const legacy = createPersistentCollection<{ auditId: string; at: string }>({ collectionName: "audit/events", getId: (entry) => entry.auditId, rootDir: dataRoot });
    await legacy.set({ auditId: "legacy", at: "2026-08-10T00:00:00.000Z" });
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "alpha" })).resolves.toMatchObject({ units: [{ status: "migrated" }] });
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "beta" })).resolves.toMatchObject({ units: [{ status: "migrated" }] });
  });

  it("leaves no false file record after an injected pre-publish failure", async () => {
    const dataRoot = root();
    const options = { collectionName: "fault-records", getId: (record: { id: string }) => record.id, rootDir: dataRoot };
    const failing = createBusinessScopedPersistentCollection({ ...options, fileFaultInjector: () => { throw new Error("stop"); } });
    await expect(failing.insert({ businessId: "alpha" }, { id: "same" })).rejects.toThrow("stop");
    const retry = createBusinessScopedPersistentCollection(options);
    await expect(retry.insert({ businessId: "alpha" }, { id: "same" })).resolves.toBe("created");
  });

  it("retries after record publication when manifest publication was interrupted", async () => {
    const dataRoot = root();
    const legacy = createPersistentCollection<{ auditId: string; at: string }>({ collectionName: "audit/events", getId: (entry) => entry.auditId, rootDir: dataRoot });
    await legacy.set({ auditId: "legacy", at: "2026-08-10T00:00:00.000Z" });
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "alpha", faultInjector: (phase) => { if (phase === "before_manifest_publish") throw new Error("stop"); } })).rejects.toThrow("stop");
    await expect(runLocalBusinessScopeMigration({ rootDir: dataRoot, businessId: "alpha" })).resolves.toMatchObject({ units: [{ status: "migrated" }] });
  });
});
