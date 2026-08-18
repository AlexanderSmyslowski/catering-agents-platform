import { describe, expect, it } from "vitest";
import type { ConfirmedQuantityOverride } from "@catering/shared-core";
import { QuantityOverrideStore } from "../production-service/src/quantity-workflow/override-store.js";

const context = { businessId: "local" };

function override(confirmedAt: string, targetAmount: number): ConfirmedQuantityOverride {
  return {
    overrideId: `override-${targetAmount}`,
    eventSpecId: "event-1",
    componentId: "component-1",
    recipeId: "recipe-1",
    editOrigin: "target_output",
    previousAuthority: {
      decisionId: "decision-old",
      eventSpecId: "event-1",
      componentId: "component-1",
      guestCount: 50,
      serviceFormat: "buffet",
      dishRole: "main",
      basis: "servings_per_person",
      perUnitAmount: 1,
      perUnitUnit: "servings",
      targetAmount: 50,
      targetUnit: "servings",
      evidence: { kind: "operator_instruction", reference: "approved-snapshot" },
      reviewStatus: "approved",
      rationale: "fixture"
    },
    newAuthority: {
      decisionId: `decision-${targetAmount}`,
      eventSpecId: "event-1",
      componentId: "component-1",
      guestCount: 50,
      serviceFormat: "buffet",
      dishRole: "main",
      basis: "servings_per_person",
      perUnitAmount: targetAmount / 50,
      perUnitUnit: "servings",
      targetAmount,
      targetUnit: "servings",
      evidence: { kind: "operator_instruction", reference: "quantity_override_preview" },
      reviewStatus: "kitchen_review_required",
      rationale: "fixture"
    },
    scaleFactor: targetAmount / 50,
    confirmedAt,
    operatorId: "Produktions-Mitarbeiter",
    staleArtifacts: ["effective_event_recipe", "purchase_requirements"]
  };
}

describe("quantity override persistence", () => {
  it("returns the latest confirmed override for one event component", async () => {
    const store = new QuantityOverrideStore();
    await store.save(context, override("2026-08-18T08:00:00.000Z", 55));
    await store.save(context, override("2026-08-18T08:05:00.000Z", 60));

    await expect(store.latestFor(context, "event-1", "component-1")).resolves.toMatchObject({
      overrideId: "override-60",
      newAuthority: { targetAmount: 60, reviewStatus: "kitchen_review_required" }
    });
    await expect(store.latestFor(context, "event-1", "other")).resolves.toBeUndefined();
  });
});
