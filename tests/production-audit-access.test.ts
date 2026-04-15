import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductionApp } from "../production-service/src/app.js";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

describe("production audit access", () => {
  it("rejects the audit feed without the audit operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot });

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
    const app = buildProductionApp({ dataRoot });

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
    const app = buildProductionApp({ dataRoot });

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
});
