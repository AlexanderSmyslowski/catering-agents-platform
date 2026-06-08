import { describe, expect, it } from "vitest";
import {
  aggregatePurchaseList,
  assertTrustedRecipeForDeterministicProduction,
  recipeResearchBoundaryForRecipe,
  recipeResearchCalculationBoundaryPolicy,
  scaleRecipe,
  SCHEMA_VERSION,
  toProductionBatch,
  validateLlmRecipeResearchDraft,
  type ProductionBatch,
  type Recipe
} from "@catering/shared-core";
import { isWebRecipeSearchEnabled } from "@catering/production-service";
import { renderPurchaseListCsv } from "@catering/print-export";

function approvedInternalRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-tomato-salad",
    name: "Tomato Salad",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal:recipe-tomato-salad",
      retrievedAt: "2026-06-01T10:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.98,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "servings"
    },
    ingredients: [
      {
        ingredientId: "tomato",
        name: "Tomatoes",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "produce"
      },
      {
        ingredientId: "onion",
        name: "Onions",
        quantity: {
          amount: 500,
          unit: "g"
        },
        group: "produce"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Cut vegetables and mix."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.1,
      batchSize: 20
    },
    allergens: [],
    dietTags: ["vegan"]
  };
}

function webCandidateRecipe(approvalState: "auto_usable" | "review_required"): Recipe {
  return {
    ...approvedInternalRecipe(),
    recipeId: `web-candidate-${approvalState}`,
    name: "External Tomato Salad Candidate",
    source: {
      tier: "internet_fallback",
      originType: "web",
      reference: "web:tomato-salad:de",
      url: "https://example.invalid/tomato-salad",
      publisher: "Example Recipes",
      retrievedAt: "2026-06-01T10:15:00.000Z",
      approvalState,
      qualityScore: 0.91,
      fitScore: 0.9,
      extractionCompleteness: 0.88,
      licenseNote: "External candidate requires internal review."
    }
  };
}

function productionBatchFor(recipe: Recipe): ProductionBatch {
  return {
    ...toProductionBatch(recipe, "component-salad", 30),
    batchId: "batch-salad",
    station: "cold-kitchen",
    prepWindow: "T-2h",
    gnPlan: [
      {
        container: "GN 1/1",
        count: 2
      }
    ]
  };
}

describe("recipe research and calculation boundary", () => {
  it("keeps web recipe search disabled by default and opt-in only", () => {
    expect(recipeResearchCalculationBoundaryPolicy.webRecipeSearch).toEqual({
      defaultState: "disabled",
      optInEnvVar: "CATERING_ENABLE_WEB_RECIPE_SEARCH"
    });
    expect(isWebRecipeSearchEnabled({})).toBe(false);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "0" })).toBe(false);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "false" })).toBe(false);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "1" })).toBe(true);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "true" })).toBe(true);
  });

  it("treats approved internal recipes as trusted deterministic inputs", () => {
    const decision = recipeResearchBoundaryForRecipe(approvedInternalRecipe());

    expect(decision).toMatchObject({
      sourceKind: "internal_recipe_library",
      trustStatus: "trusted_production_input",
      trustedProductionInput: true,
      humanReviewRequired: false
    });
  });

  it("keeps web recipe candidates untrusted even when discovery marked them auto usable", () => {
    const autoUsableDecision = assertTrustedRecipeForDeterministicProduction(
      webCandidateRecipe("auto_usable")
    );
    const reviewRequiredDecision = assertTrustedRecipeForDeterministicProduction(
      webCandidateRecipe("review_required")
    );

    expect(autoUsableDecision).toMatchObject({
      sourceKind: "web_recipe_candidate",
      trustStatus: "candidate_review_required",
      trustedProductionInput: false,
      humanReviewRequired: true
    });
    expect(reviewRequiredDecision).toMatchObject(autoUsableDecision);
  });

  it("keeps LLM recipe summaries draft-only and blocks product-object writes", () => {
    expect(
      validateLlmRecipeResearchDraft({
        draftType: "recipe_research_summary_draft",
        humanApprovalRequired: true,
        writesProductObject: false,
        text: "Compare two recipe candidates and list uncertainty.",
        sourceRefs: ["web:tomato-salad:de"]
      })
    ).toEqual({
      valid: true,
      errors: []
    });

    expect(
      validateLlmRecipeResearchDraft({
        draftType: "recipe_research_summary_draft",
        humanApprovalRequired: false,
        writesProductObject: true,
        text: "Write the final production plan.",
        sourceRefs: []
      })
    ).toEqual({
      valid: false,
      errors: [
        "LLM recipe research drafts require human approval.",
        "LLM recipe research drafts cannot write product objects."
      ]
    });
  });

  it("scales accepted recipe inputs deterministically", () => {
    const recipe = approvedInternalRecipe();
    const first = scaleRecipe(recipe, 30);
    const second = scaleRecipe(recipe, 30);

    expect(second).toEqual(first);
    expect(first.scaledYield).toEqual({
      amount: 33,
      unit: "servings"
    });
    expect(first.batchCount).toBe(2);
    expect(first.ingredients).toEqual([
      expect.objectContaining({
        ingredientId: "tomato",
        quantity: {
          amount: 6.6,
          unit: "kg"
        }
      }),
      expect.objectContaining({
        ingredientId: "onion",
        quantity: {
          amount: 1650,
          unit: "g"
        }
      })
    ]);
  });

  it("builds purchase lists deterministically from accepted production batches", () => {
    const batch = productionBatchFor(approvedInternalRecipe());
    const first = aggregatePurchaseList("spec-boundary", [batch]);
    const second = aggregatePurchaseList("spec-boundary", [batch]);

    expect(second).toEqual(first);
    expect(first.items).toEqual([
      expect.objectContaining({
        ingredientId: "onion",
        normalizedQty: 1650,
        normalizedUnit: "g",
        purchaseQty: 1.65,
        purchaseUnit: "kg",
        sourceRecipes: ["recipe-tomato-salad"]
      }),
      expect.objectContaining({
        ingredientId: "tomato",
        normalizedQty: 6.6,
        normalizedUnit: "kg",
        purchaseQty: 6.6,
        purchaseUnit: "kg",
        sourceRecipes: ["recipe-tomato-salad"]
      })
    ]);
  });

  it("makes current source metadata preservation and CSV loss explicit", () => {
    const purchaseList = aggregatePurchaseList("spec-boundary", [
      productionBatchFor(approvedInternalRecipe())
    ]);
    const csv = renderPurchaseListCsv(purchaseList);

    expect(
      recipeResearchCalculationBoundaryPolicy.sourceMetadata
    ).toEqual({
      purchaseListObjectPreservesSourceRecipes: true,
      purchaseListCsvExportsSourceRecipes: false
    });
    expect(purchaseList.items.every((item) => item.sourceRecipes.length > 0)).toBe(true);
    expect(csv.split("\n")[0]).not.toContain("sourceRecipes");
    expect(csv).not.toContain("recipe-tomato-salad");
  });
});
