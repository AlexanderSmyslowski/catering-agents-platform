import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type WebRecipeCandidate } from "@catering/shared-core";
import {
  candidateRecipeText,
  extractionCompletenessForCandidate,
  isCollectionLikeCandidate,
  qualityScoreForCandidate
} from "../production-service/src/recipe-discovery/web-candidate-quality.js";

function candidate(overrides: Partial<WebRecipeCandidate> = {}): WebRecipeCandidate {
  return {
    url: "https://chefkoch.de/rezepte/schokoladenkuchen",
    title: "Veganer Schokoladenkuchen",
    recipe: {
      schemaVersion: SCHEMA_VERSION,
      recipeId: "candidate-1",
      name: "Veganer Schokoladenkuchen",
      baseYield: {
        servings: 16,
        unit: "servings"
      },
      ingredients: [
        {
          ingredientId: "mehl",
          name: "Mehl",
          quantity: {
            amount: 500,
            unit: "g"
          },
          group: "dry_goods",
          purchaseUnit: "kg",
          normalizedUnit: "g"
        },
        {
          ingredientId: "kakao",
          name: "Kakao",
          quantity: {
            amount: 80,
            unit: "g"
          },
          group: "dry_goods",
          purchaseUnit: "kg",
          normalizedUnit: "g"
        }
      ],
      steps: [
        {
          index: 1,
          instruction: "Teig ruehren."
        }
      ],
      dietTags: ["vegan"],
      source: {
        tier: "internet_fallback",
        reference: "https://chefkoch.de/rezepte/schokoladenkuchen",
        originType: "web",
        retrievedAt: "2026-03-10T10:00:00.000Z",
        qualityScore: 0.8,
        fitScore: 0.8,
        extractionCompleteness: 0.9,
        approvalState: "review_required"
      }
    },
    qualitySignals: {
      structuredData: true,
      hasYield: true,
      ingredientCount: 12,
      stepCount: 8,
      mappedIngredientRatio: 0.9
    },
    ...overrides
  };
}

describe("web recipe candidate quality", () => {
  it("builds searchable candidate text from title, recipe, URL and ingredients", () => {
    expect(candidateRecipeText(candidate())).toContain("Veganer Schokoladenkuchen");
    expect(candidateRecipeText(candidate())).toContain("https://chefkoch.de/rezepte/schokoladenkuchen");
    expect(candidateRecipeText(candidate())).toContain("Mehl Kakao");
  });

  it("scores structured, complete candidates with trusted source boost", () => {
    expect(qualityScoreForCandidate(candidate())).toBe(1);
    expect(extractionCompletenessForCandidate(candidate())).toBe(1);
  });

  it("penalizes collection-like candidates without changing extraction completeness", () => {
    const collection = candidate({
      title: "Die besten veganen Kuchen Ideen"
    });

    expect(isCollectionLikeCandidate(collection)).toBe(true);
    expect(qualityScoreForCandidate(collection)).toBe(0.82);
    expect(extractionCompletenessForCandidate(collection)).toBe(1);
  });

  it("does not boost untrusted or invalid hosts", () => {
    expect(qualityScoreForCandidate(candidate({ url: "https://example.com/recipe" }))).toBe(0.99);
    expect(qualityScoreForCandidate(candidate({ url: "not a url" }))).toBe(0.99);
  });
});
