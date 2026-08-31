import { describe, expect, it } from "vitest";
import { parseUploadedRecipeText } from "@catering/shared-core";

function recipeText(lines: string[]): string {
  return [
    "Rezept: Roastbeef mit Drillinge",
    ...lines,
    "Zubereitung",
    "Roastbeef garen und vor dem Servieren ruhen lassen."
  ].join("\n");
}

describe("recipe yield integrity", () => {
  it("parses a label-before-number yield and preserves 3100 g at the matching target", () => {
    const recipe = parseUploadedRecipeText({
      filename: "roastbeef.txt",
      text: recipeText([
        "Portionen: 45",
        "3100 g Roastbeef",
        "3150 g Drillinge"
      ])
    });

    expect(recipe.baseYield.servings).toBe(45);
    expect(recipe.scalingRules.batchSize).toBe(45);
    expect(recipe.ingredients.find((ingredient) => ingredient.name === "Roastbeef")?.quantity).toEqual({
      amount: 3100,
      unit: "g"
    });
  });

  it("keeps the existing number-before-label form and only defaults when there is no yield hint", () => {
    const eightPortions = parseUploadedRecipeText({
      filename: "eight.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef"])
    });
    const noYieldHint = parseUploadedRecipeText({
      filename: "without-yield.txt",
      text: recipeText(["500 g Roastbeef"])
    });

    expect(eightPortions.baseYield.servings).toBe(8);
    expect(noYieldHint.baseYield.servings).toBe(8);
  });

  it("preserves the compact historical number-before-label yield form", () => {
    const recipe = parseUploadedRecipeText({
      filename: "compact-yield.txt",
      text: recipeText(["45Portionen", "500 g Roastbeef"])
    });

    expect(recipe.baseYield.servings).toBe(45);
  });

  it("rejects a compact number-before-label token with an attached label suffix", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "compact-label-suffix-yield.txt",
        text: recipeText(["45Portionenabc", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects an embedded compact number-before-label token instead of defaulting", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "embedded-compact-yield.txt",
        text: recipeText(["abc7Portionen", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects a spaced number-before-label token with an attached label suffix", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "spaced-label-suffix-yield.txt",
        text: recipeText(["45 Portionenabc", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects a compact label-before-number token instead of defaulting", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "compact-label-yield.txt",
        text: recipeText(["Portionen45", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects an overlong compact number-before-label token instead of defaulting", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "overlong-compact-yield.txt",
        text: recipeText(["12345Portionen", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it.each(["-45Portionen", "+45Portionen", "−45Portionen"])(
    "rejects a compact signed number-before-label token instead of defaulting: %s",
    (hint) => {
      expect(() =>
        parseUploadedRecipeText({
          filename: "signed-compact-yield.txt",
          text: recipeText([hint, "500 g Roastbeef"])
        })
      ).toThrow();
    }
  );

  it("rejects a signed yield token instead of reading its positive suffix", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "signed-yield.txt",
        text: recipeText(["-8 Portionen", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects a Unicode-minus yield token", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "unicode-minus-yield.txt",
        text: recipeText(["−8 Portionen", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects a yield token embedded in a word", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "embedded-yield.txt",
        text: recipeText(["Portionen: 8abc", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects a yield token embedded after an underscore", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "underscored-yield.txt",
        text: recipeText(["Portionen: 8_abc", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects a yield token after an identifier connector", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "prefixed-yield.txt",
        text: recipeText(["abc_8 Portionen", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("rejects a yield token followed by another slash-delimited token", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "slash-yield.txt",
        text: recipeText(["Portionen: 8/abc", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it.each(["Portionen: 8 %", "Portionen: 8 /abc", "Portionen: 8 _abc"])(
    "rejects a yield token followed by a whitespace-separated connector: %s",
    (hint) => {
      expect(() =>
        parseUploadedRecipeText({
          filename: "spaced-suffix-yield.txt",
          text: recipeText([hint, "500 g Roastbeef"])
        })
      ).toThrow();
    }
  );

  it.each(["8 Portionen %", "8 Portionen /abc", "8 Portionen _abc"])(
    "rejects a number-before-label token followed by a whitespace-separated connector: %s",
    (hint) => {
      expect(() =>
        parseUploadedRecipeText({
          filename: "spaced-prefix-suffix-yield.txt",
          text: recipeText([hint, "500 g Roastbeef"])
        })
      ).toThrow();
    }
  );

  it("rejects a malformed yield hint even when another hint is valid", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "mixed-yield-hints.txt",
        text: recipeText(["Portionen: 8/abc", "8 Portionen", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it.each(["- 8 Portionen", "+ 8 Portionen", "− 8 Portionen"])(
    "rejects a whitespace-separated sign before a yield token: %s",
    (hint) => {
      expect(() =>
        parseUploadedRecipeText({
          filename: "spaced-sign-yield.txt",
          text: recipeText([hint, "500 g Roastbeef"])
        })
      ).toThrow();
    }
  );

  it("rejects a yield number longer than the supported token width", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "oversized-yield.txt",
        text: recipeText(["Portionen: 12345", "500 g Roastbeef"])
      })
    ).toThrow();
  });

  it("fails closed for invalid or contradictory yield hints instead of silently using eight", () => {
    expect(() =>
      parseUploadedRecipeText({
        filename: "invalid-yield.txt",
        text: recipeText(["Portionen: viele", "500 g Roastbeef"])
      })
    ).toThrow();

    expect(() =>
      parseUploadedRecipeText({
        filename: "contradictory-yield.txt",
        text: recipeText(["Portionen: 45", "8 Portionen", "500 g Roastbeef"])
      })
    ).toThrow();

    expect(() =>
      parseUploadedRecipeText({
        filename: "ambiguous-yield.txt",
        text: recipeText(["Portionen: 45-60", "500 g Roastbeef"])
      })
    ).toThrow();
  });
});

describe("recipe allergen integrity", () => {
  it.each(["Erdnuss", "Pekannuss", "Nussmix"])(
    "recognizes the controlled German nut compound %s as nuts",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `controlled-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).toContain("nuts");
    }
  );

  it.each([
    ["Weizenmehl", "gluten"],
    ["breadcrumbs", "gluten"],
    ["Milchpulver", "milk"],
    ["Macadamianuss", "nuts"]
  ])("recognizes the controlled composite %s as %s", (term, allergen) => {
    const recipe = parseUploadedRecipeText({
      filename: `composite-${term}.txt`,
      text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
    });

    expect(recipe.allergens).toContain(allergen);
  });

  it.each(["Vollmilch", "Buttermilch", "Kondensmilch", "Milchschokolade", "Buttercreme"])(
    "recognizes the controlled milk composite %s",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `milk-composite-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).toContain("milk");
    }
  );

  it("keeps a bare Butter ingredient classified as milk", () => {
    const recipe = parseUploadedRecipeText({
      filename: "butter.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef", "50 g Butter"])
    });

    expect(recipe.allergens).toContain("milk");
  });

  it.each(["Weizenstärke", "Weizenbrot", "Vollkornbrot"])(
    "recognizes the controlled gluten composite %s",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `gluten-composite-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).toContain("gluten");
    }
  );

  it.each(["Haselnusscreme", "Walnussöl", "Erdnussbutter", "Peanut", "Peanuts", "Peanut Butter"])(
    "recognizes the controlled nut composite %s",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `nut-composite-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).toContain("nuts");
    }
  );

  it.each(["Erdnussöl", "Haselnussmehl", "Pekannusskerne", "Nussnougat"])(
    "recognizes the controlled nut-root suffix %s",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `nut-root-suffix-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).toContain("nuts");
    }
  );

  it.each(["Walnussmehl", "Erdnusskerne", "Pekannussöl", "Nusscreme"])(
    "recognizes the controlled nut-root suffix combination %s",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `nut-root-suffix-combination-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).toContain("nuts");
    }
  );

  it.each(["Kalbsnussöl", "Genusscreme"])(
    "does not treat the embedded root in %s as a controlled nut compound",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `non-allergen-nut-root-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).not.toContain("nuts");
    }
  );

  it("recognizes the controlled Weizengrieß gluten suffix", () => {
    const recipe = parseUploadedRecipeText({
      filename: "wheat-suffix.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef", "50 g Weizengrieß"])
    });

    expect(recipe.allergens).toContain("gluten");
  });

  it("recognizes the controlled Butterkeks milk suffix", () => {
    const recipe = parseUploadedRecipeText({
      filename: "butter-suffix.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef", "50 g Butterkeks"])
    });

    expect(recipe.allergens).toContain("milk");
  });

  it.each(["Erdnussbutter", "Peanut Butter"])(
    "does not infer milk from the controlled nut-butter compound %s",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `nut-butter-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `50 g ${term}`])
      });

      expect(recipe.allergens).not.toContain("milk");
    }
  );

  it.each(["Minuten", "Bei", "Kalbsnuss", "Genuss"])(
    "does not classify the non-allergen word %s as nuts or egg",
    (term) => {
      const recipe = parseUploadedRecipeText({
        filename: `non-allergen-${term}.txt`,
        text: recipeText(["8 Portionen", "500 g Roastbeef", `Hinweis: ${term}`])
      });

      expect(recipe.allergens).not.toContain("nuts");
      expect(recipe.allergens).not.toContain("egg");
    }
  );

  it("uses word boundaries for German and English allergen terms", () => {
    const roastbeef = parseUploadedRecipeText({
      filename: "roastbeef-allergens.txt",
      text: recipeText([
        "Portionen: 45",
        "3100 g Roastbeef",
        "80 g Dijon-Senf",
        "Zubereitung",
        "30-35 Minuten garen."
      ]) + "\nAllergene: Ei, Senf"
    });
    const mustard = parseUploadedRecipeText({
      filename: "mustard.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef", "1 tsp Mustard"])
    });
    const noFalseEgg = parseUploadedRecipeText({
      filename: "temperature.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef", "Bei 4 °C lagern"])
    });
    const nuts = parseUploadedRecipeText({
      filename: "nuts.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef", "50 g Walnuts"])
    });
    const germanCompoundNuts = parseUploadedRecipeText({
      filename: "german-nuts.txt",
      text: recipeText(["8 Portionen", "500 g Roastbeef", "50 g Haselnuss", "50 g Walnuss"])
    });

    expect(roastbeef.allergens).toEqual(expect.arrayContaining(["egg", "mustard"]));
    expect(roastbeef.allergens).not.toContain("nuts");
    expect(mustard.allergens).toContain("mustard");
    expect(noFalseEgg.allergens).not.toContain("egg");
    expect(noFalseEgg.allergens).not.toContain("nuts");
    expect(nuts.allergens).toContain("nuts");
    expect(germanCompoundNuts.allergens).toContain("nuts");
  });
});
