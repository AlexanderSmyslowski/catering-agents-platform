import { describe, expect, it } from "vitest";
import { createPlanningArtifactState } from "../production-service/src/rules/planning-artifact-state.js";

describe("planning artifact state", () => {
  it("creates empty artifact collections wired into the appender", () => {
    const notedIssues: Array<{ issue: string; blocking?: boolean }> = [];
    const state = createPlanningArtifactState((issue, blocking) => {
      notedIssues.push({ issue, blocking });
    });

    expect(state.productionBatches).toEqual([]);
    expect(state.procurementItems).toEqual([]);
    expect(state.kitchenSheets).toEqual([]);
    expect(state.timeline).toEqual([]);
    expect(state.recipeSelections).toEqual([]);

    expect(state.appender.productionBatches).toBe(state.productionBatches);
    expect(state.appender.procurementItems).toBe(state.procurementItems);
    expect(state.appender.kitchenSheets).toBe(state.kitchenSheets);
    expect(state.appender.timeline).toBe(state.timeline);
    expect(state.appender.recipeSelections).toBe(state.recipeSelections);

    state.appender.noteIssue("Komponente prüfen", true);

    expect(notedIssues).toEqual([{ issue: "Komponente prüfen", blocking: true }]);
  });
});
