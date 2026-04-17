import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

describe("P1 minimal role guards", () => {
  it("rejects the new intake mutation paths without the intake operator role", async () => {
    const app = buildIntakeApp(new IntakeStore());
    const blockedActor = "Angebots-Mitarbeiter";

    for (const { method, url } of [
      { method: "POST", url: "/v1/intake/normalize" },
      { method: "POST", url: "/v1/intake/documents" },
      { method: "POST", url: "/v1/intake/documents/upload" },
      { method: "POST", url: "/v1/intake/specs/manual" },
      { method: "PATCH", url: "/v1/intake/specs/spec-123" }
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: {
          "x-actor-name": blockedActor
        },
        payload: method === "PATCH" ? { eventType: "Meeting" } : undefined
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        message: "Intake-Operator erforderlich."
      });
    }

    await app.close();
  });

  it("rejects the new offer mutation paths without the offer operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildOfferApp({ rootDir: dataRoot });
    const blockedActor = "Intake-Mitarbeiter";

    for (const { method, url, message } of [
      { method: "POST", url: "/v1/offers/drafts", message: "Angebots-Operator erforderlich." },
      { method: "POST", url: "/v1/offers/from-text", message: "Angebots-Operator erforderlich." },
      { method: "POST", url: "/v1/offers/recipes/import-text", message: "Angebots-Operator erforderlich." },
      { method: "POST", url: "/v1/offers/recipes/upload", message: "Angebots-Operator erforderlich." },
      { method: "POST", url: "/v1/offers/seed-demo", message: "Betriebs-/Audit-Operator erforderlich." }
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: {
          "x-actor-name": blockedActor
        },
        payload: method === "POST" && url === "/v1/offers/drafts" ? { requestId: "request-1", source: { channel: "text", receivedAt: new Date().toISOString() }, rawInputs: [] } : undefined
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ message });
    }

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("rejects the new production mutation paths without the production operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot });
    const blockedActor = "Angebots-Mitarbeiter";

    for (const { method, url } of [
      { method: "POST", url: "/v1/production/plans" },
      { method: "POST", url: "/v1/production/recipes/import-text" },
      { method: "POST", url: "/v1/production/recipes/upload" }
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: {
          "x-actor-name": blockedActor
        },
        payload: method === "POST" && url === "/v1/production/plans" ? { eventSpec: { specId: "spec-123" } } : undefined
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        message: "Produktions-Operator erforderlich."
      });
    }

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });
});
