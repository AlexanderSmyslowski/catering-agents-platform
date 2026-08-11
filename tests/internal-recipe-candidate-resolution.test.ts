import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe,
  RecipeSearchQuery,
  WebRecipeCandidate
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  type WebRecipeSearchProvider
} from "../production-service/src/index.js";
import { resolveInternalRecipeCandidate } from "../production-service/src/recipe-discovery/internal-recipe-candidate-resolution.js";
import { createRecipeSearchTrace } from "../production-service/src/recipe-discovery/recipe-search-trace.js";

class NoopWebProvider implements WebRecipeSearchProvider {
  async searchRecipes(_query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    return [];
  }
}

function component(overrides: Partial<MenuComponent> = {}): MenuComponent {
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

function eventSpec(menuComponent: MenuComponent): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-internal-resolution-flow",
    event: {
      date: "2026-06-25"
    },
    servicePlan: {
      eventType: "lunch",
      serviceForm: "buffet"
    },
    attendees: {
      expected: 40
    },
    menuPlan: [menuComponent]
  } as unknown as AcceptedEventSpec;
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
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
      qualityScore: 0.93,
      fitScore: 0.91,
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
    allergens: [],
    dietTags: ["vegetarian"],
    ...overrides
  };
}

describe("internal recipe candidate resolution flow", () => {
  it("returns an internal recipe resolution and appends candidate and winner trace entries", () => {
    const menuComponent = component();
    const internalRecipe = recipe();
    const searchTrace = createRecipeSearchTrace();

    const resolution = resolveInternalRecipeCandidate({
      repositoryCandidates: [internalRecipe],
      component: menuComponent,
      eventSpec: eventSpec(menuComponent),
      searchTrace
    });

    expect(resolution?.recipe).toBe(internalRecipe);
    expect(resolution?.selection).toMatchObject({
      componentId: "component-tomato-soup",
      recipeId: "recipe-tomato-soup",
      sourceTier: "internal_verified",
      autoUsedInternetRecipe: false
    });
    expect(searchTrace.entries).toEqual([
      "Interne Kandidaten: Tomatensuppe Bankett",
      "Interner Treffer gewählt: Tomatensuppe Bankett."
    ]);
  });

  it("keeps the trace but leaves resolution open when no internal recipe wins", () => {
    const menuComponent = component({ label: "Wildkräutersalat" });
    const searchTrace = createRecipeSearchTrace();

    const resolution = resolveInternalRecipeCandidate({
      repositoryCandidates: [recipe()],
      component: menuComponent,
      eventSpec: eventSpec(menuComponent),
      searchTrace
    });

    expect(resolution).toBeUndefined();
    expect(searchTrace.entries).toEqual(["Interne Kandidaten: Tomatensuppe Bankett"]);
  });

  it("records an empty internal candidate trace when the repository has no matches", () => {
    const menuComponent = component();
    const searchTrace = createRecipeSearchTrace();

    const resolution = resolveInternalRecipeCandidate({
      repositoryCandidates: [],
      component: menuComponent,
      eventSpec: eventSpec(menuComponent),
      searchTrace
    });

    expect(resolution).toBeUndefined();
    expect(searchTrace.entries).toEqual(["Interne Kandidaten: keine Treffer."]);
  });

  it("selects the Köpff Tortilla-Tarte seed for a vegetarian hybrid Tortilla-Tarte component", async () => {
    const menuComponent = component({
      componentId: "component-tortilla-tarte",
      label: "Tortilla-Tarte",
      menuCategory: "vegetarian",
      productionDecision: {
        mode: "hybrid",
        purchasedElements: ["Mini-Tarteböden"]
      }
    });
    const koepffTortilla = JSON.parse(
      readFileSync(
        "data-seeds/recipes-koepff/koepff-tortilla-tarte-getrocknete-tomaten-oliven.json",
        "utf8"
      )
    ) as Recipe;
    koepffTortilla.source.approvalState = "approved_internal";
    koepffTortilla.dietTags = ["vegetarian"];
    const repository = new InMemoryRecipeRepository();
    await repository.save({ businessId: "local" }, koepffTortilla);
    const discovery = new RecipeDiscoveryService(repository, new NoopWebProvider());

    const resolution = await discovery.resolveRecipe(menuComponent, eventSpec(menuComponent), {
      context: { businessId: "local" }
    });

    // Regression diagnosis: fixed in the archetype layer; quiche now accepts tarte tokens.
    expect(resolution.recipe?.recipeId).toBe("koepff-tortilla-tarte-getrocknete-tomaten-oliven");
    expect(resolution.selection).toMatchObject({
      componentId: "component-tortilla-tarte",
      recipeId: "koepff-tortilla-tarte-getrocknete-tomaten-oliven",
      autoUsedInternetRecipe: false
    });
  });
});
