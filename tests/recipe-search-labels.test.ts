import { describe, expect, it } from "vitest";
import {
  cleanedSearchLabel,
  primarySearchSegment
} from "../production-service/src/recipe-discovery/recipe-search-labels.js";

describe("recipe search labels", () => {
  it("removes noisy menu suffix segments while preserving useful label text", () => {
    expect(cleanedSearchLabel("KARTOFFELSALAT | DE LUX | TOPPING")).toBe("KARTOFFELSALAT");
    expect(cleanedSearchLabel("WILDKRÄUTERSALAT | PETERSILIEN-VINAIGRETTE")).toBe(
      "WILDKRÄUTERSALAT PETERSILIEN-VINAIGRETTE"
    );
  });

  it("normalizes separators and whitespace in search labels", () => {
    expect(cleanedSearchLabel("  PILZE / ZUCCHINI & ZUCKERSCHOTEN  ")).toBe(
      "PILZE ZUCCHINI ZUCKERSCHOTEN"
    );
  });

  it("keeps the first menu segment as the primary search segment", () => {
    expect(primarySearchSegment("KRAUT-KAROTTENSALAT | NUSS-TOPPING")).toBe(
      "KRAUT-KAROTTENSALAT"
    );
    expect(primarySearchSegment("  TOMATENSUPPE  ")).toBe("TOMATENSUPPE");
  });
});
