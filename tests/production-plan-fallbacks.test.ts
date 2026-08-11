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
  type Recipe,
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

function dairyQuicheRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-dairy-quiche",
    name: "Quiche mit Sahne und Ei",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "house:dairy-quiche",
      retrievedAt: "2026-06-01T10:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.95,
      fitScore: 0.95,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 12,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "cream",
        name: "Sahne",
        quantity: {
          amount: 1,
          unit: "l"
        },
        group: "dairy"
      },
      {
        ingredientId: "eggs",
        name: "Eier",
        quantity: {
          amount: 12,
          unit: "pcs"
        },
        group: "protein"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Quiche backen."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: ["milk", "egg"],
    dietTags: ["vegetarian"]
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

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

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

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

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
      new InMemoryRecipeRepository({ rootDir: createDataRoot() }),
      new FakeWebProvider([])
    );

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Herstellungsentscheidung");
    expect(artifacts.productionPlan.fallbackReason).toContain("Herstellungsentscheidung");
  });

  it("treats Brot-Baguette without a production decision as a baker purchase", async () => {
    const spec = normalizeEventRequestToSpec({
      schemaVersion: SCHEMA_VERSION,
      requestId: "plan-baker-purchase-1",
      source: {
        channel: "text",
        receivedAt: "2026-03-10T10:00:00.000Z"
      },
      rawInputs: [
        {
          kind: "text",
          content: "Lunch am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Brot-Baguette."
        }
      ]
    });
    const discovery = {
      async resolveRecipe(): Promise<never> {
        throw new Error("Brot-Baguette should not trigger recipe discovery");
      },
      async resolveRecipeOverride(): Promise<never> {
        throw new Error("Brot-Baguette should not trigger recipe discovery");
      }
    } as unknown as RecipeDiscoveryService;

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

    expect(artifacts.productionPlan.isFallback).toBeFalsy();
    expect(artifacts.productionPlan.recipeSelections[0].selectionReason).toContain("Bäcker-Zukauf");
    expect(artifacts.productionPlan.recipeSelections[0].autoUsedInternetRecipe).toBe(false);
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
    expect(artifacts.productionPlan.kitchenSheets[0].procurementNotes?.join(" ")).toContain("Baguette, Brot");
    expect(artifacts.purchaseList.items.some((item) => item.displayName.includes("Baguette"))).toBe(true);
    expect(artifacts.purchaseList.items.some((item) => item.displayName.includes("Brot"))).toBe(true);
  });

  it("keeps gluten-free Brot-Baguette as a blocking clarification instead of auto-buying it", async () => {
    const spec = normalizeEventRequestToSpec({
      schemaVersion: SCHEMA_VERSION,
      requestId: "plan-baker-purchase-gluten-free-1",
      source: {
        channel: "text",
        receivedAt: "2026-03-10T10:00:00.000Z"
      },
      rawInputs: [
        {
          kind: "text",
          content: "Lunch am 2026-06-01 fuer 40 Teilnehmer. Bitte glutenfrei. Buffet mit Brot-Baguette."
        }
      ]
    });
    const discovery = {
      async resolveRecipe(): Promise<never> {
        throw new Error("Gluten-free Brot-Baguette should not trigger recipe discovery");
      },
      async resolveRecipeOverride(): Promise<never> {
        throw new Error("Gluten-free Brot-Baguette should not trigger recipe discovery");
      }
    } as unknown as RecipeDiscoveryService;

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.readiness.status).toBe("insufficient");
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("gluten_free");
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Bäcker-Zukauf");
    expect(artifacts.productionPlan.recipeSelections[0].selectionReason).toContain("Bäcker-Zukauf");
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
    expect(artifacts.purchaseList.items).toHaveLength(0);
  });

  it("keeps Focaccia as a human clarification case instead of auto-buying or recipe-searching it", async () => {
    const spec = normalizeEventRequestToSpec({
      schemaVersion: SCHEMA_VERSION,
      requestId: "plan-focaccia-hybrid-clarification-1",
      source: {
        channel: "text",
        receivedAt: "2026-03-10T10:00:00.000Z"
      },
      rawInputs: [
        {
          kind: "text",
          content: "Lunch am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Focaccia."
        }
      ]
    });
    spec.menuPlan = spec.menuPlan.map((item) => ({
      ...item,
      menuCategory: "classic",
      productionDecision: undefined
    }));
    const discovery = {
      async resolveRecipe(): Promise<never> {
        throw new Error("Focaccia without production decision should not trigger recipe discovery");
      },
      async resolveRecipeOverride(): Promise<never> {
        throw new Error("Focaccia without production decision should not trigger recipe discovery");
      }
    } as unknown as RecipeDiscoveryService;

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.readiness.status).toBe("insufficient");
    expect(artifacts.productionPlan.recipeSelections[0].selectionReason).toContain("Hybridfall Focaccia");
    expect(artifacts.productionPlan.recipeSelections[0].autoUsedInternetRecipe).toBe(false);
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Hybridfall Focaccia");
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
    expect(artifacts.purchaseList.items).toHaveLength(0);
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

    const repository = new InMemoryRecipeRepository({ rootDir: createDataRoot() });
    const discovery = new RecipeDiscoveryService(repository, new FakeWebProvider([baseCandidate()]));

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

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

    const repository = new InMemoryRecipeRepository({ rootDir: createDataRoot() });
    const discovery = new RecipeDiscoveryService(repository, new FakeWebProvider([baseCandidate()]));

    const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

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

  it("blocks manual recipe overrides that violate the component menu category", async () => {
    const dataRoot = createDataRoot();
    const spec = baseSpec("Konferenz am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Quiche.");
    const recipe = dairyQuicheRecipe();
    spec.productionConstraints = [];
    spec.menuPlan = [
      {
        ...spec.menuPlan[0],
        label: "Vegan Quiche",
        menuCategory: "vegan",
        recipeOverrideId: recipe.recipeId,
        productionDecision: {
          mode: "scratch"
        }
      }
    ];

    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    await repository.save({ businessId: "local" }, recipe);
    const discovery = new RecipeDiscoveryService(repository, new FakeWebProvider([]));

    try {
      const artifacts = await buildProductionArtifacts(spec, discovery, { context: { businessId: "local" } });

      expect(artifacts.productionPlan.isFallback).toBe(true);
      expect(artifacts.productionPlan.readiness.status).toBe("insufficient");
      expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
      expect(artifacts.productionPlan.recipeSelections[0].recipeId).toBe(recipe.recipeId);
      expect(artifacts.productionPlan.recipeSelections[0].selectionReason).toContain("Harte Menükategorie vegan");
      expect(artifacts.productionPlan.recipeSelections[0].autoUsedInternetRecipe).toBe(false);
      expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Harte Menükategorie vegan");
      expect(artifacts.productionPlan.fallbackReason).toContain("Harte Menükategorie vegan");
      expect(artifacts.purchaseList.items).toHaveLength(0);
      expect(artifacts.purchaseList.totals.itemCount).toBe(0);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
