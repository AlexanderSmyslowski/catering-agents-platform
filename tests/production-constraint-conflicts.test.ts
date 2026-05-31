import { describe, expect, it } from "vitest";
import { productionConstraintConflictReason } from "../production-service/src/rules/production-constraint-conflicts.js";

function recipe(name: string, ingredientNames: string[], dietTags: string[] = []) {
  return {
    name,
    dietTags,
    ingredients: ingredientNames.map((ingredientName) => ({
      name: ingredientName
    }))
  };
}

describe("production constraint conflicts", () => {
  it("blocks gluten-free intake constraints when recipe text contains gluten carriers", () => {
    expect(
      productionConstraintConflictReason(recipe("Brot & Baguette", ["Weizenmehl"]), ["gluten_free"])
    ).toBe("Harte Intake-Restriktion gluten_free blockiert die Rezeptwahl für Brot & Baguette.");
  });

  it("blocks vegan intake constraints when recipe text contains animal products", () => {
    expect(
      productionConstraintConflictReason(recipe("Quiche", ["Ei", "Sahne"]), ["vegan"])
    ).toBe("Harte Intake-Restriktion vegan blockiert die Rezeptwahl für Quiche.");
  });

  it("blocks vegetarian intake constraints when recipe text contains meat or fish", () => {
    expect(
      productionConstraintConflictReason(recipe("Fingerfood", ["Lachs", "Dill"]), ["vegetarian"])
    ).toBe("Harte Intake-Restriktion vegetarian blockiert die Rezeptwahl für Fingerfood.");
  });

  it("returns no conflict for compatible recipes, empty constraints or malformed recipes", () => {
    expect(productionConstraintConflictReason(recipe("Gemuesepfanne", ["Zucchini"]), ["vegan"])).toBeUndefined();
    expect(productionConstraintConflictReason(recipe("Gemuesepfanne", ["Zucchini"]), [])).toBeUndefined();
    expect(productionConstraintConflictReason(undefined, ["vegan"])).toBeUndefined();
  });

  it("falls back to a generic component label when the recipe has no name", () => {
    expect(
      productionConstraintConflictReason({ ingredients: [{ name: "Sahne" }] }, ["vegan"])
    ).toBe("Harte Intake-Restriktion vegan blockiert die Rezeptwahl für diese Komponente.");
  });
});
