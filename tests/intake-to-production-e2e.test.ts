import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  createEventRequestFromText,
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

function withPlanningOverrides(
  spec: ReturnType<typeof normalizeEventRequestToSpec>,
  overrides: Record<string, { recipeOverrideId: string; menuCategory: "classic" | "vegetarian" | "vegan" }>
): ReturnType<typeof normalizeEventRequestToSpec> {
  return {
    ...spec,
    menuPlan: spec.menuPlan.map((component) => {
      const override = overrides[component.label];
      return {
        ...component,
        menuCategory: override?.menuCategory ?? component.menuCategory ?? "classic",
        dietaryTags: override?.menuCategory ? [override.menuCategory] : component.dietaryTags ?? [],
        recipeOverrideId: override?.recipeOverrideId ?? component.recipeOverrideId,
        productionDecision: {
          mode: "scratch"
        }
      };
    })
  };
}

function createDiscoveryService(rootDir: string): RecipeDiscoveryService {
  return new RecipeDiscoveryService(
    new InMemoryRecipeRepository([], { rootDir }),
    new EmptyWebProvider()
  );
}

describe("intake to production e2e", () => {
  it("keeps a realistic, slightly uncertain but planable catering request consistent end to end", async () => {
    const rawText = [
      "Konferenz am 2026-06-14. ca. 80 Teilnehmer.",
      "Bitte vegetarisch.",
      "BUFFET",
      "Tomatensuppe",
      "DETAILS |"
    ].join("\n");

    const request = createEventRequestFromText({
      requestId: "e2e-positive-1",
      channel: "text",
      rawText
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(request.constraints ?? []).toEqual(expect.arrayContaining(["vegetarian"]));
    expect(request.uncertainties ?? []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "attendees.expected" })
      ])
    );
    expect(spec.productionConstraints ?? []).toEqual(expect.arrayContaining(["vegetarian"]));
    expect(spec.readiness.status).toBe("complete");

    const dataRoot = createDataRoot();
    try {
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      await repository.save(
        createRecipe({
          recipeId: "tomatensuppe-basic",
          name: "Tomatensuppe",
          ingredientName: "Tomaten",
          dietTags: ["vegetarian"]
        })
      );

      const plannedSpec = withPlanningOverrides(spec, {
        Tomatensuppe: {
          recipeOverrideId: "tomatensuppe-basic",
          menuCategory: "vegetarian"
        }
      });
      const discovery = new RecipeDiscoveryService(repository, new EmptyWebProvider());
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

  it("turns a hard dietary conflict into a blocking fallback without operational artifacts", async () => {
    const rawText = [
      "Konferenz am 2026-06-15 fuer 80 Teilnehmer.",
      "Bitte glutenfrei.",
      "BUFFET",
      "BROT & BAGUETTE",
      "DETAILS |"
    ].join("\n");

    const request = createEventRequestFromText({
      requestId: "e2e-negative-1",
      channel: "text",
      rawText
    });
    const spec = normalizeEventRequestToSpec(request);

    expect(request.constraints ?? []).toEqual(expect.arrayContaining(["gluten_free"]));
    expect(spec.productionConstraints ?? []).toEqual(expect.arrayContaining(["gluten_free"]));
    expect(spec.readiness.status).toBe("complete");

    const dataRoot = createDataRoot();
    try {
      const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
      await repository.save(
        createRecipe({
          recipeId: "bread-baguette-basic",
          name: "Bread & Baguette",
          ingredientName: "Weizenmehl",
          dietTags: []
        })
      );

      const plannedSpec = withPlanningOverrides(spec, {
        "BROT & BAGUETTE": {
          recipeOverrideId: "bread-baguette-basic",
          menuCategory: "classic"
        }
      });
      const discovery = new RecipeDiscoveryService(repository, new EmptyWebProvider());
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
