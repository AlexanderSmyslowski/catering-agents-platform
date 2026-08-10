import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProductionApp, ProductionStore } from "@catering/production-service";
import { RecipeLibrary, type Recipe } from "@catering/shared-core";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function dataRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "task-4-scope-"));
  roots.push(root);
  return root;
}

function recipe(): Recipe {
  return {
    schemaVersion: "1.0",
    recipeId: "recipe-explicit-scope",
    name: "Explizites Testrezept",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "fixture:explicit-scope",
      retrievedAt: "2026-08-11T08:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: { servings: 10, unit: "Portionen" },
    ingredients: [{
      ingredientId: "ingredient-explicit-scope",
      name: "Testzutat",
      quantity: { amount: 1, unit: "kg" },
      group: "trockenware"
    }],
    steps: [{ index: 1, instruction: "Kontrolliert bereitstellen." }],
    scalingRules: { defaultLossFactor: 1 },
    allergens: [],
    dietTags: []
  };
}

describe("Task 4 explicit business scope and recipe seeding", () => {
  it("keeps normal recipe reads side-effect free for every business", async () => {
    const library = new RecipeLibrary({ rootDir: dataRoot() });
    const alpha = { businessId: "alpha" };
    const beta = { businessId: "beta" };

    expect(await library.list(alpha)).toEqual([]);
    expect(await library.findCandidates(alpha, { label: "Kein Treffer" })).toEqual([]);
    expect(await library.get(alpha, "missing-recipe")).toBeUndefined();
    expect(await library.list(alpha)).toEqual([]);
    expect(await library.list(beta)).toEqual([]);

    await library.insert(alpha, recipe());
    expect(await library.list(alpha)).toHaveLength(1);
    expect(await library.list(beta)).toEqual([]);
  });

  it("rejects context-free scoped store and recipe calls instead of falling back to local", async () => {
    const rootDir = dataRoot();
    const store = new ProductionStore({ rootDir });
    const library = new RecipeLibrary({ rootDir });

    await expect((store.listPlans as () => Promise<unknown>)()).rejects.toThrow("Betriebskontext");
    await expect((library.list as () => Promise<unknown>)()).rejects.toThrow("Betriebskontext");
    await expect((library.get as unknown as (id: string) => Promise<unknown>)("recipe-explicit-scope"))
      .rejects.toThrow("Betriebskontext");
  });

  it("rejects a trusted local business header that differs from the configured business", async () => {
    const app = buildProductionApp({
      dataRoot: dataRoot(),
      trustedActorSecret: "task-4-local-business-secret",
      env: { CATERING_DEFAULT_BUSINESS_ID: "local" }
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/production/drafts",
        headers: {
          "x-catering-actor-name": "Produktions-Mitarbeiter",
          "x-catering-business-id": "alpha",
          "x-catering-trusted-secret": "task-4-local-business-secret"
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toContain("konfigurierten Betrieb");
    } finally {
      await app.close();
    }
  });
});
