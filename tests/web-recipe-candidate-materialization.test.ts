import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent,
  RecipeSearchQuery,
  WebRecipeCandidate
} from "../shared-core/src/index.js";
import { materializeWebRecipeCandidate } from "../production-service/src/recipe-discovery/web-recipe-candidate-materialization.js";

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
      serviceForm: "buffet"
    }
  } as AcceptedEventSpec;
}

function buildQuery(query = "tomatensuppe vegetarisch rezept"): RecipeSearchQuery {
  return {
    query
  } as RecipeSearchQuery;
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

describe("web recipe candidate materialization", () => {
  it("materializes a compatible web candidate with the paired query", () => {
    const query = buildQuery();

    const result = materializeWebRecipeCandidate({
      candidate: buildCandidate(),
      component: buildComponent(),
      eventSpec: buildEventSpec(),
      locale: "de",
      query
    });

    expect(result.traceMessage).toBeUndefined();
    expect(result.candidate?.query).toBe(query);
    expect(result.candidate?.recipe).toMatchObject({
      name: "Tomatensuppe Bankett",
      source: {
        tier: "internet_fallback",
        originType: "web",
        approvalState: "auto_usable",
        qualityScore: 1
      }
    });
  });

  it("returns the existing category rejection trace for incompatible candidates", () => {
    const result = materializeWebRecipeCandidate({
      candidate: buildCandidate({
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
      }),
      component: buildComponent({ menuCategory: "vegan" }),
      eventSpec: buildEventSpec(),
      locale: "de",
      query: buildQuery("vegane tomatensuppe rezept")
    });

    expect(result.candidate).toBeUndefined();
    expect(result.traceMessage).toBe("Verworfen: Rindfleischsuppe (Kategorie passt nicht).");
  });

  it("keeps collection-like candidates out before materialization", () => {
    const result = materializeWebRecipeCandidate({
      candidate: buildCandidate({
        title: "Die 10 besten Tomatensuppen Ideen",
        qualitySignals: {
          structuredData: true,
          hasYield: true,
          ingredientCount: 3,
          stepCount: 2,
          mappedIngredientRatio: 0.5
        }
      }),
      component: buildComponent(),
      eventSpec: buildEventSpec(),
      locale: "de",
      query: buildQuery()
    });

    expect(result.candidate).toBeUndefined();
    expect(result.traceMessage).toBe(
      "Verworfen: Die 10 besten Tomatensuppen Ideen (Sammlungs-/Übersichtsseite)."
    );
  });
});
