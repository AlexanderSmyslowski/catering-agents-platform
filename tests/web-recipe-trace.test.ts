import { describe, expect, it } from "vitest";
import type { Recipe } from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import { createRecipeSearchTrace } from "../production-service/src/recipe-discovery/recipe-search-trace.js";
import { appendWebRecipeWinnerTrace } from "../production-service/src/recipe-discovery/web-recipe-trace.js";

function recipe(name: string): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: `web-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    source: {
      tier: "internet_fallback",
      originType: "web",
      reference: `web:${name}`,
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "review_required",
      qualityScore: 0.82,
      fitScore: 0.86,
      extractionCompleteness: 0.95
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [],
    steps: [],
    scalingRules: {
      defaultLossFactor: 1.05
    },
    allergens: [],
    dietTags: []
  };
}

describe("web recipe trace", () => {
  it("records the selected web recipe without changing trace order", () => {
    const trace = createRecipeSearchTrace();

    trace.push("Websuche: tomatensuppe catering rezept");
    appendWebRecipeWinnerTrace(trace, recipe("Tomatensuppe Web"));

    expect(trace.entries).toEqual([
      "Websuche: tomatensuppe catering rezept",
      "Webtreffer gewählt: Tomatensuppe Web."
    ]);
  });
});
