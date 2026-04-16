import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductionApp } from "../production-service/src/app.js";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

const auditOperatorName = "Betriebs-/Audit-Operator";
const offerOperatorName = "Angebots-Mitarbeiter";

describe("P4 audit and review traceability", () => {
  it("shows production seed-demo actions in the audit feed", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot });

    try {
      const seedResponse = await app.inject({
        method: "POST",
        url: "/v1/production/seed-demo",
        headers: {
          "x-actor-name": auditOperatorName
        }
      });

      expect(seedResponse.statusCode).toBe(201);

      const auditResponse = await app.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=20",
        headers: {
          "x-actor-name": auditOperatorName
        }
      });

      expect(auditResponse.statusCode).toBe(200);
      const items = auditResponse.json().items as Array<Record<string, unknown>>;
      const seedEntry = items.find((entry) => entry.action === "production.seed_demo");

      expect(seedEntry).toBeDefined();
      expect(seedEntry?.entityType).toBe("SeedBatch");
      expect(seedEntry?.actor && typeof seedEntry.actor === "object" ? (seedEntry.actor as Record<string, unknown>).name : undefined).toBe(
        auditOperatorName
      );
      expect(String(seedEntry?.summary ?? "")).toContain("Produktions-Demoplaene angelegt");
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("shows a production recipe review action in the shared audit feed", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot });

    try {
      const importResponse = await app.inject({
        method: "POST",
        url: "/v1/production/recipes/import-text",
        payload: {
          recipeName: "P4 Audit Trace Recipe",
          text: [
            "P4 Audit Trace Recipe",
            "Ingredients",
            "1 apple",
            "Instructions",
            "1. Chop the apple.",
            "2. Serve immediately."
          ].join("\n")
        }
      });

      expect(importResponse.statusCode).toBe(201);
      const recipeId = importResponse.json().recipe.recipeId as string;

      const reviewResponse = await app.inject({
        method: "PATCH",
        url: `/v1/production/recipes/${recipeId}/review`,
        headers: {
          "x-actor-name": "Produktions-Mitarbeiter"
        },
        payload: {
          decision: "approve"
        }
      });

      expect(reviewResponse.statusCode).toBe(200);
      expect(reviewResponse.json().recipe.source.approvalState).toBe("approved_internal");

      const auditResponse = await app.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=20",
        headers: {
          "x-actor-name": auditOperatorName
        }
      });

      expect(auditResponse.statusCode).toBe(200);
      const items = auditResponse.json().items as Array<Record<string, unknown>>;
      const reviewEntry = items.find((entry) => entry.action === "recipe.reviewed" && entry.entityId === recipeId);

      expect(reviewEntry).toBeDefined();
      expect(reviewEntry?.entityType).toBe("Recipe");
      expect(reviewEntry?.actor && typeof reviewEntry.actor === "object" ? (reviewEntry.actor as Record<string, unknown>).name : undefined).toBe(
        "Produktions-Mitarbeiter"
      );
      expect(String(reviewEntry?.summary ?? "")).toContain("ueber den Produktions-Workflow geprueft");
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
