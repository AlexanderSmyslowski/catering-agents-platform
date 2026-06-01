import { describe, expect, it } from "vitest";
import {
  normalizeSearchQuery,
  uniqueNormalizedSearchQueries
} from "../production-service/src/recipe-discovery/recipe-search-query-normalization.js";

describe("recipe search query normalization", () => {
  it("collapses whitespace and adjacent duplicate tokens without reordering the query", () => {
    expect(normalizeSearchQuery("  vegan   vegan   kuchen   rezept  ")).toBe(
      "vegan kuchen rezept"
    );
    expect(normalizeSearchQuery("kuchen vegan kuchen rezept")).toBe(
      "kuchen vegan kuchen rezept"
    );
  });

  it("deduplicates only after normalization and drops empty queries", () => {
    expect(
      uniqueNormalizedSearchQueries([
        "",
        "SCHOKOLADENKUCHEN   vegan   rezept",
        "SCHOKOLADENKUCHEN vegan rezept",
        "vegan vegan kuchen rezept"
      ])
    ).toEqual(["SCHOKOLADENKUCHEN vegan rezept", "vegan kuchen rezept"]);
  });
});
