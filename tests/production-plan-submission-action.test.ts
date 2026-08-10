import { describe, expect, it, vi } from "vitest";
import {
  buildProductionPlanSubmissionAction,
  type ProductionPlanSubmissionActionInput
} from "../backoffice-ui/src/production-plan-submission-action.js";

function input(overrides: Partial<ProductionPlanSubmissionActionInput> = {}): ProductionPlanSubmissionActionInput {
  return {
    createProductionDraftFromAcceptedEventSpec: vi.fn(async () => ({
      draft: { draftId: "draft-imported-1" }
    })),
    prepareProductionDraft: vi.fn(async () => ({
      draft: { draftId: "draft-prepared-2" }
    })),
    editingSpecId: undefined,
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    clearMessages: vi.fn(),
    persistCurrentSpecEdit: vi.fn(async () => undefined),
    startPlanProgress: vi.fn(),
    clearSelectedPlanId: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    completePlanProgress: vi.fn(),
    failPlanProgress: vi.fn(),
    setNotice: vi.fn(),
    setError: vi.fn(),
    showProductionDraftReview: vi.fn(),
    ...overrides
  };
}

function spec(overrides: Record<string, unknown> = {}) {
  return {
    specId: "spec-plan-submit-1",
    event: {
      type: "lunch",
      date: "2026-06-30"
    },
    attendees: {
      expected: 40
    },
    ...overrides
  };
}

describe("production plan submission action", () => {
  it("imports and prepares the focused spec before opening its review", async () => {
    const calls: string[] = [];
    const planningSpec = spec();
    const actionsInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      setProductionWorkspaceCleared: vi.fn((cleared) => {
        calls.push(`setProductionWorkspaceCleared:${cleared}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      startPlanProgress: vi.fn((_spec, label) => {
        calls.push(`startPlanProgress:${label}`);
      }),
      clearSelectedPlanId: vi.fn(() => {
        calls.push("clearSelectedPlanId");
      }),
      createProductionDraftFromAcceptedEventSpec: vi.fn(async () => {
        calls.push("createProductionDraftFromAcceptedEventSpec");
        return { draft: { draftId: "draft-imported-1" } };
      }),
      prepareProductionDraft: vi.fn(async (draftId) => {
        calls.push(`prepareProductionDraft:${draftId}`);
        return { draft: { draftId: "draft-prepared-2" } };
      }),
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
    });
    const handleCreatePlan = buildProductionPlanSubmissionAction(actionsInput);

    await handleCreatePlan(planningSpec);

    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(planningSpec);
    expect(actionsInput.prepareProductionDraft).toHaveBeenCalledWith("draft-imported-1");
    expect(actionsInput.persistCurrentSpecEdit).not.toHaveBeenCalled();
    expect(actionsInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "setProductionWorkspaceCleared:false",
      "clearMessages",
      "startPlanProgress:Lunch · 40 Teilnehmer · 2026-06-30",
      "clearSelectedPlanId",
      "setNotice:Vollständiger Produktionsentwurf wird vorbereitet...",
      "createProductionDraftFromAcceptedEventSpec",
      "prepareProductionDraft:draft-imported-1",
      "refreshDashboard",
      "completePlanProgress",
      "setNotice:Produktionsentwurf wurde vorbereitet und wartet auf Prüfung.",
      "showProductionDraftReview:draft-prepared-2",
      "setSubmitting:false"
    ]);
  });

  it("quietly saves matching answer edits before planning", async () => {
    const originalSpec = spec({ menuPlan: ["old"] });
    const updatedSpec = spec({ menuPlan: ["updated"] });
    const calls: string[] = [];
    const actionsInput = input({
      editingSpecId: "spec-plan-submit-1",
      persistCurrentSpecEdit: vi.fn(async (options) => {
        calls.push(`persistCurrentSpecEdit:${String(options.quiet)}`);
        return updatedSpec;
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const handleCreatePlan = buildProductionPlanSubmissionAction(actionsInput);

    await handleCreatePlan(originalSpec);

    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(updatedSpec);
    expect(calls).toContain("setNotice:Antworten werden übernommen...");
    expect(calls).toContain("persistCurrentSpecEdit:true");
  });

  it("keeps source review confirmation on the same draft preparation corridor", async () => {
    const actionsInput = input();
    const handleCreatePlan = buildProductionPlanSubmissionAction(actionsInput);
    const planningSpec = spec();

    await handleCreatePlan(planningSpec, { sourceReviewConfirmed: true });

    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(planningSpec);
    expect(actionsInput.prepareProductionDraft).toHaveBeenCalledWith("draft-imported-1");
  });

  it("surfaces planning failures and always exits submitting state", async () => {
    const actionsInput = input({
      prepareProductionDraft: vi.fn(async () => {
        throw new Error("Planung abgelehnt");
      })
    });
    const handleCreatePlan = buildProductionPlanSubmissionAction(actionsInput);

    await handleCreatePlan(spec());

    expect(actionsInput.failPlanProgress).toHaveBeenCalledTimes(1);
    expect(actionsInput.setError).toHaveBeenCalledWith("Planung abgelehnt");
    expect(actionsInput.completePlanProgress).not.toHaveBeenCalled();
    expect(actionsInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
