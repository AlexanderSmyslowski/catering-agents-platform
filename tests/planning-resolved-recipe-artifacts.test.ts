import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import { buildResolvedRecipePlanningArtifacts } from "../production-service/src/rules/planning-resolved-recipe-artifacts.js";

function buildSpec(): AcceptedEventSpec {
  return {
    specId: "spec-resolved-artifacts",
    event: {
      date: "2026-06-01"
    }
  } as unknown as AcceptedEventSpec;
}

function buildComponent(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-tomato-soup",
    label: "Tomatensuppe",
    menuCategory: "vegetarian",
    productionDecision: {
      mode: "scratch"
    },
    ...overrides
  };
}

function buildRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-soup",
    name: "Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "house:tomato-soup",
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.95,
      fitScore: 0.9,
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
        instruction: "Tomaten garen."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: ["celery"],
    dietTags: ["vegetarian"]
  };
}

describe("planning resolved recipe artifacts", () => {
  it("builds the production batch, kitchen sheet and timeline item for a resolved recipe", () => {
    const artifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: buildSpec(),
      component: buildComponent(),
      recipe: buildRecipe(),
      servings: 40
    });

    expect(artifacts.batch).toMatchObject({
      batchId: "batch-spec-resolved-artifacts-component-tomato-soup",
      componentId: "component-tomato-soup",
      recipeId: "recipe-tomato-soup",
      station: "hot-kitchen",
      prepWindow: "2026-06-01 T-1",
      gnPlan: [{ container: "GN 1/2", count: 2 }]
    });
    expect(artifacts.kitchenSheet).toMatchObject({
      title: "Tomatensuppe - Tomatensuppe Bankett",
      componentId: "component-tomato-soup",
      recipeId: "recipe-tomato-soup",
      station: "hot-kitchen",
      prepWindow: "2026-06-01 T-1",
      allergens: ["celery"],
      dietTags: ["vegetarian"],
      instructions: ["1. Tomaten garen."]
    });
    expect(artifacts.timelineItem).toEqual({
      label: "Tomatensuppe vorbereiten",
      at: "2026-06-01 T-1"
    });
  });

  it("adds hybrid procurement notes to the kitchen sheet instructions without changing the batch", () => {
    const artifacts = buildResolvedRecipePlanningArtifacts({
      eventSpec: buildSpec(),
      component: buildComponent({
        productionDecision: {
          mode: "hybrid",
          purchasedElements: ["Brot vom Bäcker"]
        }
      }),
      recipe: buildRecipe(),
      servings: 20
    });

    expect(artifacts.batch.batchId).toBe("batch-spec-resolved-artifacts-component-tomato-soup");
    expect(artifacts.kitchenSheet.procurementNotes).toEqual([
      "Zukaufteil separat disponieren: Brot vom Bäcker."
    ]);
    expect(artifacts.kitchenSheet.instructions).toContain(
      "Zukaufteil separat disponieren: Brot vom Bäcker."
    );
  });
});
