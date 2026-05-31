import { describe, expect, it } from "vitest";
import { normalizeRecipeResolution } from "../production-service/src/rules/planning-recipe-resolution.js";

describe("planning recipe resolution normalizer", () => {
  it("keeps valid resolution objects intact for the planner", () => {
    const recipe = { recipeId: "recipe-1", name: "Tomatensuppe" };
    const selection = {
      componentId: "component-1",
      recipeId: "recipe-1",
      selectionReason: "Internes Rezept gewählt.",
      autoUsedInternetRecipe: false,
      searchTrace: ["Bibliothekstreffer"]
    };
    const unresolvedItems = ["Rezept muss geprüft werden."];

    const normalized = normalizeRecipeResolution(
      {
        recipe,
        selection,
        unresolvedItems
      },
      "Tomatensuppe"
    );

    expect(normalized.recipe).toBe(recipe);
    expect(normalized.selection).toBe(selection);
    expect(normalized.unresolvedItems).toBe(unresolvedItems);
  });

  it("rejects non-object or incomplete planning responses with the existing fallback copy", () => {
    expect(() => normalizeRecipeResolution(undefined, "Mystery Bowl")).toThrow(
      "Ungültige Planungsantwort für Mystery Bowl."
    );
    expect(() => normalizeRecipeResolution({ selection: { componentId: "component-1" } }, "Mystery Bowl")).toThrow(
      "Ungültige Planungsantwort für Mystery Bowl."
    );
  });

  it("requires unresolved items to stay an explicit string list", () => {
    expect(() =>
      normalizeRecipeResolution(
        {
          selection: {
            componentId: "component-1",
            selectionReason: "Kein Rezept gefunden.",
            autoUsedInternetRecipe: false
          },
          unresolvedItems: ["ok", 123]
        },
        "Mystery Bowl"
      )
    ).toThrow("Ungültige Planungsantwort für Mystery Bowl.");
  });
});
