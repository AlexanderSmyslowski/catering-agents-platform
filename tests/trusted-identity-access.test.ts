import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductionApp } from "../production-service/src/app.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-trusted-identity-"));
}

const TRUSTED_SECRET = "test-shared-secret";
const SESSION_ROOT_SECRET = "trusted-identity-session-secret-20260828";

describe("trusted identity access guards", () => {
  it("rejects spoofed x-actor-name when a trusted identity secret is configured", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({
      dataRoot,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      trustedActorSecret: TRUSTED_SECRET
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/seed-demo",
      headers: {
        "x-actor-name": "Betriebs-/Audit-Operator"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "Betriebs-/Audit-Operator erforderlich."
    });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("accepts a trusted proxy actor header when the shared secret matches", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({
      dataRoot,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      trustedActorSecret: TRUSTED_SECRET
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/seed-demo",
      headers: {
        "x-catering-actor-name": "Betriebs-/Audit-Operator",
        "x-catering-trusted-secret": TRUSTED_SECRET
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ seeded: expect.any(Array) });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("keeps explicit dev/test x-actor-name compatibility only when dev auth is enabled", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({
      dataRoot,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      env: { CATERING_DEV_AUTH: "1" }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/seed-demo",
      headers: {
        "x-actor-name": "Betriebs-/Audit-Operator"
      }
    });

    expect(response.statusCode).toBe(201);

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("fails closed for x-actor-name when the session cookie is missing and dev auth is disabled", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot, trustedActorSecret: SESSION_ROOT_SECRET, env: {} });

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/seed-demo",
      headers: {
        "x-actor-name": "Betriebs-/Audit-Operator"
      }
    });

    expect(response.statusCode).toBe(401);

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("protects the read-only production audit feed behind trusted identity", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot, trustedActorSecret: TRUSTED_SECRET });

    const response = await app.inject({
      method: "GET",
      url: "/v1/production/audit/events?limit=1",
      headers: {
        "x-actor-name": "Betriebs-/Audit-Operator"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "Betriebs-/Audit-Operator erforderlich."
    });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });
});
