import { describe, expect, it } from "vitest";
import { buildProductionRecipeStatusSummaryState } from "../backoffice-ui/src/production-recipe-status-state.js";

describe("production recipe status summary state", () => {
  it("builds recipe review counts and labels from the recipe inventory", () => {
    expect(
      buildProductionRecipeStatusSummaryState({
        recipes: [
          { recipeId: "approved", source: { approvalState: "approved_internal" } },
          { recipeId: "review-1", source: { approvalState: "review_required" } },
          { recipeId: "review-2", source: { approvalState: "review_required" } },
          { recipeId: "rejected", source: { approvalState: "rejected" } },
          { recipeId: "external", source: { approvalState: "external" } }
        ]
      })
    ).toEqual({
      recipeReviewCounts: {
        approved: 1,
        reviewRequired: 2,
        rejected: 1
      },
      recipeReviewStatusLabel: "2 zu prüfen",
      recipeUsageStatusLabel: "Freigegebene Rezepte bleiben verwendbar",
      recipeCount: 5
    });
  });

  it("keeps the empty recipe inventory labels", () => {
    expect(buildProductionRecipeStatusSummaryState({ recipes: [] })).toEqual({
      recipeReviewCounts: {
        approved: 0,
        reviewRequired: 0,
        rejected: 0
      },
      recipeReviewStatusLabel: "keine offene Prüfung",
      recipeUsageStatusLabel: "Noch keine freigegebenen Rezepte im Bestand",
      recipeCount: 0
    });
  });
});
