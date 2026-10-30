// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProductionManualSpecSubmitAction, type ProductionManualSpecSubmitInput } from "../backoffice-ui/src/production-manual-spec-submit-action.js";

function input(): ProductionManualSpecSubmitInput {
  return { createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: { specId: "new-spec" } })),
    createProductionCase: vi.fn(async () => ({ case: { caseId: "new-case" } })),
    createProductionDraftFromAcceptedEventSpec: vi.fn(async () => ({ draft: { draftId: "new-draft" } })),
    buildCurrentManualSpecInput: () => ({}), setSubmitting: vi.fn(), setProductionWorkspaceCleared: vi.fn(), clearMessages: vi.fn(),
    setFocusedProductionSpecId: vi.fn(), setActiveProductionCaseId: vi.fn(), setActiveProductionCaseSpecId: vi.fn(),
    resetManualSpecDraft: vi.fn(), refreshDashboard: vi.fn(async () => {}), setNotice: vi.fn(), setError: vi.fn() };
}
afterEach(() => window.history.replaceState({}, "", "/"));
describe("manual production URL binding", () => {
  it("replaces an old case only after the new case and draft are confirmed", async () => {
    window.history.replaceState({}, "", "/produktion?productionCaseId=old-case&productionDraftId=old-draft");
    const actions = input();
    await buildProductionManualSpecSubmitAction(actions)();
    expect(new URLSearchParams(location.search).get("productionCaseId")).toBe("new-case");
    expect(new URLSearchParams(location.search).get("productionDraftId")).toBe("new-draft");
    expect(location.hash).toBe("#production-draft-new-draft");
  });
  it.each(["reject", "missing-id"])("retains the previous URL when draft creation returns %s", async outcome => {
    window.history.replaceState({}, "", "/produktion?productionCaseId=old-case");
    const actions = input();
    actions.createProductionDraftFromAcceptedEventSpec = outcome === "reject" ? vi.fn(async () => { throw new Error("failed"); }) : vi.fn(async () => ({ draft: { draftId: "" } }));
    await buildProductionManualSpecSubmitAction(actions)();
    expect(location.search).toBe("?productionCaseId=old-case");
    expect(actions.setActiveProductionCaseId).not.toHaveBeenCalled();
    expect(actions.setError).toHaveBeenCalled();
  });
});
