import { describe, expect, it } from "vitest";
import { buildProductionArtifacts } from "@catering/production-service";
import {
  SCHEMA_VERSION,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type Recipe
} from "@catering/shared-core";

function baseSpec(): AcceptedEventSpec {
  const spec = normalizeEventRequestToSpec({
    schemaVersion: SCHEMA_VERSION,
    requestId: "production-sheet-v1-1",
    source: {
      channel: "text",
      receivedAt: "2026-05-18T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: "Business Lunch am 2026-06-01 fuer 24 Personen mit Tomatensuppe."
      }
    ]
  });

  return {
    ...spec,
    menuPlan: spec.menuPlan.map((item) => ({
      ...item,
      componentId: "component-tomato-soup",
      label: "Tomatensuppe",
      menuCategory: "vegetarian" as const,
      productionDecision: { mode: "scratch" as const }
    }))
  };
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-soup",
    name: "Tomatensuppe",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal/recipe-tomato-soup",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.96,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 12,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "tomatoes",
        name: "Tomaten",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten schneiden."
      },
      {
        index: 2,
        instruction: "Suppe kochen."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 12
    },
    allergens: ["celery"],
    dietTags: ["vegetarian"],
    ...overrides
  };
}

function discoveryFor(selectedRecipe: Recipe) {
  return {
    async resolveRecipe() {
      return {
        recipe: selectedRecipe,
        selection: {
          componentId: "component-tomato-soup",
          recipeId: selectedRecipe.recipeId,
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
}

function planningOptions(spec: AcceptedEventSpec, selectedRecipe: Recipe) {
  const component = spec.menuPlan[0];
  const servings = component.servings ?? spec.attendees.expected ?? 0;
  return {
    context: { businessId: "local" },
    quantityRecipeBridges: {
      [component.componentId]: {
        status: "ready_for_scaling" as const,
        eventSpecId: spec.specId,
        componentId: component.componentId,
        recipeId: selectedRecipe.recipeId,
        targetOutput: { amount: servings, unit: "servings" },
        targetServings: servings,
        conversionMethod: "direct_servings" as const,
        issues: []
      }
    }
  };
}

describe("ProductionSheet v1 via KitchenSheet", () => {
  it("carries structured production fields from the generated batch", async () => {
    const spec = baseSpec();
    const selectedRecipe = recipe();
    const artifacts = await buildProductionArtifacts(
      spec,
      discoveryFor(selectedRecipe) as any,
      planningOptions(spec, selectedRecipe)
    );

    const [batch] = artifacts.productionPlan.productionBatches;
    const [sheet] = artifacts.productionPlan.kitchenSheets;

    expect(sheet).toMatchObject({
      componentId: "component-tomato-soup",
      recipeId: "recipe-tomato-soup",
      productionQty: batch.scaledYield,
      station: batch.station,
      prepWindow: batch.prepWindow,
      ingredients: batch.ingredients,
      steps: batch.steps,
      allergens: ["celery"],
      dietTags: ["vegetarian"],
      gnPlan: batch.gnPlan
    });
    expect(sheet.ingredients.map((ingredient) => ingredient.name)).toEqual(["Tomaten"]);
    expect(sheet.steps.map((step) => step.instruction)).toEqual(["Tomaten schneiden.", "Suppe kochen."]);
    expect(sheet.blockingNotes ?? []).toEqual([]);
  });

  it("does not expose a blocked component as a normal kitchen sheet", async () => {
    const blockedSpec = {
      ...baseSpec(),
      productionConstraints: ["gluten_free"],
      menuPlan: baseSpec().menuPlan.map((item) => ({
        ...item,
        label: "Brot & Baguette",
        menuCategory: "classic" as const
      }))
    };
    const blockedRecipe = recipe({
      recipeId: "recipe-bread",
      name: "Brot & Baguette",
      ingredients: [
        {
          ingredientId: "flour",
          name: "Weizenmehl",
          quantity: {
            amount: 1,
            unit: "kg"
          },
          group: "dry_goods",
          purchaseUnit: "kg",
          normalizedUnit: "g"
        }
      ],
      allergens: ["gluten"],
      dietTags: []
    });

    const artifacts = await buildProductionArtifacts(
      blockedSpec,
      discoveryFor(blockedRecipe) as any,
      planningOptions(blockedSpec, blockedRecipe)
    );

    expect(artifacts.productionPlan.isFallback).toBe(true);
    expect(artifacts.productionPlan.productionBatches).toHaveLength(0);
    expect(artifacts.productionPlan.kitchenSheets).toHaveLength(1);
    expect(artifacts.productionPlan.kitchenSheets[0].blockingNotes?.join(" ")).toContain("gluten_free");
    expect(artifacts.productionPlan.kitchenSheets[0].steps).toEqual([]);
    expect(artifacts.productionPlan.kitchenSheets[0].ingredients).toEqual([]);
  });
});
