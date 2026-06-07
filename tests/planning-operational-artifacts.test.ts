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

  it("keeps usable kitchen and purchase artifacts visible while suppressing fallback timing", () => {
    const selected = selectOperationalPlanningArtifacts(draft as any, [
      "Herstellungsentscheidung fehlt."
    ]);

    expect(selected.productionBatches).toEqual(draft.productionBatches);
    expect(selected.timeline).toEqual([]);
    expect(selected.procurementItems).toEqual(draft.procurementItems);
    expect(selected.kitchenSheets).toBe(draft.kitchenSheets);
  });
});
