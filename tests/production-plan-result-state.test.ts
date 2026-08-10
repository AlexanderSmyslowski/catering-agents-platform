import { describe, expect, it, vi } from "vitest";
import {
  completeProductionStateAfterDraftPreparation,
  prepareProductionSpecForPlanning,
  resetProductionStateAfterPlanFailure,
  startProductionPlanRunState,
  type ProductionPlanFailureActions,
  type ProductionPlanStartActions,
  type ProductionDraftPreparationSuccessActions,
  type ProductionSpecPlanningPreflightActions
} from "../backoffice-ui/src/production-plan-result-state.js";

function buildSuccessActions(calls: string[]): ProductionDraftPreparationSuccessActions {
  return {
    refreshDashboard: vi.fn(async () => {
      calls.push("refreshDashboard");
    }),
    completePlanProgress: vi.fn(() => {
      calls.push("completePlanProgress");
    }),
    setNotice: vi.fn((message) => {
      calls.push(`setNotice:${message}`);
    }),
    showProductionDraftReview: vi.fn((draftId) => {
      calls.push(`showProductionDraftReview:${draftId}`);
    })
  };
}

describe("production plan result state", () => {
  it("saves currently edited answers quietly before planning the same focused spec", async () => {
    const originalSpec = { specId: "spec-planning-1", menuPlan: ["old"] };
    const updatedSpec = { specId: "spec-planning-1", menuPlan: ["updated"] };
    const calls: string[] = [];
    const actions: ProductionSpecPlanningPreflightActions = {
      persistCurrentSpecEdit: vi.fn(async (options) => {
        calls.push(`persistCurrentSpecEdit:${String(options.quiet)}`);
        return updatedSpec;
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    };

    const specForPlanning = await prepareProductionSpecForPlanning(
      originalSpec,
      "spec-planning-1",
      actions
    );

    expect(specForPlanning).toBe(updatedSpec);
    expect(actions.setNotice).toHaveBeenCalledWith("Antworten werden übernommen...");
    expect(actions.persistCurrentSpecEdit).toHaveBeenCalledWith({ quiet: true });
    expect(calls).toEqual([
      "setNotice:Antworten werden übernommen...",
      "persistCurrentSpecEdit:true"
    ]);
  });

  it("uses the original planning spec when no matching answer edit is open", async () => {
    const spec = { specId: "spec-planning-2" };
    const actions: ProductionSpecPlanningPreflightActions = {
      persistCurrentSpecEdit: vi.fn(async () => ({ specId: "should-not-be-used" })),
      setNotice: vi.fn()
    };

    const specForPlanning = await prepareProductionSpecForPlanning(
      spec,
      "other-spec",
      actions
    );

    expect(specForPlanning).toBe(spec);
    expect(actions.persistCurrentSpecEdit).not.toHaveBeenCalled();
    expect(actions.setNotice).not.toHaveBeenCalled();
  });

  it("falls back to the original planning spec when the quiet save returns no update", async () => {
    const spec = { specId: "spec-planning-3" };
    const actions: ProductionSpecPlanningPreflightActions = {
      persistCurrentSpecEdit: vi.fn(async () => undefined),
      setNotice: vi.fn()
    };

    const specForPlanning = await prepareProductionSpecForPlanning(
      spec,
      "spec-planning-3",
      actions
    );

    expect(specForPlanning).toBe(spec);
    expect(actions.persistCurrentSpecEdit).toHaveBeenCalledWith({ quiet: true });
    expect(actions.setNotice).toHaveBeenCalledWith("Antworten werden übernommen...");
  });

  it("starts planning progress, clears stale plan focus and announces the running calculation", () => {
    const calls: string[] = [];
    const spec = { specId: "spec-planning-1" };
    const actions: ProductionPlanStartActions = {
      startPlanProgress: vi.fn((receivedSpec, specLabel) => {
        calls.push(`startPlanProgress:${String(receivedSpec.specId)}:${specLabel}`);
      }),
      clearSelectedPlanId: vi.fn(() => {
        calls.push("clearSelectedPlanId");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    };

    startProductionPlanRunState(spec, "Konferenz 42", actions);

    expect(actions.startPlanProgress).toHaveBeenCalledWith(spec, "Konferenz 42");
    expect(actions.clearSelectedPlanId).toHaveBeenCalledTimes(1);
    expect(actions.setNotice).toHaveBeenCalledWith("Vollständiger Produktionsentwurf wird vorbereitet...");
    expect(calls).toEqual([
      "startPlanProgress:spec-planning-1:Konferenz 42",
      "clearSelectedPlanId",
      "setNotice:Vollständiger Produktionsentwurf wird vorbereitet..."
    ]);
  });

  it("opens the prepared draft review after refresh", async () => {
    const calls: string[] = [];
    const actions = buildSuccessActions(calls);

    await completeProductionStateAfterDraftPreparation(
      { draft: { draftId: "draft-prepared-2" } },
      actions
    );

    expect(actions.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actions.completePlanProgress).toHaveBeenCalledTimes(1);
    expect(actions.setNotice).toHaveBeenCalledWith(
      "Produktionsentwurf wurde vorbereitet und wartet auf Prüfung."
    );
    expect(actions.showProductionDraftReview).toHaveBeenCalledWith("draft-prepared-2");
    expect(calls).toEqual([
      "refreshDashboard",
      "completePlanProgress",
      "setNotice:Produktionsentwurf wurde vorbereitet und wartet auf Prüfung.",
      "showProductionDraftReview:draft-prepared-2"
    ]);
  });

  it("still completes progress when the response has no usable draft id", async () => {
    const calls: string[] = [];
    const actions = buildSuccessActions(calls);

    await completeProductionStateAfterDraftPreparation(
      { draft: { draftId: 123 } },
      actions
    );

    expect(actions.showProductionDraftReview).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "refreshDashboard",
      "completePlanProgress",
      "setNotice:Produktionsentwurf wurde vorbereitet und wartet auf Prüfung."
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

  it("uses draft-preparation fallback copy for non-error failures", () => {
    const actions: ProductionPlanFailureActions = {
      failPlanProgress: vi.fn(),
      setError: vi.fn()
    };

    resetProductionStateAfterPlanFailure("boom", actions);

    expect(actions.failPlanProgress).toHaveBeenCalledTimes(1);
    expect(actions.setError).toHaveBeenCalledWith("Produktionsentwurf konnte nicht vorbereitet werden.");
  });
});
