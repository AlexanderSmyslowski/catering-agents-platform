import { describe, expect, it } from "vitest";
import { buildProductionRecipePanelState } from "../backoffice-ui/src/production-recipe-panel-state.js";

describe("production recipe panel state", () => {
  it("maps recipe status, upload, and library values without recomputing behavior", () => {
    const recipeReviewCounts = { approved: 2, reviewRequired: 1, rejected: 0 };
    const recipeFile = new File(["recipe"], "kartoffelsalat.txt", { type: "text/plain" });
    const filteredRecipes = [{ recipeId: "recipe-1", name: "Kartoffelsalat" }];

    const recipePanelState = buildProductionRecipePanelState({
      recipeReviewStatusLabel: "1 zu prüfen",
      recipeUsageStatusLabel: "Freigegebene Rezepte bleiben verwendbar",
      recipeReviewCounts,
      recipeCount: 3,
      recipeName: "Kartoffelsalat",
      recipeFile,
      filteredRecipes
    });

    expect(recipePanelState.recipeStatus).toEqual({
      recipeReviewStatusLabel: "1 zu prüfen",
      recipeUsageStatusLabel: "Freigegebene Rezepte bleiben verwendbar",
      recipeReviewCounts,
      recipeCount: 3
    });
    expect(recipePanelState.recipeUpload.recipeName).toBe("Kartoffelsalat");
    expect(recipePanelState.recipeUpload.recipeFile).toBe(recipeFile);
    expect(recipePanelState.recipeLibrary.filteredRecipes).toBe(filteredRecipes);
  });

  it("keeps empty recipe upload and library state explicit", () => {
    const recipePanelState = buildProductionRecipePanelState({
      recipeReviewStatusLabel: "keine offene Prüfung",
      recipeUsageStatusLabel: "Noch keine freigegebenen Rezepte im Bestand",
      recipeReviewCounts: { approved: 0, reviewRequired: 0, rejected: 0 },
      recipeCount: 0,
      recipeName: "",
      recipeFile: null,
      filteredRecipes: []
    });

    expect(recipePanelState.recipeUpload).toEqual({ recipeName: "", recipeFile: null });
    expect(recipePanelState.recipeLibrary.filteredRecipes).toEqual([]);
    expect(recipePanelState.recipeStatus.recipeCount).toBe(0);
  });
});
