import { describe, expect, it } from "vitest";
import type { MenuComponent } from "@catering/shared-core";
import { dishArchetypeForComponent } from "../production-service/src/recipe-discovery/recipe-dish-archetypes.js";

function component(label: string): MenuComponent {
  return {
    componentId: "component-1",
    label,
    menuCategory: "vegan",
    serviceStyle: "buffet"
  };
}

describe("recipe dish archetypes", () => {
  it("maps established dish labels to localized archetypes", () => {
    expect(dishArchetypeForComponent(component("SCHOKOLADENKUCHEN"), "de")).toBe("kuchen");
    expect(dishArchetypeForComponent(component("SCHOKOLADENKUCHEN"), "en")).toBe("cake");
    expect(dishArchetypeForComponent(component("LINSENEINTOPF"), "de")).toBe("eintopf");
    expect(dishArchetypeForComponent(component("LINSENEINTOPF"), "en")).toBe("stew");
  });

  it("keeps shared archetype labels when localization is not distinct", () => {
    expect(dishArchetypeForComponent(component("VEGANES CURRY"), "de")).toBe("curry");
    expect(dishArchetypeForComponent(component("VEGANES CURRY"), "en")).toBe("curry");
    expect(dishArchetypeForComponent(component("KARTOFFELGRATIN"), "de")).toBe("gratin");
    expect(dishArchetypeForComponent(component("KARTOFFELGRATIN"), "en")).toBe("gratin");
  });

  it("recognizes common catering side archetypes without inventing unknown matches", () => {
    expect(dishArchetypeForComponent(component("PILZE | ZUCCHINI | ZUCKERSCHOTEN"), "en")).toBe(
      "vegetable stir fry"
    );
    expect(dishArchetypeForComponent(component("BAGUETTE"), "de")).toBe("brot");
    expect(dishArchetypeForComponent(component("Unbekannte Speise"), "de")).toBeUndefined();
  });
});
