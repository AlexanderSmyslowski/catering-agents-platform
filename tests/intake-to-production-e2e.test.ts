import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createEventRequestFromManualForm,
  normalizeEventRequestToSpec,
  type Recipe
} from "@catering/shared-core";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  buildProductionArtifacts
} from "@catering/production-service";

class EmptyWebProvider {
  async searchRecipes() {
    return [];
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-e2e-"));
}

function createRecipe(recipe: {
  recipeId: string;
  name: string;
  ingredientName: string;
  dietTags?: string[];
  ingredientId?: string;
}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: recipe.recipeId,
    name: recipe.name,
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: `internal/${recipe.recipeId}`,
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.96,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: recipe.ingredientId ?? `${recipe.recipeId}-ingredient`,
        name: recipe.ingredientName,
        quantity: {
          amount: 1,
          unit: "kg"
        },
        group: "main",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: `Zubereitung von ${recipe.name}.`
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: [],
    dietTags: recipe.dietTags ?? []
  };
}

function createDiscoveryService(repository: InMemoryRecipeRepository): RecipeDiscoveryService {
  return new RecipeDiscoveryService(repository, new EmptyWebProvider());
}

describe("manual form intake to production e2e", () => {
  it("keeps a realistic manual form request consistent end to end", async () => {
    const request = createEventRequestFromManualForm({
      requestId: "manual-e2e-positive-1",
      eventDate: "2026-07-12",
      attendeeCount: 48,
      serviceForm: "buffet",
      menuItems: ["Vegetarische Tomatensuppe"],
      notes: "Bitte vegetarisch"
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(request.source.channel).toBe("manual_form");
    expect(request.rawInputs[0].kind).toBe("form");
    expect(request.rawInputs[0].content).toContain("Notizen: Bitte vegetarisch");
    expect(request.constraints ?? []).toEqual(expect.arrayContaining(["Bitte vegetarisch"]));
    expect(spec.event.date).toBe("2026-07-12");
    expect(spec.attendees.expected).toBe(48);
    expect(spec.event.serviceForm).toBe("buffet");
    expect(spec.menuPlan).toHaveLength(1);
    expect(spec.menuPlan[0].label).toBe("Vegetarische Tomatensuppe");
    expect(spec.productionConstraints ?? []).toEqual(expect.arrayContaining(["vegetarian"]));
    expect(spec.readiness.status).toBe("complete");

    const dataRoot = createDataRoot();
    try {
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      await repository.save(
        createRecipe({
          recipeId: "tomatensuppe-manual",
          name: "Tomatensuppe",
          ingredientName: "Tomaten",
          dietTags: ["vegetarian"]
        })
      );

      const plannedSpec = {
        ...spec,
        menuPlan: spec.menuPlan.map((item) => ({
          ...item,
          productionDecision: {
            mode: "scratch" as const
          }
        }))
      };
      const discovery = createDiscoveryService(repository);
      const artifacts = await buildProductionArtifacts(plannedSpec, discovery);

      expect(artifacts.productionPlan.readiness.status).toBe("complete");
      expect(artifacts.productionPlan.isFallback).not.toBe(true);
      expect(artifacts.productionPlan.blockingIssues ?? []).toHaveLength(0);
      expect(artifacts.productionPlan.recipeSelections).toHaveLength(1);
      expect(artifacts.productionPlan.productionBatches).toHaveLength(1);
      expect(artifacts.productionPlan.kitchenSheets).toHaveLength(1);
      expect(artifacts.productionPlan.kitchenSheets[0].title).toContain("Tomatensuppe");
      expect(artifacts.productionPlan.timeline[0].label).toContain("Tomatensuppe");
      expect(artifacts.purchaseList.items.length).toBeGreaterThan(0);
      expect(artifacts.purchaseList.items[0].displayName).toContain("Tomaten");
      expect(artifacts.purchaseList.totals.itemCount).toBeGreaterThan(0);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("turns a manual form conflict into a blocking fallback without operational artifacts", async () => {
    const request = createEventRequestFromManualForm({
      requestId: "manual-e2e-negative-1",
      eventDate: "2026-07-13",
      attendeeCount: 36,
      serviceForm: "buffet",
      menuItems: ["Klassisch Brot & Baguette"],
      notes: "Bitte glutenfrei"
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(request.source.channel).toBe("manual_form");
    expect(request.rawInputs[0].content).toContain("Notizen: Bitte glutenfrei");
    expect(request.constraints ?? []).toEqual(expect.arrayContaining(["Bitte glutenfrei"]));
    expect(spec.event.date).toBe("2026-07-13");
    expect(spec.attendees.expected).toBe(36);
    expect(spec.event.serviceForm).toBe("buffet");
    expect(spec.menuPlan).toHaveLength(1);
    expect(spec.menuPlan[0].label).toBe("Klassisch Brot & Baguette");
    expect(spec.productionConstraints ?? []).toEqual(expect.arrayContaining(["gluten_free"]));
    expect(spec.readiness.status).toBe("complete");

    const dataRoot = createDataRoot();
    try {
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      await repository.save(
        createRecipe({
          recipeId: "bread-baguette-manual",
          name: "Bread & Baguette",
          ingredientName: "Weizenmehl",
          dietTags: []
        })
      );

      const plannedSpec = {
        ...spec,
        menuPlan: spec.menuPlan.map((item) => ({
          ...item,
          productionDecision: {
            mode: "scratch" as const
          }
        }))
      };
      const discovery = createDiscoveryService(repository);
      const artifacts = await buildProductionArtifacts(plannedSpec, discovery);

      expect(artifacts.productionPlan.isFallback).toBe(true);
      expect(artifacts.productionPlan.readiness.status).toBe("insufficient");
      expect(artifacts.productionPlan.blockingIssues?.join(" ")).toContain("gluten_free");
      expect(artifacts.productionPlan.fallbackReason).toContain("gluten_free");
      expect(artifacts.productionPlan.recipeSelections).toHaveLength(1);
      expect(artifacts.productionPlan.recipeSelections[0].selectionReason).toContain("gluten_free");
      expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
      expect(artifacts.productionPlan.kitchenSheets).toHaveLength(0);
      expect(artifacts.productionPlan.timeline).toHaveLength(0);
      expect(artifacts.purchaseList.items).toHaveLength(0);
      expect(artifacts.purchaseList.totals.itemCount).toBe(0);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});

