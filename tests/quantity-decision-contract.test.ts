import { describe, expect, it } from "vitest";
import { evaluateQuantityDecision } from "@catering/shared-core";

const base = {
  decisionId: "qd-1",
  eventSpecId: "event-1",
  componentId: "component-1",
  guestCount: 50,
  serviceFormat: "buffet",
  dishRole: "main" as const,
  rationale: "Geplante Ausgabemenge für diesen Auftrag.",
  evidence: { kind: "operator_instruction" as const, reference: "event-spec" },
  reviewStatus: "approved" as const
};

describe("quantity decision contract", () => {
  it("computes 55 g per person for 50 guests as 2750 g", () => {
    const result = evaluateQuantityDecision({
      ...base,
      basis: "per_person_weight",
      perUnitAmount: 55,
      perUnitUnit: "g",
      targetAmount: 2750,
      targetUnit: "g"
    });

    expect(result.valid).toBe(true);
    expect(result.usableForPlanning).toBe(true);
    expect(result.decision.targetAmount).toBe(2750);
    expect(result.issues).toEqual([]);
  });

  it("computes one piece per person without adding a buffer", () => {
    const result = evaluateQuantityDecision({
      ...base,
      componentId: "shrimp",
      dishRole: "fingerfood",
      basis: "pieces_per_person",
      perUnitAmount: 1,
      perUnitUnit: "pieces",
      targetAmount: 50,
      targetUnit: "pieces"
    });

    expect(result.valid).toBe(true);
    expect(result.decision.targetAmount).toBe(50);
  });

  it("computes fractional servings per person", () => {
    const result = evaluateQuantityDecision({
      ...base,
      componentId: "dessert",
      dishRole: "dessert",
      basis: "servings_per_person",
      perUnitAmount: 0.5,
      perUnitUnit: "servings",
      targetAmount: 25,
      targetUnit: "servings"
    });

    expect(result.valid).toBe(true);
    expect(result.decision.targetAmount).toBe(25);
  });

  it("keeps a fixed total independent of guest count", () => {
    const result = evaluateQuantityDecision({
      ...base,
      componentId: "dessert-glasses",
      dishRole: "dessert",
      basis: "fixed_total",
      targetAmount: 45,
      targetUnit: "pieces"
    });

    expect(result.valid).toBe(true);
    expect(result.decision.targetAmount).toBe(45);
  });

  it("rejects a contradictory calculated target amount", () => {
    const result = evaluateQuantityDecision({
      ...base,
      basis: "per_person_weight",
      perUnitAmount: 55,
      perUnitUnit: "g",
      targetAmount: 3000,
      targetUnit: "g"
    });

    expect(result.valid).toBe(false);
    expect(result.usableForPlanning).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("target_amount_mismatch");
  });

  it("rejects per-person fields for fixed totals", () => {
    const result = evaluateQuantityDecision({
      ...base,
      basis: "fixed_total",
      perUnitAmount: 1,
      perUnitUnit: "pieces",
      targetAmount: 45,
      targetUnit: "pieces"
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("unexpected_per_unit_fields");
  });

  it.each([
    ["zero guest count", { guestCount: 0 }, "invalid_guest_count"],
    ["negative per-unit amount", { perUnitAmount: -1 }, "invalid_per_unit_amount"],
    ["NaN target", { targetAmount: Number.NaN }, "invalid_target_amount"]
  ])("rejects %s", (_label, override, expectedCode) => {
    const result = evaluateQuantityDecision({
      ...base,
      basis: "per_person_weight",
      perUnitAmount: 55,
      perUnitUnit: "g",
      targetAmount: 2750,
      targetUnit: "g",
      ...override
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
  });

  it.each(["professional_reference", "ai_candidate", "explicit_assumption"] as const)(
    "does not allow %s evidence to become automatically approved",
    (kind) => {
      const result = evaluateQuantityDecision({
        ...base,
        basis: "pieces_per_person",
        perUnitAmount: 1,
        perUnitUnit: "pieces",
        targetAmount: 50,
        targetUnit: "pieces",
        evidence: { kind, reference: "candidate-source" },
        reviewStatus: "approved"
      });

      expect(result.valid).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toContain(
        "review_status_incompatible_with_evidence"
      );
    }
  );

  it("keeps a rejected decision unusable for planning", () => {
    const result = evaluateQuantityDecision({
      ...base,
      basis: "pieces_per_person",
      perUnitAmount: 1,
      perUnitUnit: "pieces",
      targetAmount: 50,
      targetUnit: "pieces",
      reviewStatus: "rejected"
    });

    expect(result.valid).toBe(true);
    expect(result.usableForPlanning).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("decision_rejected");
  });

  it("requires canonical units for piece and serving bases", () => {
    const pieces = evaluateQuantityDecision({
      ...base,
      basis: "pieces_per_person",
      perUnitAmount: 1,
      perUnitUnit: "servings",
      targetAmount: 50,
      targetUnit: "servings"
    });
    const servings = evaluateQuantityDecision({
      ...base,
      basis: "servings_per_person",
      perUnitAmount: 1,
      perUnitUnit: "pieces",
      targetAmount: 50,
      targetUnit: "pieces"
    });

    expect(pieces.issues.map((issue) => issue.code)).toContain("target_unit_mismatch");
    expect(servings.issues.map((issue) => issue.code)).toContain("target_unit_mismatch");
  });
});