import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RecipeLibrary,
  isRecipeEligibleForOperationalPlanning,
  parseUploadedRecipeText
} from "@catering/shared-core";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-recipe-eligibility-"));
}

function uploadedRecipe() {
  return parseUploadedRecipeText({
    recipeName: "Vegan Coconut Bowl",
    filename: "vegan-coconut-bowl.pdf",
    sourceRef: "test:unverified-upload-eligibility",
    text: [
      "Vegan Coconut Bowl",
      "Zutaten",
      "1 kg Kokosreis",
      "500 g Brokkoli",
      "200 g Mandeln",
      "Diet",
      "vegan",
      "Zubereitung",
      "1. Reis kochen.",
      "2. Brokkoli garen und mit Mandeln servieren."
    ].join("\n")
  });
}

describe("recipe operational eligibility", () => {
  it("keeps exact uploaded recipe matches out of operational planning until review", async () => {
    const dataRoot = createDataRoot();
    const library = new RecipeLibrary({ rootDir: dataRoot });
    const recipe = uploadedRecipe();

    try {
      await library.save({ businessId: "local" }, recipe);

      expect(recipe.source.approvalState).toBe("review_required");
      expect(recipe.dietTags).toContain("vegan");
      expect(recipe.allergens).toContain("nuts");
      expect(isRecipeEligibleForOperationalPlanning(recipe)).toBe(false);
      await expect(library.findCandidates({ businessId: "local" }, { label: "Vegan Coconut Bowl" })).resolves.toEqual([]);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("separates human approval from production verification for uploaded recipes", async () => {
    const dataRoot = createDataRoot();
    const library = new RecipeLibrary({ rootDir: dataRoot });
    const recipe = uploadedRecipe();

    try {
      await library.save({ businessId: "local" }, recipe);
      const approved = await library.reviewRecipe({ businessId: "local" }, recipe.recipeId, { decision: "approve" });

      expect(approved.source.approvalState).toBe("approved_internal");
      expect(approved.source.tier).toBe("internal_approved");
      expect(isRecipeEligibleForOperationalPlanning(approved)).toBe(true);

      const verified = await library.reviewRecipe({ businessId: "local" }, recipe.recipeId, { decision: "verify" });

      expect(verified.source.approvalState).toBe("approved_internal");
      expect(verified.source.tier).toBe("internal_verified");
      expect(isRecipeEligibleForOperationalPlanning(verified)).toBe(true);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
