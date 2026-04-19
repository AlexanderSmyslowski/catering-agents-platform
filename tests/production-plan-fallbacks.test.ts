import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  buildProductionArtifacts,
  type WebRecipeSearchProvider
} from "@catering/production-service";
import {
  SCHEMA_VERSION,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";

class FakeWebProvider implements WebRecipeSearchProvider {
  constructor(private readonly candidates: WebRecipeCandidate[] | (() => Promise<WebRecipeCandidate[]>)) {}

  async searchRecipes(_query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    if (typeof this.candidates === "function") {
      return this.candidates();
    }

    return this.candidates;
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

function baseSpec(text: string): AcceptedEventSpec {
  const spec = normalizeEventRequestToSpec({
    schemaVersion: SCHEMA_VERSION,
    requestId: "plan-fallback-1",
    source: {
      channel: "text",
      receivedAt: "2026-03-10T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: text
      }
    ]
  });

  return {
    ...spec,
    menuPlan: spec.menuPlan.map((item) => ({
      ...item,
      menuCategory: item.menuCategory ?? "classic",
      productionDecision: item.productionDecision ?? { mode: "scratch" }
    }))
  };
}

function baseCandidate(): WebRecipeCandidate {
  return {
    url: "https://example.com/bread-baguette",
    title: "Bread & Baguette",
    recipe: {
      schemaVersion: SCHEMA_VERSION,
      recipeId: "",
      name: "Bread & Baguette",
      baseYield: {
        servings: 12,
        unit: "servings"
      },
      ingredients: [
        {
          ingredientId: "flour",
          name: "Wheat Flour",
          quantity: {
            amount: 500,
            unit: "g"
          },
          group: "dry_goods",
          purchaseUnit: "kg",
          normalizedUnit: "g"
        }
      ],
      steps: [
        {
          index: 1,
          instruction: "Bake the bread."
        }
      ],
      scalingRules: {
        defaultLossFactor: 1.05,
        batchSize: 12
      },
      allergens: [],
      dietTags: []
    },
    qualitySignals: {
      structuredData: true,
      hasYield: true,
      ingredientCount: 4,
      stepCount: 2,
      mappedIngredientRatio: 0.9
    }
  };
}

describe("production planning fallbacks", () => {
  it("returns a deterministic fallback when recipe discovery throws", async () => {
    const spec = baseSpec("Konferenz am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Mystery Bowl.");
    const discovery = {
      async resolveRecipe(): Promise<never> {
        throw new Error("simulated timeout");
      },
      async resolveRecipeOverride(): Promise<never> {
        throw new Error("simulated timeout");
      }
    } as unknown as RecipeDiscoveryService;

    const artifacts = await buildProductionArtifacts(spec, discovery);

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.fallbackReason).toContain("simulated timeout");
    expect(artifacts.productionPlan.blockingIssues?.length).toBeGreaterThan(0);
    expect(artifacts.productionPlan.warnings?.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
  });

  it("returns a deterministic fallback for malformed planning output", async () => {
    const spec = baseSpec("Konferenz am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Tomatensuppe.");
    const discovery = {
      async resolveRecipe(): Promise<any> {
        return {
          selection: {
            componentId: "broken-component"
          }
        };
      },
      async resolveRecipeOverride(): Promise<any> {
        return {
          selection: {
            componentId: "broken-component"
          }
        };
      }
    } as unknown as RecipeDiscoveryService;

    const artifacts = await buildProductionArtifacts(spec, discovery);

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.fallbackReason).toMatch(/ungültig/i);
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Planungsantwort");
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
  });

  it("marks incomplete planning as fallback when production decisions are missing", async () => {
    const spec = baseSpec("Konferenz am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Mystery Bowl.");
    spec.menuPlan = spec.menuPlan.map((item) => ({
      ...item,
      productionDecision: undefined
    }));
    const discovery = new RecipeDiscoveryService(
      new InMemoryRecipeRepository([], { rootDir: createDataRoot() }),
      new FakeWebProvider([])
    );

    const artifacts = await buildProductionArtifacts(spec, discovery);

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Herstellungsentscheidung");
    expect(artifacts.productionPlan.fallbackReason).toContain("Herstellungsentscheidung");
  });

  it("marks hard intake restriction conflicts as blocking fallback", async () => {
    const spec = baseSpec("Konferenz am 2026-06-01 fuer 40 Teilnehmer. Buffet mit BROT & BAGUETTE.");
    spec.productionConstraints = ["gluten_free"];
    spec.menuPlan = [
      {
        ...spec.menuPlan[0],
        label: "BROT & BAGUETTE",
        menuCategory: "classic",
        productionDecision: {
          mode: "hybrid",
          purchasedElements: ["Baguette"]
        }
      }
    ];

    const repository = new InMemoryRecipeRepository([], { rootDir: createDataRoot() });
    const discovery = new RecipeDiscoveryService(repository, new FakeWebProvider([baseCandidate()]));

    const artifacts = await buildProductionArtifacts(spec, discovery);

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.readiness.status).toBe("insufficient");
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("gluten_free");
    expect(artifacts.productionPlan.fallbackReason).toContain("gluten_free");
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
    expect(artifacts.productionPlan.recipeSelections).toHaveLength(1);
    expect(artifacts.productionPlan.recipeSelections[0].selectionReason).toContain("gluten_free");
    expect(artifacts.productionPlan.recipeSelections[0].autoUsedInternetRecipe).toBe(false);
    expect(artifacts.purchaseList.items).toHaveLength(0);
    expect(artifacts.purchaseList.totals.itemCount).toBe(0);
  });

  it("marks an invalid manual recipe assignment as a hard blocking issue", async () => {
    const spec = baseSpec("Konferenz am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Mystery Bowl.");
    spec.menuPlan = [
      {
        ...spec.menuPlan[0],
        label: "Mystery Bowl",
        menuCategory: "classic",
        recipeOverrideId: "missing-manual-recipe",
        productionDecision: {
          mode: "scratch"
        }
      }
    ];

    const repository = new InMemoryRecipeRepository([], { rootDir: createDataRoot() });
    const discovery = new RecipeDiscoveryService(repository, new FakeWebProvider([baseCandidate()]));

    const artifacts = await buildProductionArtifacts(spec, discovery);

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.readiness.status).toBe("insufficient");
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Rezeptzuweisung missing-manual-recipe für Mystery Bowl ist ungültig.");
    expect(artifacts.productionPlan.warnings ?? []).not.toContain(
      "Rezeptzuweisung missing-manual-recipe für Mystery Bowl ist ungültig."
    );
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
    expect(artifacts.purchaseList.items).toHaveLength(0);
    expect(artifacts.purchaseList.totals.itemCount).toBe(0);
  });
});
