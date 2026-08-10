import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuditLogStore } from "../shared-core/src/audit-log.js";
import type { AuditEntry } from "../shared-core/src/types.js";
import { runLocalBusinessScopeMigration } from "../scripts/migrate-local-business-scope.js";
import { createPersistentCollection } from "../shared-core/src/persistence.js";

const dataRoots: string[] = [];

afterEach(async () => {
  await Promise.all(dataRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

describe("local business scope migration", () => {
  it("copies legacy audit records once and preserves the source", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-business-migration-"));
    dataRoots.push(rootDir);
    const legacyAudit = createPersistentCollection<Omit<AuditEntry, "businessId">>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir
    });
    await legacyAudit.set({
      auditId: "audit-legacy-1",
      at: "2026-08-10T00:00:00.000Z",
      action: "legacy.audit",
      entityType: "Legacy",
      entityId: "legacy-1",
      actor: { name: "Operator", source: "test" },
      summary: "legacy entry"
    });

    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [{ name: "stage-a-001-audit", status: "migrated" }]
    });
    await expect(runLocalBusinessScopeMigration({ rootDir, businessId: "local" })).resolves.toMatchObject({
      units: [{ name: "stage-a-001-audit", status: "already_migrated" }]
    });

    await expect(legacyAudit.list()).resolves.toHaveLength(1);
    await expect(new AuditLogStore({ rootDir }).listRecentFor({ businessId: "local" }, 10)).resolves.toHaveLength(1);
  });
});
