import { describe, expect, it } from "vitest";
import {
  createExperienceRuleCandidate,
  type ProductionObservation
} from "@catering/shared-core";

function observation(overrides: Partial<ProductionObservation> = {}): ProductionObservation {
  return {
    observationId: "obs-1",
    eventSpecId: "event-1",
    componentId: "rahmsauce",
    recipeId: "recipe-rahmsauce-v3",
    recipeVersion: "1.0.0",
    productionServings: 120,
    ingredientId: "cream",
    proportionalBaselineAmount: 6000,
    plannedEffectiveAmount: 6000,
    actualAmount: 5400,
    unit: "ml",
    context: ["tilting-pan"],
    rationale: "Bei dieser Chargengröße war die proportional berechnete Sahnemenge zu hoch.",
    outcome: "successful",
    operatorId: "chef-1",
    observedAt: "2026-08-17T19:00:00.000Z",
    ...overrides
  };
}

describe("experience learning candidates", () => {
  it("creates a recipe-specific candidate from one valid production observation", () => {
    const result = createExperienceRuleCandidate(observation(), {
      candidateId: "cand-1",
      minServings: 100,
      maxServings: 150,
      model: { kind: "factor", factor: 0.9 },
      rationale: "Große Chargen benötigen bei diesem Rezept weniger Sahne."
    });

    expect(result.status).toBe("candidate_created");
    if (result.status !== "candidate_created") throw new Error("candidate expected");
    expect(result.candidate).toMatchObject({
      ruleId: "cand-1",
      recipeId: "recipe-rahmsauce-v3",
      ingredientId: "cream",
      minServings: 100,
      maxServings: 150,
      reviewStatus: "candidate"
    });
    expect(result.candidate.supportingObservationIds).toEqual(["obs-1"]);
  });

  it("never turns candidate creation into approval", () => {
    const result = createExperienceRuleCandidate(observation(), {
      candidateId: "cand-1",
      minServings: 100,
      maxServings: 150,
      model: { kind: "factor", factor: 0.9 },
      rationale: "Kandidat"
    });
    expect(result.status).toBe("candidate_created");
    if (result.status === "candidate_created") expect(result.candidate.reviewStatus).toBe("candidate");
  });

  it.each([
    ["invalid servings", { productionServings: 0 }],
    ["invalid baseline", { proportionalBaselineAmount: Number.NaN }],
    ["invalid planned", { plannedEffectiveAmount: -1 }],
    ["invalid actual", { actualAmount: 0 }],
    ["missing rationale", { rationale: "   " }],
    ["invalid timestamp", { observedAt: "not-a-date" }]
  ])("rejects %s observations", (_name, overrides) => {
    const result = createExperienceRuleCandidate(observation(overrides as Partial<ProductionObservation>), {
      candidateId: "cand-1",
      minServings: 100,
      maxServings: 150,
      model: { kind: "factor", factor: 0.9 },
      rationale: "Kandidat"
    });
    expect(result.status).toBe("blocked");
  });

  it("requires an explicit finite application range", () => {
    const result = createExperienceRuleCandidate(observation(), {
      candidateId: "cand-1",
      minServings: 151,
      maxServings: 100,
      model: { kind: "factor", factor: 0.9 },
      rationale: "Kandidat"
    });
    expect(result).toEqual({ status: "blocked", issues: ["candidate_range_invalid"] });
  });

  it("does not infer an unlimited scope from one production", () => {
    const result = createExperienceRuleCandidate(observation(), {
      candidateId: "cand-1",
      minServings: Number.NEGATIVE_INFINITY,
      maxServings: Number.POSITIVE_INFINITY,
      model: { kind: "factor", factor: 0.9 },
      rationale: "Kandidat"
    });
    expect(result.status).toBe("blocked");
  });
});