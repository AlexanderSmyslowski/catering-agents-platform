import { describe, expect, it, vi } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe,
  RecipeSearchQuery,
  WebRecipeCandidate
} from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import type { WebRecipeSearchProvider } from "../production-service/src/recipe-discovery/provider.js";
import { createRecipeSearchTrace } from "../production-service/src/recipe-discovery/recipe-search-trace.js";
import { resolveWebRecipeCandidate } from "../production-service/src/recipe-discovery/web-recipe-candidate-resolution.js";

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
    specId: "spec-web-resolution-flow",
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

function webCandidate(overrides: Partial<WebRecipeCandidate> = {}): WebRecipeCandidate {
  return {
    title: "Tomatensuppe Bankett",
    url: "https://example.test/tomatensuppe",
    qualitySignals: {
      structuredData: true,
      hasYield: true,
      ingredientCount: 8,
      stepCount: 6,
      mappedIngredientRatio: 0.9
    },
    recipe: {
      name: "Tomatensuppe Bankett",
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
        },
        {
          ingredientId: "ingredient-onion",
          name: "Zwiebeln",
          quantity: { amount: 1, unit: "kg" },
          group: "produce"
        }
      ],
      steps: [
        {
          index: 1,
          instruction: "Tomaten und Zwiebeln garen."
        }
      ],
      scalingRules: {
        defaultLossFactor: 1.05
      },
      allergens: [],
      dietTags: ["vegetarian"]
    },
    ...overrides
  };
}

function providerReturning(candidates: WebRecipeCandidate[]): WebRecipeSearchProvider {
  return {
    searchRecipes: vi.fn(async (_query: RecipeSearchQuery) => candidates)
  };
}

describe("web recipe candidate resolution flow", () => {
  it("saves the selected web winner as a review-required candidate and appends the winner trace", async () => {
    const menuComponent = component();
    const provider = providerReturning([webCandidate()]);
    const repository = {
      save: vi.fn(async (_recipe: Recipe) => undefined)
    };
    const searchTrace = createRecipeSearchTrace();

    const resolution = await resolveWebRecipeCandidate({
      component: menuComponent,
      eventSpec: eventSpec(menuComponent),
      webProvider: provider,
      repository,
      searchTrace
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(resolution.recipe?.name).toBe("Tomatensuppe Bankett");
    expect(resolution.selection).toMatchObject({
      componentId: "component-tomato-soup",
      sourceTier: "internet_fallback",
      autoUsedInternetRecipe: false
    });
    expect(resolution.unresolvedItems).toEqual([
      "Rezept Tomatensuppe Bankett muss vor der finalen Produktion manuell geprueft werden."
    ]);
    expect(searchTrace.entries).toContain("Webtreffer gewählt: Tomatensuppe Bankett.");
  });

  it("returns an unresolved web resolution without saving when no candidate survives", async () => {
    const menuComponent = component({ label: "Mystery Bowl" });
    const repository = {
      save: vi.fn(async (_recipe: Recipe) => undefined)
    };
    const searchTrace = createRecipeSearchTrace();

    const resolution = await resolveWebRecipeCandidate({
      component: menuComponent,
      eventSpec: eventSpec(menuComponent),
      webProvider: providerReturning([]),
      repository,
      searchTrace
    });

    expect(repository.save).not.toHaveBeenCalled();
    expect(resolution.recipe).toBeUndefined();
    expect(resolution.selection.autoUsedInternetRecipe).toBe(false);
    expect(resolution.unresolvedItems.join(" ")).toContain("Mystery Bowl");
    expect(searchTrace.entries.some((entry) => entry.startsWith("Websuche:"))).toBe(true);
  });

  it("keeps failed web search wording and trace separate from ordinary no-match results", async () => {
    const menuComponent = component({ menuCategory: "vegan", label: "Linsensalat" });
    const provider: WebRecipeSearchProvider = {
      searchRecipes: vi.fn(async () => {
        throw new Error("provider offline");
      })
    };
    const repository = {
      save: vi.fn(async (_recipe: Recipe) => undefined)
    };
    const searchTrace = createRecipeSearchTrace();

    const resolution = await resolveWebRecipeCandidate({
      component: menuComponent,
      eventSpec: eventSpec(menuComponent),
      webProvider: provider,
      repository,
      searchTrace
    });

    expect(repository.save).not.toHaveBeenCalled();
    expect(resolution.selection.selectionReason).toBe(
      "Es konnte kein interner Rezeptkandidat gefunden werden und die Internetrecherche ist fehlgeschlagen."
    );
    expect(resolution.unresolvedItems).toEqual([
      "Kein veganer Rezeptkandidat für Linsensalat gefunden, Internetrecherche fehlgeschlagen."
    ]);
    expect(searchTrace.entries.some((entry) => entry.startsWith("Websuche fehlgeschlagen:"))).toBe(true);
  });
});
