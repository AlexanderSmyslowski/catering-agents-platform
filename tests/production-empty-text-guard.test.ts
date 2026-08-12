import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IntakeStore, buildIntakeApp } from "@catering/intake-service";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-production-empty-text-"));
}

describe("production text intake server guard", () => {
  it.each(["", " \n\t "])("rejects %j without creating records or audit events", async (text) => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/intake/normalize",
        payload: { text }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({ message: "Bitte Beschreibung eingeben" });
      expect((await app.inject({ method: "GET", url: "/v1/intake/requests" })).json().items).toEqual([]);
      expect((await app.inject({ method: "GET", url: "/v1/intake/specs" })).json().items).toEqual([]);
      expect((await app.inject({ method: "GET", url: "/health" })).json().counts).toMatchObject({
        requests: 0,
        acceptedSpecs: 0,
        auditEvents: 0
      });
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("keeps the existing non-empty normalization path operational", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/intake/normalize",
        payload: { text: "Lunch fuer 40 Personen mit Tomatensuppe." }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().acceptedEventSpec.specId).toEqual(expect.any(String));
      expect((await app.inject({ method: "GET", url: "/v1/intake/requests" })).json().items).toHaveLength(1);
      expect((await app.inject({ method: "GET", url: "/v1/intake/specs" })).json().items).toHaveLength(1);
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
