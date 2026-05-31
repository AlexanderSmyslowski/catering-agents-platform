import type {
  ProductionRecipeLibraryState,
  ProductionRecipeStatusState,
  ProductionRecipeUploadState
} from "./production-recipe-library-panel.js";

export type ProductionRecipePanelStateInput = {
  recipeReviewStatusLabel: string;
  recipeUsageStatusLabel: string;
  recipeReviewCounts: ProductionRecipeStatusState["recipeReviewCounts"];
  recipeCount: number;
  recipeName: string;
  recipeFile: File | null;
  filteredRecipes: Array<Record<string, unknown>>;
};

export type ProductionRecipePanelState = {
  recipeStatus: ProductionRecipeStatusState;
  recipeUpload: ProductionRecipeUploadState;
  recipeLibrary: ProductionRecipeLibraryState;
};

export function buildProductionRecipePanelState({
  recipeReviewStatusLabel,
  recipeUsageStatusLabel,
  recipeReviewCounts,
  recipeCount,
  recipeName,
  recipeFile,
  filteredRecipes
}: ProductionRecipePanelStateInput): ProductionRecipePanelState {
  return {
    recipeStatus: {
      recipeReviewStatusLabel,
      recipeUsageStatusLabel,
      recipeReviewCounts,
      recipeCount
    },
    recipeUpload: {
      recipeName,
      recipeFile
    },
    recipeLibrary: {
      filteredRecipes
    }
  };
}
