import type { RecipeNumberFormat, RecipeImportReview } from "../../shared-core/src/recipe-library.js";
import type {
  RecipeReviewDecision,
  RecipeUploadTarget
} from "./api.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

export type ProductionRecipeSubmissionActionServices = {
  uploadRecipeFile: (target: RecipeUploadTarget, file: File, recipeName?: string, numberFormat?: RecipeNumberFormat, review?: RecipeImportReview) => Promise<unknown>;
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

export type RecipeImportSaveResult = { saved: boolean; message?: string };

export type ProductionRecipeSubmissionActions = {
  handleRecipeUpload: (target: RecipeUploadTarget, numberFormat?: RecipeNumberFormat, review?: RecipeImportReview) => Promise<RecipeImportSaveResult>;
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
    handleRecipeUpload: async (target, numberFormat, review) => {
      if (!recipeFile) {
        setError("Bitte wähle zuerst eine Rezeptdatei aus.");
        return { saved: false, message: "Bitte wähle zuerst eine Rezeptdatei aus." };
      }

      setSubmitting(true);
      clearMessages();
      let saved = false;
      try {
        if (review) await uploadRecipeFile(target, recipeFile, recipeName, numberFormat, review);
        else if (numberFormat) await uploadRecipeFile(target, recipeFile, recipeName, numberFormat);
        else await uploadRecipeFile(target, recipeFile, recipeName);
        saved = true;
        clearRecipeUploadDraft();
        await refreshDashboard();
        setNotice("Rezeptdatei wurde in die gemeinsame Bibliothek übernommen.");
        return { saved: true };
      } catch (submitError) {
        if (saved) {
          setNotice("Rezept wurde gespeichert. Die Ansicht konnte nicht neu geladen werden – bitte aktualisieren, nicht erneut hochladen.");
          return { saved: true };
        }
        const message = formatSubmitErrorMessage(submitError, "Rezept konnte nicht hochgeladen werden.");
        if (!review) setError(message);
        return { saved: false, message };
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
