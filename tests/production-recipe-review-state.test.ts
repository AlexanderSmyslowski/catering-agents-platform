import { describe, expect, it } from "vitest";
import {
  countRecipeReviewStates,
  formatRecipeReviewStatusLabel,
  formatRecipeUsageStatusLabel
} from "../backoffice-ui/src/production-recipe-review-state.js";

describe("production recipe review state", () => {
  it("counts recipe approval states and treats auto usable candidates as review-required", () => {
    expect(
      countRecipeReviewStates([
        { recipeId: "approved", source: { approvalState: "approved_internal" } },
        { recipeId: "review", source: { approvalState: "review_required" } },
        { recipeId: "review-2", source: { approvalState: "review_required" } },
        { recipeId: "rejected", source: { approvalState: "rejected" } },
        { recipeId: "auto", source: { approvalState: "auto_usable" } },
        { recipeId: "missing-source" }
      ])
    ).toEqual({ approved: 1, reviewRequired: 3, rejected: 1 });
  });

  it("formats the quiet production recipe review labels", () => {
    expect(formatRecipeReviewStatusLabel({ approved: 0, reviewRequired: 0, rejected: 0 })).toBe(
      "keine offene Prüfung"
    );
    expect(formatRecipeReviewStatusLabel({ approved: 1, reviewRequired: 3, rejected: 0 })).toBe("3 zu prüfen");
    expect(formatRecipeUsageStatusLabel({ approved: 0, reviewRequired: 1, rejected: 0 })).toBe(
      "Noch keine freigegebenen Rezepte im Bestand"
    );
    expect(formatRecipeUsageStatusLabel({ approved: 2, reviewRequired: 0, rejected: 1 })).toBe(
      "Freigegebene Rezepte bleiben verwendbar"
    );
  });
});
