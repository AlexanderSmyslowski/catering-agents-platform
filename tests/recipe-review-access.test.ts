import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

describe("recipe review access", () => {
  it("rejects offer recipe review without the offer operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildOfferApp({ rootDir: dataRoot });

    const response = await app.inject({
      method: "PATCH",
      url: "/v1/offers/recipes/recipe-123/review",
      headers: {
        "x-actor-name": "Intake-Mitarbeiter"
      },
      payload: {
        decision: "approve"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "Angebots-Operator erforderlich."
    });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("rejects production recipe review without the production operator role", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot });

    const response = await app.inject({
      method: "PATCH",
      url: "/v1/production/recipes/recipe-123/review",
      headers: {
        "x-actor-name": "Angebots-Mitarbeiter"
      },
      payload: {
        decision: "approve"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      message: "Produktions-Operator erforderlich."
    });

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });
});
