import { describe, expect, it } from "vitest";
import type { Recipe } from "../shared-core/src/index.js";
import { SCHEMA_VERSION } from "../shared-core/src/index.js";
import {
  appendInternalRecipeCandidatesTrace,
  appendInternalRecipeWinnerTrace
} from "../production-service/src/recipe-discovery/internal-recipe-trace.js";
import { createRecipeSearchTrace } from "../production-service/src/recipe-discovery/recipe-search-trace.js";

function recipe(name: string): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: `recipe-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    source: {
      tier: "internal_approved",
      originType: "internal_db",
      reference: `house:${name}`,
      retrievedAt: "2026-05-31T08:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.9,
      fitScore: 0.9,
      extractionCompleteness: 1
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

describe("internal recipe trace", () => {
  it("summarizes the first three internal repository candidates", () => {
    const trace = createRecipeSearchTrace();

    appendInternalRecipeCandidatesTrace(trace, [
      recipe("Tomatensuppe"),
      recipe("Tomatensuppe Bankett"),
      recipe("Tomatensugo"),
      recipe("Tomatenbrot")
    ]);

    expect(trace.entries).toEqual([
      "Interne Kandidaten: Tomatensuppe, Tomatensuppe Bankett, Tomatensugo"
    ]);
  });

  it("keeps empty internal candidate wording explicit", () => {
    const trace = createRecipeSearchTrace();

    appendInternalRecipeCandidatesTrace(trace, []);

    expect(trace.entries).toEqual(["Interne Kandidaten: keine Treffer."]);
  });

  it("records the selected internal winner without changing trace order", () => {
    const trace = createRecipeSearchTrace();

    appendInternalRecipeCandidatesTrace(trace, [recipe("Tomatensuppe Bankett")]);
    appendInternalRecipeWinnerTrace(trace, recipe("Tomatensuppe Bankett"));

    expect(trace.entries).toEqual([
      "Interne Kandidaten: Tomatensuppe Bankett",
      "Interner Treffer gewählt: Tomatensuppe Bankett."
    ]);
  });
});
