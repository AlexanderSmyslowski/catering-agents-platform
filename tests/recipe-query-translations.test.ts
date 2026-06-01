import { describe, expect, it } from "vitest";
import { translateLabelForLocale } from "../production-service/src/recipe-discovery/recipe-query-translations.js";

describe("recipe query translations", () => {
  it("leaves German recipe labels unchanged", () => {
    expect(translateLabelForLocale("KALBSBULETTEN", "de")).toBe("KALBSBULETTEN");
  });

  it("translates established German catering labels for English search corridors", () => {
    expect(translateLabelForLocale("KALBSBULETTEN mit SCHMORZWIEBELN", "en")).toBe(
      "veal meatballs mit braised onions"
    );
    expect(
      translateLabelForLocale("WILDKRÄUTERSALAT mit PETERSILIEN-VINAIGRETTE", "en")
    ).toBe("wild herb salad mit parsley vinaigrette");
  });

  it("normalizes whitespace after replacing known label fragments", () => {
    expect(translateLabelForLocale("  TOMATENSUPPE   mit   BAGUETTE  ", "en")).toBe(
      "tomato soup mit baguette"
    );
  });
});
