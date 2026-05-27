export type RecipeReviewCounts = {
  approved: number;
  reviewRequired: number;
  rejected: number;
};

export function countRecipeReviewStates(recipes: Array<Record<string, unknown>>): RecipeReviewCounts {
  return recipes.reduce<RecipeReviewCounts>(
    (counts, recipe) => {
      const approvalState = String((recipe.source as Record<string, unknown> | undefined)?.approvalState ?? "");
      if (approvalState === "approved_internal") {
        counts.approved += 1;
      } else if (approvalState === "review_required") {
        counts.reviewRequired += 1;
      } else if (approvalState === "rejected") {
        counts.rejected += 1;
      }
      return counts;
    },
    { approved: 0, reviewRequired: 0, rejected: 0 }
  );
}

export function formatRecipeReviewStatusLabel(counts: RecipeReviewCounts): string {
  return counts.reviewRequired > 0 ? `${counts.reviewRequired} zu prüfen` : "keine offene Prüfung";
}

export function formatRecipeUsageStatusLabel(counts: RecipeReviewCounts): string {
  return counts.approved > 0 ? "Freigegebene Rezepte bleiben verwendbar" : "Noch keine freigegebenen Rezepte im Bestand";
}
