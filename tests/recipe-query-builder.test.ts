import { describe, expect, it } from "vitest";
import type { AcceptedEventSpec, MenuComponent, Recipe } from "@catering/shared-core";
import {
  buildSearchQueries,
  cleanedSearchLabel,
  componentSearchTokens,
  dishArchetypeForComponent,
  leadSpecificPrimaryToken,
  primarySearchSegment,
  recipeSearchText,
  specificPrimaryFocusTokens,
  translateLabelForLocale,
  webSpecificFocusTokens
} from "../production-service/src/recipe-discovery/recipe-query-builder.js";

function component(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-1",
    label: "KRAUT-KAROTTENSALAT | NUSS-TOPPING",
    menuCategory: "vegan",
    serviceStyle: "buffet",
    ...overrides
  };
}

const eventSpec = {
  servicePlan: {
    eventType: "lunch",
    serviceForm: "buffet"
  }
} as AcceptedEventSpec;

describe("recipe query builder", () => {
  it("keeps noisy menu suffixes out of cleaned search labels while preserving the primary segment", () => {
    const label = "KARTOFFELSALAT | DE LUX | TOPPING";

    expect(primarySearchSegment(label)).toBe("KARTOFFELSALAT");
    expect(cleanedSearchLabel(label)).toBe("KARTOFFELSALAT");
  });

  it("translates established catering labels for English web search", () => {
    expect(translateLabelForLocale("KALBSBULETTEN mit SCHMORZWIEBELN", "en")).toBe(
      "veal meatballs mit braised onions"
    );
    expect(translateLabelForLocale("KALBSBULETTEN", "de")).toBe("KALBSBULETTEN");
  });

  it("derives archetypes and focused tokens for deterministic recipe matching", () => {
    const krautSalat = component();
    const gemuese = component({
      label: "PILZE | ZUCCHINI | ZUCKERSCHOTEN | BABY-PAK-CHOI"
    });

    expect(dishArchetypeForComponent(krautSalat, "de")).toBe("salat");
    expect(dishArchetypeForComponent(gemuese, "en")).toBe("vegetable stir fry");
    expect(specificPrimaryFocusTokens(krautSalat)).toEqual(expect.arrayContaining(["kraut", "karotten"]));
    expect(leadSpecificPrimaryToken(krautSalat)).toBe("kraut");
    expect(webSpecificFocusTokens(gemuese)).toEqual(expect.arrayContaining(["pilze", "mushrooms"]));
  });

  it("builds deduplicated German and English query corridors from labels, classification and event context", () => {
    const cake = component({
      label: "SCHOKOLADENKUCHEN | vegan",
      menuCategory: "vegan"
    });

    expect(buildSearchQueries(cake, eventSpec, "de")).toEqual(
      expect.arrayContaining([
        "SCHOKOLADENKUCHEN vegan rezept",
        "vegan kuchen rezept",
        "schokoladen blechkuchen rezept",
        "SCHOKOLADENKUCHEN vegan lunch rezept"
      ])
    );
    expect(buildSearchQueries(cake, eventSpec, "en")).toEqual(
      expect.arrayContaining([
        "chocolate cake vegan recipe",
        "vegan cake recipe",
        "chocolate sheet cake recipe",
        "chocolate cake vegan catering recipe"
      ])
    );
  });

  it("builds comparable text for internal recipes and component search tokens", () => {
    const recipe = {
      name: "Veganer Schokoladenkuchen",
      dietTags: ["vegan"],
      source: {
        reference: "internal/schokoladenkuchen"
      },
      ingredients: [
        { name: "Kakao" },
        { name: "Mehl" }
      ]
    } as Recipe;

    expect(recipeSearchText(recipe)).toContain("Veganer Schokoladenkuchen");
    expect(recipeSearchText(recipe)).toContain("internal/schokoladenkuchen");
    expect(recipeSearchText(recipe)).toContain("Kakao Mehl");
    expect(componentSearchTokens(component({ label: "TOMATENSUPPE" }))).toEqual(
      expect.arrayContaining(["tomatensuppe", "tomato", "soup", "suppe"])
    );
  });
});
