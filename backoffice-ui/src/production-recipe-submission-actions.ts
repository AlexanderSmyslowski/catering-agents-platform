import type {
  RecipeReviewDecision,
  RecipeUploadTarget
} from "./api.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionRecipeSubmissionActionServices = {
  uploadRecipeFile: (target: RecipeUploadTarget, file: File, recipeName?: string) => Promise<unknown>;
  reviewRecipe: (
    target: RecipeUploadTarget,
    recipeId: string,
    decision: RecipeReviewDecision
  ) => Promise<unknown>;
};

export type ProductionRecipeSubmissionActionState = {
  recipeFile: File | null;
  recipeName: string;
};

export type ProductionRecipeSubmissionActionCallbacks = {
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  clearRecipeUploadDraft: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export type ProductionRecipeSubmissionActionsInput =
  ProductionRecipeSubmissionActionServices &
  ProductionRecipeSubmissionActionState &
  ProductionRecipeSubmissionActionCallbacks;

export type ProductionRecipeSubmissionActions = {
  handleRecipeUpload: (target: RecipeUploadTarget) => Promise<void>;
  handleRecipeReview: (
    target: RecipeUploadTarget,
    recipeId: string,
    decision: RecipeReviewDecision
  ) => Promise<void>;
};

export function buildProductionRecipeSubmissionActions({
  uploadRecipeFile,
  reviewRecipe,
  recipeFile,
  recipeName,
  setSubmitting,
  clearMessages,
  clearRecipeUploadDraft,
  refreshDashboard,
  setNotice,
  setError
}: ProductionRecipeSubmissionActionsInput): ProductionRecipeSubmissionActions {
  return {
    handleRecipeUpload: async (target) => {
      if (!recipeFile) {
        setError("Bitte wähle zuerst eine Rezeptdatei aus.");
        return;
      }

      setSubmitting(true);
      clearMessages();
      try {
        await uploadRecipeFile(target, recipeFile, recipeName);
        clearRecipeUploadDraft();
        await refreshDashboard();
        setNotice("Rezeptdatei wurde in die gemeinsame Bibliothek übernommen.");
      } catch (submitError) {
        setError(formatSubmitErrorMessage(submitError, "Rezept konnte nicht hochgeladen werden."));
      } finally {
        setSubmitting(false);
      }
    },
    handleRecipeReview: async (target, recipeId, decision) => {
      setSubmitting(true);
      clearMessages();
      try {
        await reviewRecipe(target, recipeId, decision);
        await refreshDashboard();
        setNotice("Rezeptprüfung wurde gespeichert.");
      } catch (submitError) {
        setError(formatSubmitErrorMessage(submitError, "Rezeptprüfung konnte nicht gespeichert werden."));
      } finally {
        setSubmitting(false);
      }
    }
  };
}
