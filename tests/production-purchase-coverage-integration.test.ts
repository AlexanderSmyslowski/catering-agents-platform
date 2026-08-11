import { describe, expect, it, vi } from "vitest";

const PURCHASE_COVERAGE_INTEGRATION_TIMEOUT_MS = 30000;

function fakeRecipe(schemaVersion: string) {
  return {
    schemaVersion,
    recipeId: "recipe-tomato-soup",
    name: "Tomatensuppe",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal:recipe-tomato-soup",
      retrievedAt: "2026-06-01T10:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "tomato",
        name: "Tomaten",
        quantity: {
          amount: 2500,
          unit: "g"
        },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      },
      {
        ingredientId: "cream",
        name: "Sahne",
        quantity: {
          amount: 500,
          unit: "ml"
        },
        group: "dairy",
        purchaseUnit: "l",
        normalizedUnit: "ml"
      }
    ],
    steps: [{ index: 1, instruction: "Suppe kochen." }],
    scalingRules: {
      defaultLossFactor: 1,
      batchSize: 10
    },
    allergens: ["milk"],
    dietTags: ["vegetarian"]
  };
}

async function buildSpec() {
  const shared = await import("@catering/shared-core");
  const spec = shared.normalizeEventRequestToSpec({
    schemaVersion: shared.SCHEMA_VERSION,
    requestId: "purchase-coverage-planning-1",
    source: {
      channel: "text",
      receivedAt: "2026-05-18T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: "Business Lunch am 2026-06-01 fuer 20 Personen mit Tomatensuppe."
      }
    ]
  });

  return {
    ...spec,
    menuPlan: spec.menuPlan.map((item) => ({
      ...item,
      label: "Tomatensuppe",
      menuCategory: "vegetarian" as const,
      productionDecision: { mode: "scratch" as const }
    }))
  };
}

async function buildWithCurrentPlanning() {
  const shared = await import("@catering/shared-core");
  const { buildProductionArtifacts } = await import("@catering/production-service");
  const spec = await buildSpec();
  const discovery = {
    async resolveRecipe() {
      return {
        recipe: fakeRecipe(shared.SCHEMA_VERSION),
        selection: {
          componentId: spec.menuPlan[0].componentId,
          recipeId: "recipe-tomato-soup",
          selectionReason: "Internes Rezept gewaehlt.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: []
      };
    },
    async resolveRecipeOverride() {
      return this.resolveRecipe();
    }
  };

  return buildProductionArtifacts(spec, discovery as any, { context: { businessId: "local" } });
}

describe("production planning purchase coverage integration", () => {
  it("adds a blocking planning issue when purchase coverage is missing", async () => {
    vi.resetModules();
    vi.doMock("@catering/shared-core", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@catering/shared-core")>();
      return {
        ...actual,
        aggregatePurchaseList: (...args: Parameters<typeof actual.aggregatePurchaseList>) => {
          const list = actual.aggregatePurchaseList(...args);
          const items = list.items.filter((item) => item.ingredientId !== "cream");
          return {
            ...list,
            items,
            totals: {
              itemCount: items.length,
              groups: [...new Set(items.map((item) => item.group))]
            }
          };
        }
      };
    });

    const artifacts = await buildWithCurrentPlanning();

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Einkaufsabdeckung fehlt");
    expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("Sahne");
  }, PURCHASE_COVERAGE_INTEGRATION_TIMEOUT_MS);

  it("keeps the successful planning path unchanged when purchase coverage is complete", async () => {
    vi.resetModules();
    vi.doUnmock("@catering/shared-core");

    const artifacts = await buildWithCurrentPlanning();

    expect(artifacts.productionPlan.isFallback).toBeUndefined();
    expect(artifacts.productionPlan.blockingIssues ?? []).toEqual([]);
    expect(artifacts.productionPlan.productionBatches).toHaveLength(1);
    expect(artifacts.purchaseList.items.map((item) => item.ingredientId).sort()).toEqual(["cream", "tomato"]);
  }, PURCHASE_COVERAGE_INTEGRATION_TIMEOUT_MS);
});
