import { describe, expect, it, vi } from "vitest";
import {
  buildProductionPlanningControls,
  type ProductionPlanningControlsInput
} from "../backoffice-ui/src/production-planning-controls.js";

function input(
  overrides: Partial<ProductionPlanningControlsInput> = {}
): ProductionPlanningControlsInput {
  return {
    editingSpecId: "spec-plan-submit-1",
    updateAcceptedSpec: vi.fn(async () => ({
      acceptedEventSpec: {
        specId: "spec-plan-submit-1",
        event: { type: "lunch", date: "2026-06-30" },
        attendees: { expected: 40 }
      }
    })),
    buildCurrentSpecUpdateInput: vi.fn(() => ({ attendeeCount: 40 })),
    loadSpecIntoEditorState: vi.fn(() => "spec-plan-submit-1"),
    createProductionCase: vi.fn(async () => ({ case: { caseId: "production-case-plan-1" } })),
    createProductionDraftFromAcceptedEventSpec: vi.fn(async () => ({ draft: { draftId: "draft-imported-1" } })),
    activeProductionCaseId: undefined,
    activeProductionCaseSpecId: undefined,
    setActiveProductionCaseId: vi.fn(),
    setActiveProductionCaseSpecId: vi.fn(),
    prepareProductionDraft: vi.fn(async () => ({ draft: { draftId: "draft-prepared-2" } })),
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    resetSpecEdit: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    clearMessages: vi.fn(),
    startPlanProgress: vi.fn(),
    clearSelectedPlanId: vi.fn(),
    completePlanProgress: vi.fn(),
    failPlanProgress: vi.fn(),
    setError: vi.fn(),
    showProductionDraftReview: vi.fn(),
    ...overrides
  };
}

const spec = {
  specId: "spec-plan-submit-1",
  event: { type: "lunch", date: "2026-06-30" },
  attendees: { expected: 40 }
};

describe("production planning controls", () => {
  it("keeps spec focus, save, and plan actions behind one App boundary", () => {
    const actionInput = input();
    const controls = buildProductionPlanningControls(actionInput);

    controls.beginSpecEdit(spec);
    controls.openSpecForQuestions("spec-questions");

    expect(actionInput.loadSpecIntoEditorState).toHaveBeenCalledWith(spec);
    expect(actionInput.setProductionWorkspaceCleared).toHaveBeenCalledWith(false);
    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-plan-submit-1");
    expect(actionInput.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-questions");
  });

  it("saves the current spec edit through the existing persist path", async () => {
    const calls: string[] = [];
    const actionInput = input({
      updateAcceptedSpec: vi.fn(async () => {
        calls.push("updateAcceptedSpec");
        return { acceptedEventSpec: spec };
      }),
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      })
    });
    const controls = buildProductionPlanningControls(actionInput);

    await controls.handleSaveSpecEdit();

    expect(actionInput.updateAcceptedSpec).toHaveBeenCalledWith("spec-plan-submit-1", { attendeeCount: 40 });
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "updateAcceptedSpec",
      "refreshDashboard",
      "setSubmitting:false"
    ]);
  });

  it("prepares a production draft through the existing edited-spec preflight", async () => {
    const actionInput = input();
    const controls = buildProductionPlanningControls(actionInput);

    await controls.handleCreatePlan(spec);

    expect(actionInput.updateAcceptedSpec).toHaveBeenCalledWith("spec-plan-submit-1", { attendeeCount: 40 });
    expect(actionInput.createProductionDraftFromAcceptedEventSpec).toHaveBeenCalledWith(
      "production-case-plan-1",
      spec
    );
    expect(actionInput.prepareProductionDraft).toHaveBeenCalledWith("draft-imported-1");
    expect(actionInput.showProductionDraftReview).toHaveBeenCalledWith("draft-prepared-2");
    expect(actionInput.completePlanProgress).toHaveBeenCalledTimes(1);
    expect(actionInput.failPlanProgress).not.toHaveBeenCalled();
  });
});


it("prepares the canonical case revision without reimporting an accepted spec", async () => {
  const actionInput = input({ editingSpecId: undefined, productionDraftContext: { caseId: "handoff-case", draft: {
    draftId: "classification-revision-3", revision: 3, status: "pending_review", createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [], draftArtifacts: { eventSpec: spec }
  } } });
  actionInput.getCurrentProductionDraftContext = () => actionInput.productionDraftContext;
  await buildProductionPlanningControls(actionInput).handleCreatePlan(spec);
  expect(actionInput.prepareProductionDraft).toHaveBeenCalledWith("classification-revision-3");
  expect(actionInput.createProductionDraftFromAcceptedEventSpec).not.toHaveBeenCalled();
  expect(actionInput.createProductionCase).not.toHaveBeenCalled();
});


