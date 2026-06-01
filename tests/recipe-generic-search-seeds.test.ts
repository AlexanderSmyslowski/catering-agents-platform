import { describe, expect, it } from "vitest";
import type { MenuComponent } from "@catering/shared-core";
import { genericSearchSeeds } from "../production-service/src/recipe-discovery/recipe-generic-search-seeds.js";

function component(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-1",
    label: "SCHOKOLADENKUCHEN",
    menuCategory: "vegan",
    serviceStyle: "buffet",
    ...overrides
  };
}

describe("recipe generic search seeds", () => {
  it("adds localized cake seeds and buffet sheet-cake seeds", () => {
    expect(genericSearchSeeds(component(), "de")).toEqual(
      expect.arrayContaining(["kuchen", "schokoladenkuchen", "veganer schokoladenkuchen", "schokoladen blechkuchen"])
    );
    expect(genericSearchSeeds(component(), "en")).toEqual(
      expect.arrayContaining(["cake", "chocolate cake", "vegan chocolate cake", "chocolate sheet cake"])
    );
  });

  it("keeps non-buffet cake seeds without buffet sheet-cake expansion", () => {
    expect(genericSearchSeeds(component({ serviceStyle: "flying" }), "en")).not.toContain(
      "chocolate sheet cake"
    );
  });

  it("adds established side-dish and curry seeds without inventing unknown seeds", () => {
    expect(genericSearchSeeds(component({ label: "KRAUT-KAROTTENSALAT" }), "en")).toEqual(
      expect.arrayContaining(["salad", "coleslaw cabbage carrot"])
    );
    expect(genericSearchSeeds(component({ label: "PILZE | ZUCCHINI | ZUCKERSCHOTEN" }), "de")).toEqual(
      expect.arrayContaining(["gemüsepfanne"])
    );
    expect(genericSearchSeeds(component({ label: "Unbekannte Speise" }), "de")).toEqual([]);
  });
});
