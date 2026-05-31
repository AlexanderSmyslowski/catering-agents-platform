import { describe, expect, it } from "vitest";
import { selectOperationalPlanningArtifacts } from "../production-service/src/rules/planning-operational-artifacts.js";

describe("planning operational artifacts", () => {
  const draft = {
    productionBatches: [{ batchId: "batch-1" }],
    timeline: [{ label: "Suppe vorbereiten", at: "2026-06-01 T-1" }],
    kitchenSheets: [
      { title: "Suppe", componentId: "component-1", instructions: [] },
      {
        title: "Pasta - Klärung nötig",
        componentId: "component-2",
        instructions: [],
        blockingNotes: ["Herstellungsentscheidung fehlt."]
      }
    ],
    procurementItems: [{ name: "Tomaten", quantity: 2, unit: "kg" }]
  };

  it("keeps all draft artifact references when there are no blocking issues", () => {
    const selected = selectOperationalPlanningArtifacts(draft as any, []);

    expect(selected.productionBatches).toBe(draft.productionBatches);
    expect(selected.timeline).toBe(draft.timeline);
    expect(selected.kitchenSheets).toBe(draft.kitchenSheets);
    expect(selected.procurementItems).toBe(draft.procurementItems);
  });

  it("suppresses operational artifacts and keeps only blocking kitchen sheets for fallback plans", () => {
    const selected = selectOperationalPlanningArtifacts(draft as any, [
      "Herstellungsentscheidung fehlt."
    ]);

    expect(selected.productionBatches).toEqual([]);
    expect(selected.timeline).toEqual([]);
    expect(selected.procurementItems).toEqual([]);
    expect(selected.kitchenSheets).toEqual([draft.kitchenSheets[1]]);
  });
});
