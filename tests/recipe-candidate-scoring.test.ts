import { describe, expect, it } from "vitest";
import type { AcceptedEventSpec, MenuComponent, Recipe } from "@catering/shared-core";
import {
  candidateFormMismatch,
  fitScoreForRecipe,
  isStrongRecipeCandidate,
  leadNameMatchScore,
  primaryMatchScore,
  specificPrimaryMatchScore,
  webSpecificMatchScore
} from "../production-service/src/recipe-discovery/recipe-candidate-scoring.js";

function component(overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: "component-1",
    label: "SCHOKOLADENKUCHEN | vegan",
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

function recipe(overrides: { source?: Partial<Recipe["source"]> } = {}): Recipe {
  return {
    source: {
      approvalState: "review_required",
      qualityScore: 0.72,
      fitScore: 0.62,
      ...overrides.source
    }
  } as Recipe;
}

describe("recipe candidate scoring", () => {
  it("scores strong text, primary and specific matches for catering components", () => {
    const cake = component();
    const text = "Veganer Schokoladenkuchen als Blechkuchen fuer Buffet mit Kakao und Mehl";

    expect(fitScoreForRecipe(text, cake, eventSpec)).toBeGreaterThan(0.9);
    expect(primaryMatchScore(text, cake)).toBeGreaterThan(0.6);
    expect(specificPrimaryMatchScore(text, cake)).toBe(1);
    expect(webSpecificMatchScore("vegan chocolate cake sheet cake cocoa", cake)).toBeGreaterThan(0.6);
  });

  it("keeps lead-name score tied to the component primary token", () => {
    const salat = component({ label: "KRAUT-KAROTTENSALAT | NUSS-TOPPING" });

    expect(leadNameMatchScore("Kraut-Karottensalat", salat)).toBe(1);
    expect(leadNameMatchScore("Kartoffelsalat", salat)).toBe(0);
  });

  it("detects false recipe forms for cake and herb salad searches", () => {
    expect(candidateFormMismatch("Chocolate lava cake with molten centre", component())).toBe(true);
    expect(candidateFormMismatch("Chocolate sheet cake with cocoa", component())).toBe(false);
    expect(
      candidateFormMismatch(
        "Mixed salad with tomato and cucumber",
        component({ label: "WILDKRÄUTERSALAT | PETERSILIEN-VINAIGRETTE" })
      )
    ).toBe(true);
  });

  it("recognizes strong recipes by approval, fit or combined quality", () => {
    expect(isStrongRecipeCandidate(recipe({ source: { approvalState: "auto_usable", qualityScore: 0.1, fitScore: 0.1 } }))).toBe(true);
    expect(isStrongRecipeCandidate(recipe({ source: { approvalState: "review_required", qualityScore: 0.2, fitScore: 0.8 } }))).toBe(true);
    expect(isStrongRecipeCandidate(recipe({ source: { approvalState: "review_required", qualityScore: 0.75, fitScore: 0.71 } }))).toBe(true);
    expect(isStrongRecipeCandidate(recipe({ source: { approvalState: "review_required", qualityScore: 0.6, fitScore: 0.7 } }))).toBe(false);
  });
});
