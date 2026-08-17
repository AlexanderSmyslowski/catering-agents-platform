import { describe, expect, it } from "vitest";
import { recommendQuantity } from "@catering/shared-core";

const baseEvidence = {
  evidenceId: "portion-guide-main-buffet",
  sourceKind: "professional_reference" as const,
  reference: "Professional catering portion guide",
  dishRole: "main" as const,
  serviceFormats: ["buffet"],
  basis: "per_person_weight" as const,
  unit: "g",
  minAmount: 50,
  preferredAmount: 55,
  maxAmount: 65,
  rationale: "Cooked output corridor for a buffet main component."
};

const baseInput = {
  decisionId: "rec-1",
  eventSpecId: "event-1",
  componentId: "roastbeef",
  guestCount: 50,
  serviceFormat: "buffet",
  dishRole: "main" as const,
  basis: "per_person_weight" as const,
  evidence: [baseEvidence]
};

describe("quantity recommendation v1", () => {
  it("recommends the preferred amount and preserves the professional corridor", () => {
    const result = recommendQuantity(baseInput);

    expect(result.status).toBe("recommended");
    expect(result.recommendedAmount).toBe(55);
    expect(result.unit).toBe("g");
    expect(result.professionalRange).toEqual({ min: 50, max: 65, unit: "g" });
    expect(result.decisionCandidate?.targetAmount).toBe(2750);
  });

  it("never auto-approves a professional-reference recommendation", () => {
    const result = recommendQuantity(baseInput);
    expect(result.decisionCandidate?.reviewStatus).toBe("kitchen_review_required");
    expect(result.decisionCandidate?.evidence.kind).toBe("professional_reference");
  });

  it("uses the deterministic overlap corridor for compatible evidence", () => {
    const result = recommendQuantity({
      ...baseInput,
      evidence: [
        baseEvidence,
        {
          ...baseEvidence,
          evidenceId: "second-guide",
          reference: "Second professional guide",
          minAmount: 52,
          preferredAmount: 58,
          maxAmount: 62
        }
      ]
    });

    expect(result.status).toBe("recommended");
    expect(result.professionalRange).toEqual({ min: 52, max: 62, unit: "g" });
    expect(result.recommendedAmount).toBe(56.5);
  });

  it("returns evidence_insufficient rather than inventing a number", () => {
    const result = recommendQuantity({
      ...baseInput,
      dishRole: "dessert"
    });

    expect(result.status).toBe("evidence_insufficient");
    expect(result.recommendedAmount).toBeUndefined();
    expect(result.decisionCandidate).toBeUndefined();
  });

  it("returns conflicting_evidence for disjoint professional corridors", () => {
    const result = recommendQuantity({
      ...baseInput,
      evidence: [
        baseEvidence,
        {
          ...baseEvidence,
          evidenceId: "conflict",
          reference: "Conflicting guide",
          minAmount: 80,
          preferredAmount: 90,
          maxAmount: 100
        }
      ]
    });

    expect(result.status).toBe("conflicting_evidence");
    expect(result.recommendedAmount).toBeUndefined();
  });

  it("rejects an invalid guest count for per-person recommendations", () => {
    const result = recommendQuantity({ ...baseInput, guestCount: 0 });
    expect(result.status).toBe("invalid_input");
    expect(result.issues.map((issue) => issue.code)).toContain("invalid_guest_count");
  });

  it("ignores incompatible basis evidence", () => {
    const result = recommendQuantity({
      ...baseInput,
      evidence: [{ ...baseEvidence, basis: "pieces_per_person" as const, unit: "pieces" }]
    });

    expect(result.status).toBe("evidence_insufficient");
  });

  it("records explicit adjustment trace and clamps inside the professional corridor", () => {
    const result = recommendQuantity({
      ...baseInput,
      adjustments: [
        {
          factorId: "service-heavy",
          factorKind: "service_format" as const,
          reason: "Long buffet service with substantial accompanying dishes.",
          multiplier: 1.4
        }
      ]
    });

    expect(result.status).toBe("recommended");
    expect(result.recommendedAmount).toBe(65);
    expect(result.adjustmentTrace).toEqual([
      expect.objectContaining({ factorId: "service-heavy", beforeAmount: 55, afterAmount: 65 })
    ]);
  });

  it("does not expose hidden safety, yield or procurement adjustment kinds", () => {
    const result = recommendQuantity(baseInput);
    expect(result.adjustmentTrace).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/safety|yield|procurement|shrinkage|overproduction/i);
  });

  it("keeps fixed totals independent of guest multiplication", () => {
    const fixedEvidence = {
      ...baseEvidence,
      evidenceId: "dessert-glasses",
      dishRole: "dessert" as const,
      basis: "fixed_total" as const,
      unit: "pieces",
      minAmount: 40,
      preferredAmount: 45,
      maxAmount: 50,
      serviceFormats: ["buffet"]
    };
    const result = recommendQuantity({
      ...baseInput,
      componentId: "dessert",
      dishRole: "dessert",
      basis: "fixed_total",
      evidence: [fixedEvidence]
    });

    expect(result.status).toBe("recommended");
    expect(result.decisionCandidate?.targetAmount).toBe(45);
    expect(result.decisionCandidate?.perUnitAmount).toBeUndefined();
  });

  it("keeps operator instruction explicit and review-required", () => {
    const result = recommendQuantity({
      ...baseInput,
      evidence: [
        {
          ...baseEvidence,
          sourceKind: "operator_instruction" as const,
          reference: "Alexander: 60 g per guest",
          minAmount: 60,
          preferredAmount: 60,
          maxAmount: 60
        }
      ]
    });

    expect(result.status).toBe("recommended");
    expect(result.recommendedAmount).toBe(60);
    expect(result.decisionCandidate?.evidence.kind).toBe("operator_instruction");
    expect(result.decisionCandidate?.reviewStatus).toBe("kitchen_review_required");
  });

  it("orders evidence references, traces and issues deterministically", () => {
    const result = recommendQuantity({
      ...baseInput,
      evidence: [
        { ...baseEvidence, evidenceId: "z", reference: "Z source" },
        { ...baseEvidence, evidenceId: "a", reference: "A source" }
      ],
      adjustments: [
        { factorId: "z", factorKind: "dish_role", reason: "z", multiplier: 1 },
        { factorId: "a", factorKind: "service_format", reason: "a", multiplier: 1 }
      ]
    });

    expect(result.evidenceReferences).toEqual(["A source", "Z source"]);
    expect(result.adjustmentTrace.map((entry) => entry.factorId)).toEqual(["a", "z"]);
    expect(result.issues).toEqual([...result.issues].sort((a, b) => a.code.localeCompare(b.code)));
  });
});