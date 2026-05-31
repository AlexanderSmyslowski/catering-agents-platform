import {
  buildProductionRecipeSubmissionActions,
  type ProductionRecipeSubmissionActionsInput
} from "./production-recipe-submission-actions.js";
import type { ProductionRecipeActions } from "./production-recipe-library-panel.js";

export type ProductionRecipeDraftActions = {
  setRecipeName: (value: string) => void;
  setRecipeFile: (file: File | null) => void;
};

export type ProductionRecipeControlsInput =
  ProductionRecipeSubmissionActionsInput &
  ProductionRecipeDraftActions;

export type ProductionRecipeControls = ProductionRecipeActions;

export function buildProductionRecipeControls(
  input: ProductionRecipeControlsInput
): ProductionRecipeControls {
  const { handleRecipeUpload, handleRecipeReview } = buildProductionRecipeSubmissionActions({
    uploadRecipeFile: input.uploadRecipeFile,
    reviewRecipe: input.reviewRecipe,
    recipeFile: input.recipeFile,
    recipeName: input.recipeName,
    setSubmitting: input.setSubmitting,
    clearMessages: input.clearMessages,
    clearRecipeUploadDraft: input.clearRecipeUploadDraft,
    refreshDashboard: input.refreshDashboard,
    setNotice: input.setNotice,
    setError: input.setError
  });

  return {
    setRecipeName: input.setRecipeName,
    setRecipeFile: input.setRecipeFile,
    uploadRecipe: handleRecipeUpload,
    reviewRecipe: handleRecipeReview
  };
}
