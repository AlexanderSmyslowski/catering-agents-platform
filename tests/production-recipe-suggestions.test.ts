import { describe, expect, it } from "vitest";
import {
  recipeSuggestionsForComponent,
  resolveRecipeNameById
} from "../backoffice-ui/src/production-recipe-suggestions.js";

describe("production recipe suggestions", () => {
  const recipes = [
    {
      recipeId: "recipe-kalbsbuletten",
      name: "Kalbsbuletten mit Schmorzweibeln",
      source: { reference: "internal/kalbsbuletten.md" }
    },
    {
      recipeId: "recipe-schmorrzwiebeln",
      name: "Schmorzwiebeln Grundrezept",
      source: { reference: "internal/zwiebeln.md" }
    },
    {
      recipeId: "recipe-schokoladenkuchen",
      name: "Veganer Schokoladenkuchen",
      source: { reference: "internal/schoko.md" }
    },
    {
      recipeId: "recipe-generic-vegan",
      name: "Vegan Basisrezept",
      source: { reference: "internal/vegan.md" }
    }
  ];

  it("suggests matching recipes from names and source references in score order", () => {
    expect(recipeSuggestionsForComponent("KALBSBULETTEN | SCHMORZWIEBELN", recipes)).toEqual([
      { recipeId: "recipe-kalbsbuletten", name: "Kalbsbuletten mit Schmorzweibeln" },
      { recipeId: "recipe-schmorrzwiebeln", name: "Schmorzwiebeln Grundrezept" }
    ]);
  });

  it("ignores generic catering labels when building suggestion tokens", () => {
    expect(recipeSuggestionsForComponent("Vegan classic topping", recipes)).toEqual([]);
  });

  it("normalizes accents and sharp-s for component labels", () => {
    expect(recipeSuggestionsForComponent("Schokoladenkuchen süß", recipes)).toEqual([
      { recipeId: "recipe-schokoladenkuchen", name: "Veganer Schokoladenkuchen" }
    ]);
  });

  it("resolves selected recipe names while preserving recipe ids as fallback labels", () => {
    expect(resolveRecipeNameById("recipe-kalbsbuletten", recipes)).toBe("Kalbsbuletten mit Schmorzweibeln");
    expect(resolveRecipeNameById("missing", recipes)).toBeUndefined();
    expect(resolveRecipeNameById("recipe-without-name", [{ recipeId: "recipe-without-name", name: "" }])).toBe(
      "recipe-without-name"
    );
  });
});
