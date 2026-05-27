import { describe, expect, it } from "vitest";
import { buildProductionWorkspaceActionState } from "../backoffice-ui/src/production-workspace-action-state.js";

const idleInput = {
  hasFocusedProductionSpec: false,
  hasSelectedPlan: false,
  hasIntakeFile: false,
  hasActiveDocumentName: false,
  documentPhase: "idle",
  planPhase: "idle",
  hasFocusedProductionSpecId: false,
  hasSelectedPlanId: false,
  productionWorkspaceCleared: false
};

describe("production workspace action state", () => {
  it("keeps clear and archive disabled for an idle workspace", () => {
    expect(buildProductionWorkspaceActionState(idleInput)).toEqual({
      canClearProductionWorkspace: false,
      canArchiveCurrentIntake: false
    });
  });

  it("enables clear when any production workspace signal is active", () => {
    const activeSignals = [
      { hasFocusedProductionSpec: true },
      { hasSelectedPlan: true },
      { hasIntakeFile: true },
      { hasActiveDocumentName: true },
      { documentPhase: "analysing" },
      { planPhase: "planning" },
      { hasFocusedProductionSpecId: true },
      { hasSelectedPlanId: true }
    ];

    for (const signal of activeSignals) {
      expect(buildProductionWorkspaceActionState({ ...idleInput, ...signal })).toMatchObject({
        canClearProductionWorkspace: true,
        canArchiveCurrentIntake: false
      });
    }
  });

  it("enables archive only for an active intake request in an uncleared workspace", () => {
    expect(
      buildProductionWorkspaceActionState({
        ...idleInput,
        currentIntakeRequestId: "intake-123"
      }).canArchiveCurrentIntake
    ).toBe(true);

    expect(
      buildProductionWorkspaceActionState({
        ...idleInput,
        currentIntakeRequestId: "intake-123",
        productionWorkspaceCleared: true
      }).canArchiveCurrentIntake
    ).toBe(false);

    expect(
      buildProductionWorkspaceActionState({
        ...idleInput,
        currentIntakeRequestId: "   "
      }).canArchiveCurrentIntake
    ).toBe(false);
  });
});
