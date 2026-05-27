import { describe, expect, it } from "vitest";
import {
  buildRecipeOptionsForComponent,
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

  it("suggests chocolate cake recipes across German-English dessert aliases", () => {
    expect(
      recipeSuggestionsForComponent("Schokokuchen vegan", [
        {
          recipeId: "recipe-chocolate-cake",
          name: "Chocolate Cake vegan",
          source: { reference: "internal/chocolate-cake.md" }
        },
        {
          recipeId: "recipe-generic-vegan",
          name: "Vegan Basisrezept",
          source: { reference: "internal/vegan.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-chocolate-cake", name: "Chocolate Cake vegan" }]);
  });

  it("suggests internal recipes across common German-English catering aliases", () => {
    expect(
      recipeSuggestionsForComponent("KARTOFFELSALAT | DE LUX", [
        {
          recipeId: "recipe-potato-salad",
          name: "Potato Salad with Herbs",
          source: { reference: "internal/potato-salad.md" }
        },
        {
          recipeId: "recipe-caesar-salad",
          name: "Caesar Salad Buffet",
          source: { reference: "internal/caesar-salad.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-potato-salad", name: "Potato Salad with Herbs" }]);

    expect(
      recipeSuggestionsForComponent("NUDELSALAT | FRISCHGEDOENS", [
        {
          recipeId: "recipe-pasta-salat",
          name: "Pasta-Salat mit frischem Gemüse",
          source: { reference: "internal/pasta-salat.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-pasta-salat", name: "Pasta-Salat mit frischem Gemüse" }]);

    expect(
      recipeSuggestionsForComponent("KALBSFRIKADELLEN | SCHMORZWIEBELN", [
        {
          recipeId: "recipe-veal-meatballs",
          name: "Veal Meatballs with Braised Onions",
          source: { reference: "internal/veal-meatballs.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-veal-meatballs", name: "Veal Meatballs with Braised Onions" }]);
  });

  it("suggests internal coffee-break recipes across common German-English catering aliases", () => {
    expect(
      recipeSuggestionsForComponent("Mini-Muffins Blaubeere", [
        {
          recipeId: "recipe-blueberry-mini-muffins",
          name: "Blueberry Mini Muffins",
          source: { reference: "internal/blueberry-mini-muffins.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-blueberry-mini-muffins", name: "Blueberry Mini Muffins" }]);

    expect(
      recipeSuggestionsForComponent("Obstspiesse vegan", [
        {
          recipeId: "recipe-fruit-skewers",
          name: "Fruit Skewers vegan",
          source: { reference: "internal/fruit-skewers.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-fruit-skewers", name: "Fruit Skewers vegan" }]);
  });

  it("suggests tomato soup recipes across German-English catering aliases", () => {
    expect(
      recipeSuggestionsForComponent("Vegetarische Tomatensuppe", [
        {
          recipeId: "recipe-tomato-soup",
          name: "Tomato Soup vegetarian",
          source: { reference: "internal/tomato-soup.md" }
        },
        {
          recipeId: "recipe-vegetable-curry",
          name: "Vegetarisches Curry",
          source: { reference: "internal/vegetable-curry.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-tomato-soup", name: "Tomato Soup vegetarian" }]);
  });

  it("suggests lentil stew recipes across German-English catering aliases", () => {
    expect(
      recipeSuggestionsForComponent("Linseneintopf vegan", [
        {
          recipeId: "recipe-lentil-stew",
          name: "Lentil Stew vegan",
          source: { reference: "internal/lentil-stew.md" }
        },
        {
          recipeId: "recipe-vegetable-curry",
          name: "Vegetable Curry vegan",
          source: { reference: "internal/vegetable-curry.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-lentil-stew", name: "Lentil Stew vegan" }]);
  });

  it("suggests almond curry recipes across German-English quick-lunch aliases", () => {
    const suggestions = recipeSuggestionsForComponent("MANDEL-CURRY | BASMATIREIS & KORIANDER-TOPPING", [
      {
        recipeId: "recipe-vegetable-curry",
        name: "Vegetable Curry vegan",
        source: { reference: "internal/vegetable-curry.md" }
      },
      {
        recipeId: "recipe-almond-curry",
        name: "Almond Curry with Basmati Rice vegan",
        source: { reference: "internal/almond-curry-basmati-rice.md" }
      }
    ]);

    expect(suggestions[0]).toEqual({
      recipeId: "recipe-almond-curry",
      name: "Almond Curry with Basmati Rice vegan"
    });
  });

  it("suggests Hummus offer wording for internal Humus recipe spelling variants", () => {
    expect(
      recipeSuggestionsForComponent("Hummus vegan", [
        {
          recipeId: "recipe-humus-tahini",
          name: "Humus Tahini Dip vegan",
          source: { reference: "internal/humus-tahini.md" }
        },
        {
          recipeId: "recipe-generic-vegan",
          name: "Vegan Basisrezept",
          source: { reference: "internal/vegan.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-humus-tahini", name: "Humus Tahini Dip vegan" }]);
  });

  it("suggests eggplant roll recipes across German-English antipasti aliases", () => {
    expect(
      recipeSuggestionsForComponent("Auberginenröllchen vegan", [
        {
          recipeId: "recipe-eggplant-rolls",
          name: "Eggplant Rolls vegan",
          source: { reference: "internal/eggplant-rolls.md" }
        },
        {
          recipeId: "recipe-generic-vegan",
          name: "Vegan Basisrezept",
          source: { reference: "internal/vegan.md" }
        }
      ])
    ).toEqual([{ recipeId: "recipe-eggplant-rolls", name: "Eggplant Rolls vegan" }]);
  });

  it("suggests wild herb salad recipes across German-English buffet aliases", () => {
    const suggestions = recipeSuggestionsForComponent("Wildkräutersalat mit Petersilien-Vinaigrette", [
      {
        recipeId: "recipe-mixed-salad",
        name: "Mixed Salad with Vinaigrette",
        source: { reference: "internal/mixed-salad.md" }
      },
      {
        recipeId: "recipe-wild-herb-salad",
        name: "Wild Herb Salad Parsley Vinaigrette",
        source: { reference: "internal/wild-herb-salad.md" }
      }
    ]);

    expect(suggestions[0]).toEqual({
      recipeId: "recipe-wild-herb-salad",
      name: "Wild Herb Salad Parsley Vinaigrette"
    });
  });

  it("resolves selected recipe names while preserving recipe ids as fallback labels", () => {
    expect(resolveRecipeNameById("recipe-kalbsbuletten", recipes)).toBe("Kalbsbuletten mit Schmorzweibeln");
    expect(resolveRecipeNameById("missing", recipes)).toBeUndefined();
    expect(resolveRecipeNameById("recipe-without-name", [{ recipeId: "recipe-without-name", name: "" }])).toBe(
      "recipe-without-name"
    );
  });

  it("keeps a selected recipe override visible when it is not part of the current suggestions", () => {
    expect(
      buildRecipeOptionsForComponent({
        componentLabel: "Kartoffelsalat",
        recipes,
        selectedRecipeId: "recipe-kalbsbuletten"
      })
    ).toEqual([{ recipeId: "recipe-kalbsbuletten", name: "Kalbsbuletten mit Schmorzweibeln" }]);

    expect(
      buildRecipeOptionsForComponent({
        componentLabel: "Kartoffelsalat",
        recipes,
        selectedRecipeId: "external-recipe"
      })
    ).toEqual([{ recipeId: "external-recipe", name: "Rezept external-recipe" }]);
  });

  it("does not duplicate a selected recipe override that already matches the suggestions", () => {
    expect(
      buildRecipeOptionsForComponent({
        componentLabel: "Schokoladenkuchen",
        recipes,
        selectedRecipeId: "recipe-schokoladenkuchen"
      })
    ).toEqual([{ recipeId: "recipe-schokoladenkuchen", name: "Veganer Schokoladenkuchen" }]);
  });
});
