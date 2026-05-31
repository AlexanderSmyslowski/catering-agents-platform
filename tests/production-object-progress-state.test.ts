import { describe, expect, it } from "vitest";
import { buildProductionObjectProgressState } from "../backoffice-ui/src/production-object-progress-state.js";

describe("production object progress state", () => {
  it("maps existing planning progress values into panel state without recomputing behavior", () => {
    const progressState = buildProductionObjectProgressState({
      planPhase: "planning",
      planningSpecLabel: "Lunch · 42 Pax",
      planProgress: 65,
      planEtaSeconds: 12
    });

    expect(progressState).toEqual({
      planPhase: "planning",
      planningSpecLabel: "Lunch · 42 Pax",
      planProgress: 65,
      planEtaSeconds: 12
    });
  });

  it("keeps optional planning label and eta undefined for idle progress", () => {
    const progressState = buildProductionObjectProgressState({
      planPhase: "idle",
      planProgress: 0
    });

    expect(progressState.planningSpecLabel).toBeUndefined();
    expect(progressState.planEtaSeconds).toBeUndefined();
    expect(progressState.planProgress).toBe(0);
  });
});
