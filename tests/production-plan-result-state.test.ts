import { describe, expect, it, vi } from "vitest";
import {
  completeProductionStateAfterPlanSuccess,
  resetProductionStateAfterPlanFailure,
  type ProductionPlanFailureActions,
  type ProductionPlanSuccessActions
} from "../backoffice-ui/src/production-plan-result-state.js";

function buildSuccessActions(calls: string[]): ProductionPlanSuccessActions {
  return {
    setSelectedPlanId: vi.fn((planId) => {
      calls.push(`setSelectedPlanId:${planId}`);
    }),
    refreshDashboard: vi.fn(async () => {
      calls.push("refreshDashboard");
    }),
    completePlanProgress: vi.fn(() => {
      calls.push("completePlanProgress");
    }),
    setNotice: vi.fn((message) => {
      calls.push(`setNotice:${message}`);
    })
  };
}

describe("production plan result state", () => {
  it("focuses the created plan and completes the planning progress after refresh", async () => {
    const calls: string[] = [];
    const actions = buildSuccessActions(calls);

    await completeProductionStateAfterPlanSuccess(
      { productionPlan: { planId: "plan-created-1" } },
      actions
    );

    expect(actions.setSelectedPlanId).toHaveBeenCalledWith("plan-created-1");
    expect(actions.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actions.completePlanProgress).toHaveBeenCalledTimes(1);
    expect(actions.setNotice).toHaveBeenCalledWith("Produktionsplan wurde erzeugt.");
    expect(calls).toEqual([
      "setSelectedPlanId:plan-created-1",
      "refreshDashboard",
      "completePlanProgress",
      "setNotice:Produktionsplan wurde erzeugt."
    ]);
  });

  it("still completes planning when the response does not include a usable plan id", async () => {
    const calls: string[] = [];
    const actions = buildSuccessActions(calls);

    await completeProductionStateAfterPlanSuccess(
      { productionPlan: { planId: 123 } },
      actions
    );

    expect(actions.setSelectedPlanId).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "refreshDashboard",
      "completePlanProgress",
      "setNotice:Produktionsplan wurde erzeugt."
    ]);
  });

  it("resets progress and surfaces the thrown planning error message", () => {
    const calls: string[] = [];
    const actions: ProductionPlanFailureActions = {
      failPlanProgress: vi.fn(() => {
        calls.push("failPlanProgress");
      }),
      setError: vi.fn((message) => {
        calls.push(`setError:${message}`);
      })
    };

    resetProductionStateAfterPlanFailure(new Error("Rezeptsuche fehlgeschlagen."), actions);

    expect(actions.failPlanProgress).toHaveBeenCalledTimes(1);
    expect(actions.setError).toHaveBeenCalledWith("Rezeptsuche fehlgeschlagen.");
    expect(calls).toEqual([
      "failPlanProgress",
      "setError:Rezeptsuche fehlgeschlagen."
    ]);
  });

  it("uses the existing fallback copy for non-error planning failures", () => {
    const actions: ProductionPlanFailureActions = {
      failPlanProgress: vi.fn(),
      setError: vi.fn()
    };

    resetProductionStateAfterPlanFailure("boom", actions);

    expect(actions.failPlanProgress).toHaveBeenCalledTimes(1);
    expect(actions.setError).toHaveBeenCalledWith("Produktionsplan konnte nicht erstellt werden.");
  });
});
