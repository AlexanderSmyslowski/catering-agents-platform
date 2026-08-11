import { describe, expect, it, vi } from "vitest";
import {
  buildProductionPlanSubmissionAction,
  type ProductionPlanSubmissionActionInput
} from "../backoffice-ui/src/production-plan-submission-action.js";

function input(overrides: Partial<ProductionPlanSubmissionActionInput> = {}): ProductionPlanSubmissionActionInput {
  return {
    createProductionCase: vi.fn(async () => ({ case: { caseId: "production-case-plan-1" } })),
    createProductionDraftFromAcceptedEventSpec: vi.fn(async () => ({
      draft: { draftId: "draft-imported-1" }
    })),
    activeProductionCaseId: undefined,
    activeProductionCaseSpecId: undefined,
    setActiveProductionCaseId: vi.fn(),
    setActiveProductionCaseSpecId: vi.fn(),
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
      createProductionCase: vi.fn(async () => {
        calls.push("createProductionCase");
        return { case: { caseId: "production-case-plan-1" } };
      }),
      setActiveProductionCaseId: vi.fn((caseId) => {
        calls.push(`setActiveProductionCaseId:${caseId}`);
      }),
      createProductionDraftFromAcceptedEventSpec: vi.fn(async (caseId) => {
        calls.push(`createProductionDraftFromAcceptedEventSpec:${caseId}`);
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

    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(
      "production-case-plan-1",
      planningSpec
    );
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
      "createProductionCase",
      "setActiveProductionCaseId:production-case-plan-1",
      "createProductionDraftFromAcceptedEventSpec:production-case-plan-1",
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

    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(
      "production-case-plan-1",
      updatedSpec
    );
    expect(calls).toContain("setNotice:Antworten werden übernommen...");
    expect(calls).toContain("persistCurrentSpecEdit:true");
  });

  it("keeps source review confirmation on the same draft preparation corridor", async () => {
    const actionsInput = input();
    const handleCreatePlan = buildProductionPlanSubmissionAction(actionsInput);
    const planningSpec = spec();

    await handleCreatePlan(planningSpec, { sourceReviewConfirmed: true });

    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(
      "production-case-plan-1",
      planningSpec
    );
    expect(actionsInput.prepareProductionDraft).toHaveBeenCalledWith("draft-imported-1");
  });

  it("reuses the active production case when importing another revision of its bound spec", async () => {
    const actionsInput = input({
      activeProductionCaseId: "production-case-existing",
      activeProductionCaseSpecId: "spec-plan-submit-1"
    });
    const handleCreatePlan = buildProductionPlanSubmissionAction(actionsInput);
    const planningSpec = spec();

    await handleCreatePlan(planningSpec);

    expect(actionsInput.createProductionCase).not.toHaveBeenCalled();
    expect(actionsInput.setActiveProductionCaseId).not.toHaveBeenCalled();
    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(
      "production-case-existing",
      planningSpec
    );
  });

  it("creates a new production case when focus changed away from the active case spec", async () => {
    const actionsInput = input({
      activeProductionCaseId: "production-case-spec-a",
      activeProductionCaseSpecId: "spec-a",
      createProductionCase: vi.fn(async () => ({ case: { caseId: "production-case-spec-b" } }))
    } as Partial<ProductionPlanSubmissionActionInput>);
    const handleCreatePlan = buildProductionPlanSubmissionAction(actionsInput);
    const planningSpec = spec({ specId: "spec-b" });

    await handleCreatePlan(planningSpec);

    expect(actionsInput.createProductionCase).toHaveBeenCalledWith({});
    expect(actionsInput.setActiveProductionCaseId).toHaveBeenCalledWith("production-case-spec-b");
    expect(actionsInput.setActiveProductionCaseSpecId).toHaveBeenCalledWith("spec-b");
    expect(actionsInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(
      "production-case-spec-b",
      planningSpec
    );
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
