import { describe, expect, it } from "vitest";
import {
  approveExperienceRuleCandidate,
  createExperienceRuleCandidate,
  summarizeExperienceEvidence,
  type ProductionObservation,
  type ProductionScalingRule
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

function candidate(): ProductionScalingRule {
  const result = createExperienceRuleCandidate(observation(), {
    candidateId: "cand-1",
    minServings: 100,
    maxServings: 150,
    model: { kind: "factor", factor: 0.9 },
    rationale: "Große Chargen benötigen bei diesem Rezept weniger Sahne.",
    requiredContext: ["tilting-pan"]
  });
  if (result.status !== "candidate_created") throw new Error("candidate expected");
  return result.candidate;
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
    expect(result.candidate).toMatchObject({ ruleId: "cand-1", recipeId: "recipe-rahmsauce-v3", ingredientId: "cream", reviewStatus: "candidate" });
    expect(result.candidate.supportingObservationIds).toEqual(["obs-1"]);
  });

  it("never turns candidate creation into approval", () => {
    const result = createExperienceRuleCandidate(observation(), {
      candidateId: "cand-1", minServings: 100, maxServings: 150,
      model: { kind: "factor", factor: 0.9 }, rationale: "Kandidat"
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
      candidateId: "cand-1", minServings: 100, maxServings: 150,
      model: { kind: "factor", factor: 0.9 }, rationale: "Kandidat"
    });
    expect(result.status).toBe("blocked");
  });

  it("requires an explicit finite application range", () => {
    const result = createExperienceRuleCandidate(observation(), {
      candidateId: "cand-1", minServings: 151, maxServings: 100,
      model: { kind: "factor", factor: 0.9 }, rationale: "Kandidat"
    });
    expect(result).toEqual({ status: "blocked", issues: ["candidate_range_invalid"] });
  });

  it("does not infer an unlimited scope from one production", () => {
    const result = createExperienceRuleCandidate(observation(), {
      candidateId: "cand-1", minServings: Number.NEGATIVE_INFINITY, maxServings: Number.POSITIVE_INFINITY,
      model: { kind: "factor", factor: 0.9 }, rationale: "Kandidat"
    });
    expect(result.status).toBe("blocked");
  });
});

describe("experience rule approval and evidence", () => {
  it("allows explicit human approval with one supporting observation", () => {
    const approved = approveExperienceRuleCandidate({
      candidate: candidate(),
      reviewerId: "chef-2",
      approvedAt: "2026-08-17T21:00:00.000Z"
    });
    expect(approved.status).toBe("approved");
    if (approved.status !== "approved") throw new Error("approval expected");
    expect(approved.rule.reviewStatus).toBe("approved");
    expect(approved.rule.supportingObservationIds).toEqual(["obs-1"]);
    expect(approved.rule.approvedBy).toBe("chef-2");
  });

  it("keeps evidence strength separate from approval", () => {
    const approved = approveExperienceRuleCandidate({ candidate: candidate(), reviewerId: "chef-2", approvedAt: "2026-08-17T21:00:00.000Z" });
    if (approved.status !== "approved") throw new Error("approval expected");
    const evidence = summarizeExperienceEvidence({ rule: approved.rule, observations: [observation()] });
    expect(evidence.classification).toBe("low");
    expect(approved.rule.reviewStatus).toBe("approved");
    expect(evidence.totalMatchingObservations).toBe(1);
    expect(evidence.confirmingObservations).toBe(1);
    expect(evidence.contradictingObservations).toBe(0);
  });

  it("reports contradictions and review need without revoking the approved rule", () => {
    const approved = approveExperienceRuleCandidate({ candidate: candidate(), reviewerId: "chef-2", approvedAt: "2026-08-17T21:00:00.000Z" });
    if (approved.status !== "approved") throw new Error("approval expected");
    const evidence = summarizeExperienceEvidence({
      rule: approved.rule,
      observations: [
        observation(),
        observation({ observationId: "obs-2", productionServings: 130, actualAmount: 6600, outcome: "successful" })
      ]
    });
    expect(evidence.contradictingObservations).toBe(1);
    expect(evidence.reviewNeeded).toBe(true);
    expect(evidence.classification).toBe("low");
    expect(approved.rule.reviewStatus).toBe("approved");
  });

  it("derives medium and high only from transparent observation facts", () => {
    const approved = approveExperienceRuleCandidate({ candidate: candidate(), reviewerId: "chef-2", approvedAt: "2026-08-17T21:00:00.000Z" });
    if (approved.status !== "approved") throw new Error("approval expected");
    const medium = summarizeExperienceEvidence({
      rule: approved.rule,
      observations: [observation(), observation({ observationId: "obs-2", productionServings: 125, proportionalBaselineAmount: 6250, plannedEffectiveAmount: 6250, actualAmount: 5625 })]
    });
    expect(medium.classification).toBe("medium");

    const high = summarizeExperienceEvidence({
      rule: approved.rule,
      observations: [
        observation({ observationId: "obs-a", productionServings: 105, proportionalBaselineAmount: 5250, plannedEffectiveAmount: 5250, actualAmount: 4725 }),
        observation({ observationId: "obs-b", productionServings: 115, proportionalBaselineAmount: 5750, plannedEffectiveAmount: 5750, actualAmount: 5175 }),
        observation({ observationId: "obs-c", productionServings: 135, proportionalBaselineAmount: 6750, plannedEffectiveAmount: 6750, actualAmount: 6075 }),
        observation({ observationId: "obs-d", productionServings: 145, proportionalBaselineAmount: 7250, plannedEffectiveAmount: 7250, actualAmount: 6525 })
      ]
    });
    expect(high.classification).toBe("high");
    expect(high.coversLowerHalf).toBe(true);
    expect(high.coversUpperHalf).toBe(true);
  });
});