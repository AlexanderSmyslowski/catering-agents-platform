import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import type { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";
import { buildRecipeBranchPlanningArtifacts } from "../production-service/src/rules/planning-recipe-branch-artifacts.js";

function eventSpec(): AcceptedEventSpec {
  return {
    specId: "spec-recipe-branch-test",
    event: {
      date: "2026-06-22"
    },
    attendees: {
      expected: 30
    },
    menuPlan: []
  } as unknown as AcceptedEventSpec;
}

function component(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-focaccia",
    label: "Focaccia",
    menuCategory: "classic",
    ...overrides
  };
}

function recipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-focaccia",
    name: "Focaccia",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "test",
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.9,
      fitScore: 0.92,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [],
    steps: [],
    scalingRules: {
      defaultLossFactor: 1
    },
    allergens: [],
    dietTags: []
  };
}

function discoveryService(resolution: Awaited<ReturnType<RecipeDiscoveryService["resolveRecipe"]>>): RecipeDiscoveryService {
  return {
    async resolveRecipe() {
      return resolution;
    },
    async resolveRecipeOverride() {
      return resolution;
    }
  } as unknown as RecipeDiscoveryService;
}

describe("planning recipe branch artifacts", () => {
  it("rejects context-free direct branch planning calls", async () => {
    await expect((buildRecipeBranchPlanningArtifacts as unknown as (
      input: Record<string, unknown>
    ) => Promise<unknown>)({
      eventSpec: eventSpec(),
      component: component(),
      servings: 30,
      discoveryService: discoveryService({
        selection: {
          componentId: "component-focaccia",
          selectionReason: "Testauflösung",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: []
      })
    })).rejects.toThrow("Betriebskontext");
  });

  it("combines hybrid procurement items with resolved recipe artifacts", async () => {
    const artifacts = await buildRecipeBranchPlanningArtifacts({
      eventSpec: eventSpec(),
      component: component({
        productionDecision: {
          mode: "hybrid",
          purchasedElements: ["Brot vom Bäcker"]
        }
      }),
      servings: 30,
      context: { businessId: "local" },
      discoveryService: discoveryService({
        recipe: recipe(),
        selection: {
          componentId: "component-focaccia",
          selectionReason: "Internes Rezept gefunden.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: []
      })
    });

    expect(artifacts.procurementItems.map((item) => item.displayName)).toEqual([
      "Brot vom Bäcker für Focaccia"
    ]);
    expect(artifacts.recipeArtifacts.kind).toBe("resolved");
    expect(artifacts.recipeArtifacts.selection.selectionReason).toBe("Internes Rezept gefunden.");
  });

  it("keeps unresolved recipe artifacts while still returning branch procurement items", async () => {
    const artifacts = await buildRecipeBranchPlanningArtifacts({
      eventSpec: eventSpec(),
      component: component({
        productionDecision: {
          mode: "hybrid",
          purchasedElements: ["Brot"]
        }
      }),
      servings: 0,
      context: { businessId: "local" },
      discoveryService: discoveryService({
        selection: {
          componentId: "component-focaccia",
          selectionReason: "Rezept fehlt.",
          autoUsedInternetRecipe: false
        },
        unresolvedItems: ["Rezept fehlt."]
      })
    });

    expect(artifacts.procurementItems).toHaveLength(1);
    expect(artifacts.recipeArtifacts.kind).toBe("unresolved");
  });
});
