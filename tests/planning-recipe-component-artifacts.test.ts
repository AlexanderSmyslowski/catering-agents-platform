import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type MenuComponent,
  type Recipe
} from "../shared-core/src/index.js";
import type { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";
import { buildRecipeComponentPlanningArtifacts } from "../production-service/src/rules/planning-recipe-component-artifacts.js";

function buildSpec(overrides: Partial<AcceptedEventSpec> = {}): AcceptedEventSpec {
  return {
    specId: "spec-lunch",
    event: {
      date: "2026-06-01"
    },
    attendees: {
      expected: 40
    },
    servicePlan: {
      serviceForm: "buffet"
    },
    productionConstraints: [],
    menuPlan: [],
    ...overrides
  } as unknown as AcceptedEventSpec;
}

function buildComponent(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-soup",
    label: "Tomatensuppe",
    menuCategory: "vegetarian",
    serviceStyle: "buffet",
    productionDecision: {
      mode: "scratch"
    },
    ...overrides
  };
}

function buildRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-soup",
    name: "Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal:tomato-soup",
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
        ingredientId: "ingredient-tomato",
        name: "Tomaten",
        quantity: { amount: 2, unit: "kg" },
        group: "produce"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten kochen."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: [],
    dietTags: ["vegetarian"],
    ...overrides
  } as Recipe;
}

function discoveryReturning(value: unknown): RecipeDiscoveryService {
  return {
    async resolveRecipe() {
      return value;
    },
    async resolveRecipeOverride() {
      return value;
    }
  } as unknown as RecipeDiscoveryService;
}

describe("planning recipe component artifacts", () => {
  it("rejects context-free direct planning calls", async () => {
    await expect((buildRecipeComponentPlanningArtifacts as unknown as (
      input: Record<string, unknown>
    ) => Promise<unknown>)({
      component: buildComponent(),
      eventSpec: buildSpec(),
      servings: 40,
      discoveryService: discoveryReturning({
        selection: {
          componentId: "component-soup",
          selectionReason: "Testauflösung",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: []
      })
    })).rejects.toThrow("Betriebskontext");
  });

  it("builds resolved recipe artifacts with the original recipe selection", async () => {
    const recipe = buildRecipe();
    const artifacts = await buildRecipeComponentPlanningArtifacts({
      component: buildComponent(),
      eventSpec: buildSpec(),
      servings: 40,
      context: { businessId: "local" },
      discoveryService: discoveryReturning({
        recipe,
        selection: {
          componentId: "component-soup",
          recipeId: recipe.recipeId,
          selectionReason: "Internes Rezept gewählt.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: []
      })
    });

    expect(artifacts.kind).toBe("resolved");
    expect(artifacts.selection.selectionReason).toBe("Internes Rezept gewählt.");
    expect(artifacts.issues).toEqual([]);
    expect(artifacts.kitchenSheet.title).toBe("Tomatensuppe - Tomatensuppe Bankett");
    if (artifacts.kind === "resolved") {
      expect(artifacts.batch.componentId).toBe("component-soup");
    }
  });

  it("keeps unresolved recipe misses as recipe clarification artifacts", async () => {
    const artifacts = await buildRecipeComponentPlanningArtifacts({
      component: buildComponent(),
      eventSpec: buildSpec(),
      servings: 40,
      context: { businessId: "local" },
      discoveryService: discoveryReturning({
        selection: {
          componentId: "component-soup",
          selectionReason: "Kein vegetarischer Rezeptkandidat gefunden.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: ["Kein vegetarischer Rezeptkandidat für Tomatensuppe gefunden."]
      })
    });

    expect(artifacts.kind).toBe("unresolved");
    expect(artifacts.selection.selectionReason).toBe("Kein vegetarischer Rezeptkandidat gefunden.");
    expect(artifacts.timelineItem.label).toBe("Tomatensuppe Rezeptklärung");
    expect(artifacts.issues).toEqual([
      {
        issue: "Kein vegetarischer Rezeptkandidat für Tomatensuppe gefunden.",
        blocking: false
      },
      {
        issue: "Kein vegetarischer Rezeptkandidat gefunden.",
        blocking: false
      }
    ]);
  });

  it("turns production constraint conflicts into unresolved artifacts while preserving the chosen selection id", async () => {
    const artifacts = await buildRecipeComponentPlanningArtifacts({
      component: buildComponent(),
      eventSpec: buildSpec({ productionConstraints: ["vegan"] }),
      servings: 40,
      context: { businessId: "local" },
      discoveryService: discoveryReturning({
        recipe: buildRecipe({
          ingredients: [
            {
              ingredientId: "ingredient-cream",
              name: "Sahne",
              quantity: { amount: 1, unit: "l" },
              group: "dairy"
            }
          ],
          dietTags: ["vegetarian"]
        }),
        selection: {
          componentId: "component-soup",
          recipeId: "recipe-tomato-soup",
          selectionReason: "Internes Rezept gewählt.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: []
      })
    });

    expect(artifacts.kind).toBe("unresolved");
    expect(artifacts.selection.recipeId).toBe("recipe-tomato-soup");
    expect(artifacts.selection.selectionReason).toContain("Harte Intake-Restriktion vegan");
    expect(artifacts.issues).toEqual([
      {
        issue: artifacts.selection.selectionReason,
        blocking: true
      }
    ]);
  });

  it("uses manual recipe overrides when the component pins a recipe id", async () => {
    const calls: string[] = [];
    const discovery = {
      async resolveRecipe() {
        calls.push("resolveRecipe");
        throw new Error("unexpected automatic discovery");
      },
      async resolveRecipeOverride(recipeId: string) {
        calls.push(`override:${recipeId}`);
        return {
          recipe: buildRecipe({ recipeId }),
          selection: {
            componentId: "component-soup",
            recipeId,
            selectionReason: "Rezept wurde manuell aus der Bibliothek zugewiesen.",
            autoUsedInternetRecipe: false
          },
          unresolvedItems: []
        };
      }
    } as unknown as RecipeDiscoveryService;

    const artifacts = await buildRecipeComponentPlanningArtifacts({
      component: buildComponent({ recipeOverrideId: "recipe-manual" }),
      eventSpec: buildSpec(),
      servings: 20,
      context: { businessId: "local" },
      discoveryService: discovery
    });

    expect(calls).toEqual(["override:recipe-manual"]);
    expect(artifacts.selection.recipeId).toBe("recipe-manual");
  });
});
