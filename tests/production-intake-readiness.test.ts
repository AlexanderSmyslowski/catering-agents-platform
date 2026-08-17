import { describe, expect, it } from "vitest";
import {
  evaluateProductionIntakeReadiness,
  type AcceptedEventSpec,
  type RawInput
} from "@catering/shared-core";

function baseSpec(): AcceptedEventSpec {
  return {
    schemaVersion: "1.0.0",
    specId: "spec-intake-v1",
    lifecycle: { commercialState: "accepted" },
    readiness: { status: "complete", reasons: [] },
    sourceLineage: [{ sourceType: "manual_input", reference: "test" }],
    event: { type: "Firmenfeier", serviceForm: "Buffet" },
    attendees: { expected: 50 },
    servicePlan: { eventType: "Firmenfeier", serviceForm: "Buffet", modules: [] },
    menuPlan: [
      {
        componentId: "dish-1",
        label: "Roastbeef",
        servings: 50,
        productionDecision: { mode: "scratch" }
      }
    ]
  };
}

function fallbackSource(): RawInput {
  return {
    kind: "pdf",
    content: "not mirrored by evaluator",
    documentId: "doc-1",
    sourceMetadata: {
      filename: "angebot.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ingestedAt: "2026-08-17T10:00:00.000Z",
      uploadContext: "production"
    },
    documentIngestion: {
      status: "fallback",
      warnings: ["document_text_extraction_fallback"]
    }
  };
}

describe("Production Intake & Clarification Contract v1", () => {
  it("blocks quantity and production when attendee count is missing", () => {
    const spec = baseSpec();
    spec.attendees = {};

    const result = evaluateProductionIntakeReadiness({ spec });

    expect(result.quantityPlanningReady).toBe(false);
    expect(result.productionPlanningReady).toBe(false);
    expect(result.blockingFieldKeys).toContain("attendees.count");
    expect(result.findings).toContainEqual(expect.objectContaining({
      fieldKey: "attendees.count",
      requirementClass: "required_for_quantity_planning",
      state: "missing"
    }));
  });

  it("does not block production merely because price context is absent", () => {
    const result = evaluateProductionIntakeReadiness({ spec: baseSpec() });

    expect(result.quantityPlanningReady).toBe(true);
    expect(result.productionPlanningReady).toBe(true);
    expect(result.commercialPlausibilityReady).toBe(false);
    expect(result.status).toBe("ready_for_production_planning");
    expect(result.blockingFieldKeys).not.toContain("budgetContext");
  });

  it("blocks quantity planning when event context is missing", () => {
    const spec = baseSpec();
    spec.event = { serviceForm: "Buffet" };
    spec.servicePlan.eventType = "";

    const result = evaluateProductionIntakeReadiness({ spec });

    expect(result.quantityPlanningReady).toBe(false);
    expect(result.blockingFieldKeys).toContain("event.occasion");
  });

  it("blocks quantity and production for an empty menu", () => {
    const spec = baseSpec();
    spec.menuPlan = [];

    const result = evaluateProductionIntakeReadiness({ spec });

    expect(result.quantityPlanningReady).toBe(false);
    expect(result.productionPlanningReady).toBe(false);
    expect(result.blockingFieldKeys).toContain("menuPlan");
  });

  it("allows quantity planning but blocks production when a component has no production mode", () => {
    const spec = baseSpec();
    delete spec.menuPlan[0].productionDecision;

    const result = evaluateProductionIntakeReadiness({ spec });

    expect(result.quantityPlanningReady).toBe(true);
    expect(result.productionPlanningReady).toBe(false);
    expect(result.blockingFieldKeys).toContain("menuPlan.dish-1.productionDecision.mode");
    expect(result.status).toBe("ready_for_quantity_planning");
  });

  it("blocks production when hybrid production has no purchased-elements declaration", () => {
    const spec = baseSpec();
    spec.menuPlan[0].productionDecision = { mode: "hybrid" };

    const result = evaluateProductionIntakeReadiness({ spec });

    expect(result.quantityPlanningReady).toBe(true);
    expect(result.productionPlanningReady).toBe(false);
    expect(result.blockingFieldKeys).toContain("menuPlan.dish-1.productionDecision.purchasedElements");
  });

  it("requires source verification for fallback ingestion without mirroring raw content", () => {
    const result = evaluateProductionIntakeReadiness({
      spec: baseSpec(),
      sourceInputs: [fallbackSource()]
    });

    expect(result.quantityPlanningReady).toBe(false);
    expect(result.productionPlanningReady).toBe(false);
    expect(result.findings).toContainEqual(expect.objectContaining({
      fieldKey: "source.doc-1.verification",
      state: "source_verification_required"
    }));
    expect(JSON.stringify(result)).not.toContain("not mirrored by evaluator");
  });

  it("becomes commercially plausible when price context exists", () => {
    const spec = baseSpec();
    spec.budgetContext = {
      targetBudget: { amount: 4000, currency: "EUR" },
      pricingSummary: { subtotal: { amount: 3800, currency: "EUR" } }
    };

    const result = evaluateProductionIntakeReadiness({ spec });

    expect(result.productionPlanningReady).toBe(true);
    expect(result.commercialPlausibilityReady).toBe(true);
  });

  it("accepts an explicit applied portion-logic assumption without inventing one", () => {
    const spec = baseSpec();
    spec.assumptions = [{
      code: "portion_logic",
      message: "Buffetportionen gemäß bestätigter Standardlogik.",
      applied: true
    }];

    const result = evaluateProductionIntakeReadiness({ spec });

    expect(result.findings).toContainEqual(expect.objectContaining({
      fieldKey: "portioning.specialLogic",
      requirementClass: "explicit_assumption_allowed",
      state: "assumption_applied"
    }));
  });

  it("orders findings and blockers deterministically", () => {
    const spec = baseSpec();
    spec.attendees = {};
    spec.event = {};
    spec.menuPlan = [];

    const first = evaluateProductionIntakeReadiness({ spec, sourceInputs: [fallbackSource()] });
    const second = evaluateProductionIntakeReadiness({ spec, sourceInputs: [fallbackSource()] });

    expect(second).toEqual(first);
    expect(first.blockingFieldKeys).toEqual([...first.blockingFieldKeys].sort((a, b) => a.localeCompare(b, "de")));
    expect(first.findings.map((finding) => finding.fieldKey)).toEqual(
      [...first.findings.map((finding) => finding.fieldKey)].sort((a, b) => a.localeCompare(b, "de"))
    );
  });
});