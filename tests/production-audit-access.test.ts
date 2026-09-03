import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductionApp } from "../production-service/src/app.js";
import { AuditLogStore } from "../shared-core/src/audit-log.js";

const TRUSTED_SECRET = "production-audit-access-secret";
const COMMERCIAL_SENTINEL = 9876.54;
const SUMMARY_COMMERCIAL_SENTINEL = "SUMMARY_COMMERCIAL_SENTINEL-12345.67-EUR";

function headersFor(actorName: string) {
  return {
    "x-catering-trusted-secret": TRUSTED_SECRET,
    "x-catering-actor-name": actorName,
    "x-catering-business-id": "local"
  };
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

function disposeDataRoot(dataRoot: string): void {
  try {
    execFileSync("/usr/bin/trash", [dataRoot], { stdio: "ignore" });
  } catch {
    // Test data is disposable; a sandbox denial must not turn cleanup into an irreversible delete.
  }
}

describe("production audit access", () => {
  it("rejects the audit feed without the audit operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot, env: { CATERING_DEV_AUTH: "1" } });

    const response = await app.inject({
      method: "GET",
      url: "/v1/production/audit/events?limit=10"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "Betriebs-/Audit-Operator erforderlich."
    });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("allows the audit feed with the audit operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot, env: { CATERING_DEV_AUTH: "1" } });

    const response = await app.inject({
      method: "GET",
      url: "/v1/production/audit/events?limit=10",
      headers: {
        "x-actor-name": "Betriebs-/Audit-Operator"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: []
    });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("rejects production seed demo without the audit operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot, env: { CATERING_DEV_AUTH: "1" } });

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/seed-demo"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "Betriebs-/Audit-Operator erforderlich."
    });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("redacts persisted audit summaries and details for audit operators without changing admin or storage evidence", async () => {
    const dataRoot = createDataRoot();
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const persisted = await auditLog.logFor({ businessId: "local" }, {
      action: "production.commercial_policy_checked",
      entityType: "ProductionDraft",
      entityId: "production-draft-commercial-sentinel",
      actor: {
        name: "Administrator",
        source: "trusted-proxy:x-catering-actor-name"
      },
      summary: `Kommerzielle Produktionsrichtlinie ${SUMMARY_COMMERCIAL_SENTINEL} geprüft.`,
      details: {
        policyMaximumEstimatedCostEur: COMMERCIAL_SENTINEL,
        commercialMarker: "COMMERCIAL_SENTINEL",
        reviewState: "checked"
      }
    });
    const app = buildProductionApp({
      dataRoot,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });

    try {
      const auditOperatorResponse = await app.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=10",
        headers: headersFor("Betriebs-/Audit-Operator")
      });

      expect(auditOperatorResponse.statusCode).toBe(200);
      const auditOperatorItems = auditOperatorResponse.json<{ items: Array<Record<string, unknown>> }>().items;
      expect(auditOperatorItems).toEqual([
        expect.objectContaining({
          auditId: persisted.auditId,
          action: persisted.action,
          entityType: persisted.entityType,
          entityId: persisted.entityId
        })
      ]);
      expect(auditOperatorItems[0]).not.toHaveProperty("summary");
      expect(auditOperatorItems[0]).not.toHaveProperty("details");
      expect(JSON.stringify(auditOperatorItems)).not.toContain(String(COMMERCIAL_SENTINEL));
      expect(JSON.stringify(auditOperatorItems)).not.toContain(SUMMARY_COMMERCIAL_SENTINEL);
      expect(JSON.stringify(auditOperatorItems)).not.toContain("policyMaximumEstimatedCostEur");
      expect(JSON.stringify(auditOperatorItems)).not.toContain("COMMERCIAL_SENTINEL");

      const adminResponse = await app.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=10",
        headers: headersFor("Administrator")
      });

      expect(adminResponse.statusCode).toBe(200);
      expect(adminResponse.json()).toEqual({ items: [persisted] });
      expect(await auditLog.getFor({ businessId: "local" }, persisted.auditId)).toEqual(persisted);
    } finally {
      await app.close();
      disposeDataRoot(dataRoot);
    }
  });
});
