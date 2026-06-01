import { describe, expect, it } from "vitest";
import {
  culinaryExpansionsForToken,
  deriveCompoundStemTokens,
  normalizeComparableText,
  normalizeTokens,
  rawComparableTokens,
  searchableSpecificTokens,
  tokensRoughlyMatch,
  tokensSpecificallyMatch
} from "../production-service/src/recipe-discovery/recipe-text-normalization.js";

describe("recipe text normalization", () => {
  it("expands culinary tokens without dropping original tokens", () => {
    expect(normalizeTokens("Gemüsepfanne mit Basmatireis")).toEqual(
      expect.arrayContaining(["gemüsepfanne", "vegetable", "stir", "fry", "basmatireis", "basmati", "rice"])
    );
  });

  it("exposes culinary expansions for focused matching without leaking the map", () => {
    const expansions = culinaryExpansionsForToken("gemuesepfanne");

    expect(expansions).toEqual(["vegetable", "stir", "fry"]);
    expect(culinaryExpansionsForToken("unknown")).toEqual([]);

    expansions.push("mutated");
    expect(culinaryExpansionsForToken("gemuesepfanne")).toEqual(["vegetable", "stir", "fry"]);
  });

  it("normalizes comparable text for ASCII token matching", () => {
    expect(normalizeComparableText("Gemüsepfanne à la Straße")).toBe("gemusepfanne a la strasse");
    expect(rawComparableTokens("Auberginen-Röllchen")).toEqual(["auberginen", "rollchen"]);
  });

  it("derives compound stems for common dish suffixes", () => {
    expect(deriveCompoundStemTokens("schokoladenkuchen")).toEqual(["schokoladen"]);
    expect(deriveCompoundStemTokens("kartoffelsalat")).toEqual(["kartoffel"]);
    expect(deriveCompoundStemTokens("quiche")).toEqual([]);
  });

  it("adds adjacent compound tokens for specific recipe matching", () => {
    expect(searchableSpecificTokens("Kartoffel Gratin")).toEqual(
      expect.arrayContaining(["kartoffel", "gratin", "kartoffelgratin"])
    );
  });

  it("keeps rough token matching permissive for shared prefixes and containment", () => {
    expect(tokensRoughlyMatch("schokoladenkuchen", "kuchen")).toBe(true);
    expect(tokensRoughlyMatch("gemuese", "gemuesepfanne")).toBe(true);
    expect(tokensRoughlyMatch("curry", "salat")).toBe(false);
  });

  it("keeps specific token matching tied to explicit aliases or strong prefixes", () => {
    expect(tokensSpecificallyMatch("hummus", "humus")).toBe(true);
    expect(tokensSpecificallyMatch("gemuesepfanne", "stirfry")).toBe(true);
    expect(tokensSpecificallyMatch("curry", "salat")).toBe(false);
  });
});
