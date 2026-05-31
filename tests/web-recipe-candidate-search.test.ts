import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent,
  RecipeSearchQuery,
  WebRecipeCandidate
} from "../shared-core/src/index.js";
import type { WebRecipeSearchProvider } from "../production-service/src/recipe-discovery/provider.js";
import { createRecipeSearchTrace } from "../production-service/src/recipe-discovery/recipe-search-trace.js";
import { collectWebRecipeCandidates } from "../production-service/src/recipe-discovery/web-recipe-candidate-search.js";

function buildComponent(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-tomato-soup",
    label: "Tomatensuppe",
    menuCategory: "vegetarian",
    serviceStyle: "buffet",
    ...overrides
  };
}

function buildEventSpec(): AcceptedEventSpec {
  return {
    servicePlan: {
      eventType: "lunch",
      serviceForm: "buffet"
    }
  } as AcceptedEventSpec;
}

function buildCandidate(overrides: Partial<WebRecipeCandidate> = {}): WebRecipeCandidate {
  return {
    title: "Tomatensuppe Bankett",
    url: "https://www.chefkoch.de/rezepte/tomatensuppe-bankett",
    publisher: "Chefkoch",
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

class RecordingWebProvider implements WebRecipeSearchProvider {
  readonly queries: RecipeSearchQuery[] = [];

  constructor(private readonly handler: (query: RecipeSearchQuery) => Promise<WebRecipeCandidate[]>) {}

  async searchRecipes(query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    this.queries.push(query);
    return this.handler(query);
  }
}

describe("web recipe candidate search", () => {
  it("materializes candidates and stops after the first strong web recipe", async () => {
    const provider = new RecordingWebProvider(async () => [buildCandidate()]);
    const trace = createRecipeSearchTrace();

    const result = await collectWebRecipeCandidates({
      component: buildComponent(),
      eventSpec: buildEventSpec(),
      webProvider: provider,
      searchTrace: trace
    });

    expect(result.webSearchFailed).toBe(false);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.recipe.name).toBe("Tomatensuppe Bankett");
    expect(result.candidates[0]?.query).toBe(provider.queries[0]);
    expect(provider.queries).toHaveLength(1);
    expect(provider.queries[0]?.locale).toBe("de");
    expect(trace.entries[0]).toMatch(/^Websuche: /);
  });

  it("keeps provider failures explicit without hiding later materialization traces", async () => {
    let calls = 0;
    const provider = new RecordingWebProvider(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("network unavailable");
      }
      return [
        buildCandidate({
          title: "Rindfleischsuppe",
          recipe: {
            ...buildCandidate().recipe,
            name: "Rindfleischsuppe",
            ingredients: [
              {
                ingredientId: "ingredient-beef",
                name: "Rind",
                quantity: { amount: 2, unit: "kg" },
                group: "meat"
              }
            ],
            dietTags: []
          }
        })
      ];
    });
    const trace = createRecipeSearchTrace();

    const result = await collectWebRecipeCandidates({
      component: buildComponent({ menuCategory: "vegan" }),
      eventSpec: buildEventSpec(),
      webProvider: provider,
      searchTrace: trace
    });

    expect(result.webSearchFailed).toBe(true);
    expect(result.candidates).toEqual([]);
    expect(trace.entries).toContain(`Websuche fehlgeschlagen: ${provider.queries[0]?.query}`);
    expect(trace.entries).toContain("Verworfen: Rindfleischsuppe (Kategorie passt nicht).");
  });
});