describe("canonical draft context across save and prepare", () => {
  function context(caseId = "old-case", draftId = "old-case-draft", revision = 2) {
    return { caseId, draft: { draftId, revision, status: "pending_review" as const, createdAt: "2026-09-19", source: { sourceRef: "offer-handoff:handoff-1" }, reviewCards: [],
      draftArtifacts: { eventSpec: { specId: "spec-plan-submit-1", menuPlan: [{ componentId: "coffee", label: "Coffee", menuCategory: "classic" }] } }
    } };
  }
  function form(menuCategory: "classic" | "vegetarian" = "classic") {
    return { menuItems: ["Coffee"], componentUpdates: [{ componentId: "coffee", menuCategory, purchasedElements: [], recipeOverrideId: "" }] };
  }

  it.each(["changed case", "newer revision"])("rejects %s before an unchanged editor can prepare its stale draft", async change => {
    const pinned = context();
    const current = change === "changed case" ? context("new-case", "new-case-draft") : context("old-case", "newer-draft", 3);
    const actionInput = input({ productionDraftContext: pinned, activeProductionCaseId: current.caseId,
      getCurrentProductionDraftContext: () => current,
      reviseProductionDraft: vi.fn(), buildCurrentSpecUpdateInput: () => form()
    });
    await buildProductionPlanningControls(actionInput).handleCreatePlan(pinned.draft.draftArtifacts.eventSpec);
    expect(actionInput.prepareProductionDraft).not.toHaveBeenCalled();
    expect(actionInput.reviseProductionDraft).not.toHaveBeenCalled();
    expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
    expect(actionInput.setError).toHaveBeenCalled();
  });

  it.each(["changed case", "newer revision"])("does not continue after %s while saving", async change => {
    const pinned = context();
    let current = pinned;
    let releaseSave!: (response: { draft: ReturnType<typeof context>["draft"] }) => void;
    const save = new Promise<{ draft: ReturnType<typeof context>["draft"] }>(resolve => { releaseSave = resolve; });
    const actionInput = input({ productionDraftContext: pinned, activeProductionCaseId: pinned.caseId,
      getCurrentProductionDraftContext: () => current,
      reviseProductionDraft: vi.fn(() => save), buildCurrentSpecUpdateInput: () => form("vegetarian")
    });
    const pending = buildProductionPlanningControls(actionInput).handleCreatePlan(pinned.draft.draftArtifacts.eventSpec);
    await Promise.resolve();
    current = change === "changed case" ? context("new-case", "new-case-draft") : context("old-case", "unrelated-newer-draft", 4);
    releaseSave({ draft: context("old-case", "saved-draft", 3).draft });
    await pending;
    expect(actionInput.prepareProductionDraft).not.toHaveBeenCalled();
    expect(actionInput.showProductionDraftReview).not.toHaveBeenCalled();
    expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
    expect(actionInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actionInput.setError).toHaveBeenCalled();
  });

  it("checks the live case again after refreshing the saved revision", async () => {
    const pinned = context();
    let current = pinned;
    const actionInput = input({ productionDraftContext: pinned, activeProductionCaseId: pinned.caseId,
      getCurrentProductionDraftContext: () => current,
      reviseProductionDraft: vi.fn(async () => ({ draft: context("old-case", "saved-draft", 3).draft })),
      buildCurrentSpecUpdateInput: () => form("vegetarian"),
      refreshDashboard: vi.fn(async () => { current = context("new-case", "new-case-draft"); })
    });
    await buildProductionPlanningControls(actionInput).handleCreatePlan(pinned.draft.draftArtifacts.eventSpec);
    expect(actionInput.prepareProductionDraft).not.toHaveBeenCalled();
    expect(actionInput.showProductionDraftReview).not.toHaveBeenCalled();
    expect(actionInput.resetSpecEdit).not.toHaveBeenCalled();
    expect(actionInput.setFocusedProductionSpecId).not.toHaveBeenCalled();
  });

  it.each(["before render", "after render"])("prepares its own newly saved revision %s", async timing => {
    const pinned = context();
    let current = pinned;
    const saved = context("old-case", "saved-draft", 3);
    const actionInput = input({ productionDraftContext: pinned, activeProductionCaseId: pinned.caseId,
      getCurrentProductionDraftContext: () => current,
      reviseProductionDraft: vi.fn(async () => ({ draft: saved.draft })),
      refreshDashboard: vi.fn(async () => { if (timing === "after render") current = saved; }),
      buildCurrentSpecUpdateInput: () => form("vegetarian")
    });
    await buildProductionPlanningControls(actionInput).handleCreatePlan(pinned.draft.draftArtifacts.eventSpec);
    expect(actionInput.prepareProductionDraft).toHaveBeenCalledWith("saved-draft");
    expect(actionInput.updateAcceptedSpec).not.toHaveBeenCalled();
    expect(actionInput.createProductionDraftFromAcceptedEventSpec).not.toHaveBeenCalled();
  });
});
