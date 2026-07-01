import { describe, expect, it, vi } from "vitest";
import {
  buildProductionRecipeControls,
  type ProductionRecipeControlsInput
} from "../backoffice-ui/src/production-recipe-controls.js";

function input(overrides: Partial<ProductionRecipeControlsInput> = {}): ProductionRecipeControlsInput {
  return {
    uploadRecipeFile: vi.fn(async () => ({ recipe: {} })),
    reviewRecipe: vi.fn(async () => ({ recipe: {} })),
    recipeFile: new File(["Rezept"], "focaccia.txt", { type: "text/plain" }),
    recipeName: "Focaccia",
    setRecipeName: vi.fn(),
    setRecipeFile: vi.fn(),
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    clearRecipeUploadDraft: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("production recipe controls", () => {
  it("keeps recipe draft setters as the route-facing controls", () => {
    const actionsInput = input();
    const controls = buildProductionRecipeControls(actionsInput);

    controls.setRecipeName("Buffet-Focaccia");
    controls.setRecipeFile(null);

    expect(controls.setRecipeName).toBe(actionsInput.setRecipeName);
    expect(controls.setRecipeFile).toBe(actionsInput.setRecipeFile);
    expect(actionsInput.setRecipeName).toHaveBeenCalledWith("Buffet-Focaccia");
    expect(actionsInput.setRecipeFile).toHaveBeenCalledWith(null);
  });

  it("uploads the selected recipe through the existing submission path", async () => {
    const file = new File(["Rezept"], "kartoffelgratin.txt", { type: "text/plain" });
    const actionsInput = input({
      recipeFile: file,
      recipeName: "Kartoffelgratin"
    });
    const controls = buildProductionRecipeControls(actionsInput);

    await controls.uploadRecipe("production");

    expect(actionsInput.uploadRecipeFile).toHaveBeenCalledWith("production", file, "Kartoffelgratin");
    expect(actionsInput.clearRecipeUploadDraft).toHaveBeenCalledTimes(1);
    expect(actionsInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionsInput.setNotice).toHaveBeenCalledWith(
      "Rezeptdatei wurde zur Prüfung in die gemeinsame Bibliothek übernommen."
    );
    expect(actionsInput.setError).not.toHaveBeenCalled();
  });

  it("stores recipe reviews through the route-facing review control", async () => {
    const actionsInput = input();
    const controls = buildProductionRecipeControls(actionsInput);

    await controls.reviewRecipe("production", "recipe-42", "approve");

    expect(actionsInput.reviewRecipe).toHaveBeenCalledWith("production", "recipe-42", "approve");
    expect(actionsInput.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actionsInput.setNotice).toHaveBeenCalledWith("Rezeptprüfung wurde gespeichert.");
    expect(actionsInput.setError).not.toHaveBeenCalled();
  });
});
