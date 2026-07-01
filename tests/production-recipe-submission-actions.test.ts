import { describe, expect, it, vi } from "vitest";
import {
  buildProductionRecipeSubmissionActions,
  type ProductionRecipeSubmissionActionsInput
} from "../backoffice-ui/src/production-recipe-submission-actions.js";

function input(overrides: Partial<ProductionRecipeSubmissionActionsInput> = {}): ProductionRecipeSubmissionActionsInput {
  return {
    uploadRecipeFile: vi.fn(async () => ({ recipe: {} })),
    reviewRecipe: vi.fn(async () => ({ recipe: {} })),
    recipeFile: new File(["Rezept"], "rezept.txt", { type: "text/plain" }),
    recipeName: "Focaccia",
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    clearRecipeUploadDraft: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production recipe submission actions", () => {
  it("keeps recipe upload inert when no file is selected", async () => {
    const actionsInput = input({ recipeFile: null });
    const actions = buildProductionRecipeSubmissionActions(actionsInput);

    await actions.handleRecipeUpload("production");

    expect(actionsInput.setError).toHaveBeenCalledWith("Bitte wähle zuerst eine Rezeptdatei aus.");
    expect(actionsInput.uploadRecipeFile).not.toHaveBeenCalled();
    expect(actionsInput.setSubmitting).not.toHaveBeenCalled();
    expect(actionsInput.clearMessages).not.toHaveBeenCalled();
  });

  it("uploads the selected recipe, clears the draft and refreshes the dashboard", async () => {
    const file = new File(["Rezept"], "focaccia.txt", { type: "text/plain" });
    const calls: string[] = [];
    const actionsInput = input({
      recipeFile: file,
      recipeName: " Focaccia ",
      uploadRecipeFile: vi.fn(async () => {
        calls.push("uploadRecipeFile");
      }),
      clearRecipeUploadDraft: vi.fn(() => {
        calls.push("clearRecipeUploadDraft");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      }),
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      })
    });
    const actions = buildProductionRecipeSubmissionActions(actionsInput);

    await actions.handleRecipeUpload("production");

    expect(actionsInput.uploadRecipeFile).toHaveBeenCalledWith("production", file, " Focaccia ");
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "uploadRecipeFile",
      "clearRecipeUploadDraft",
      "refreshDashboard",
      "setNotice:Rezeptdatei wurde zur Prüfung in die gemeinsame Bibliothek übernommen.",
      "setSubmitting:false"
    ]);
  });

  it("surfaces recipe upload failures and always exits submitting state", async () => {
    const actionsInput = input({
      uploadRecipeFile: vi.fn(async () => {
        throw new Error("Upload abgelehnt");
      })
    });
    const actions = buildProductionRecipeSubmissionActions(actionsInput);

    await actions.handleRecipeUpload("offer");

    expect(actionsInput.setError).toHaveBeenCalledWith("Upload abgelehnt");
    expect(actionsInput.clearRecipeUploadDraft).not.toHaveBeenCalled();
    expect(actionsInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });

  it("stores recipe reviews and refreshes the dashboard", async () => {
    const calls: string[] = [];
    const actionsInput = input({
      reviewRecipe: vi.fn(async () => {
        calls.push("reviewRecipe");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      }),
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      })
    });
    const actions = buildProductionRecipeSubmissionActions(actionsInput);

    await actions.handleRecipeReview("production", "recipe-1", "approve");

    expect(actionsInput.reviewRecipe).toHaveBeenCalledWith("production", "recipe-1", "approve");
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "reviewRecipe",
      "refreshDashboard",
      "setNotice:Rezeptprüfung wurde gespeichert.",
      "setSubmitting:false"
    ]);
  });

  it("surfaces recipe review failures and always exits submitting state", async () => {
    const actionsInput = input({
      reviewRecipe: vi.fn(async () => {
        throw new Error("Review abgelehnt");
      })
    });
    const actions = buildProductionRecipeSubmissionActions(actionsInput);

    await actions.handleRecipeReview("production", "recipe-2", "reject");

    expect(actionsInput.setError).toHaveBeenCalledWith("Review abgelehnt");
    expect(actionsInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
