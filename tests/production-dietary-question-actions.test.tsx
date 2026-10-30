// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../backoffice-ui/src/api.js";
import * as refresh from "../backoffice-ui/src/production-draft-review-panel.js";
import { productionDraftEntryUrl } from "../backoffice-ui/src/production-entry-focus.js";
import { ProductionDietaryQuestionActions } from "../backoffice-ui/src/production-dietary-question-actions.js";

const question = "Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für Gericht?";
function draft(): api.ProductionDraft {
  return { draftId: "draft-A", revision: 2, status: "pending_review", createdAt: "2026-10-30", reviewCards: [{ cardId: "dietary-question-abc", kind: "event_data", title: "Test", summary: "Test", decision: "pending", targetId: "component", targetPath: "$.draftArtifacts.eventSpec.uncertainties[0]", riskLevel: "medium", requiredApproval: true }],
    dietaryQuestionReviews: [{ question, cardId: "dietary-question-abc", status: "pending" }], draftArtifacts: { eventSpec: { menuPlan: [{ componentId: "component", label: "Gericht", menuCategory: "vegan" }], uncertainties: [{ field: "menuPlan", suggestedQuestion: question }] } } };
}
let root: Root;
let container: HTMLDivElement;
const onChanged = vi.fn(async () => {});
async function render(value = draft(), caseId = "case-A") { await act(async () => root.render(createElement(ProductionDietaryQuestionActions, { caseId, draft: value, question, busy: false, onChanged }))); }
function button(label: string) { return [...container.querySelectorAll("button")].find(item => item.textContent === label); }
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); onChanged.mockClear(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe("dietary question actions", () => {
  it("uses the projected card and existing review endpoint, blocking duplicate clicks", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.decideProductionDraftReviewCard>>) => void;
    const request = vi.spyOn(api, "decideProductionDraftReviewCard").mockReturnValue(new Promise(done => { resolve = done; }));
    const announced = vi.spyOn(refresh, "announceProductionDraftRefresh");
    await render();
    await act(async () => { button("Vegan bestätigen")!.click(); button("Vegan bestätigen")!.click(); });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("draft-A", "dietary-question-abc", "fits");
    await act(async () => resolve({ draft: draft(), reviewCard: draft().reviewCards[0]! }));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(announced).toHaveBeenCalledTimes(1);
  });
  it("sends unclear for 'Bleibt offen'", async () => {
    const request = vi.spyOn(api, "decideProductionDraftReviewCard").mockResolvedValue({ draft: draft(), reviewCard: draft().reviewCards[0]! });
    await render(); await act(async () => button("Bleibt offen")!.click());
    expect(button("Bleibt offen")?.className).toBe("secondary-button");
    expect(request).toHaveBeenCalledWith("draft-A", "dietary-question-abc", "unclear");
  });
  it("announces exactly once before the refresh replaces the projection", async () => {
    vi.spyOn(api, "decideProductionDraftReviewCard").mockResolvedValue({ draft: draft(), reviewCard: draft().reviewCards[0]! });
    const announced = vi.spyOn(refresh, "announceProductionDraftRefresh");
    onChanged.mockImplementationOnce(async () => {
      const confirmed = draft();
      confirmed.dietaryQuestionReviews![0]!.status = "confirmed";
      root.render(createElement(ProductionDietaryQuestionActions, { caseId: "case-A", draft: confirmed, question, busy: false, onChanged }));
    });
    await render(); await act(async () => button("Vegan bestätigen")!.click());
    expect(announced).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(container.querySelector("button")).toBeNull();
  });
  it("does not offer writes for decided, missing, or ambiguous mappings", async () => {
    await render({ ...draft(), status: "approved" }); expect(container.querySelector("button")).toBeNull();
    await render({ ...draft(), reviewCards: [] }); expect(container.querySelector("button")).toBeNull(); expect(container.textContent).toContain("Kennzeichnung noch klären");
    const ambiguous = draft(); ambiguous.draftArtifacts!.eventSpec!.menuPlan = [{ componentId: "component", label: "Gericht", menuCategory: "vegan" }, { componentId: "other", label: "Gericht", menuCategory: "vegan" }];
    await render(ambiguous); expect(container.querySelector("button")).toBeNull();
  });
  it("does not claim confirmation on an uncertain failure", async () => {
    vi.spyOn(api, "decideProductionDraftReviewCard").mockRejectedValue(new Error("network"));
    const announced = vi.spyOn(refresh, "announceProductionDraftRefresh");
    await render(); await act(async () => button("Vegan bestätigen")!.click());
    expect(container.textContent).toContain("erneut laden"); expect(container.textContent).not.toContain("Vegan bestätigt");
    expect(button("Vegan bestätigen")?.disabled).toBe(true);
    expect(button("Bleibt offen")?.disabled).toBe(true);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(productionDraftEntryUrl("draft-A", "case-A"));
    await render({ ...draft(), draftId: "draft-B" });
    expect(button("Vegan bestätigen")?.disabled).toBe(false);
    expect(onChanged).not.toHaveBeenCalled(); expect(announced).not.toHaveBeenCalled();
  });
  it("ignores a late A result after A to B to A", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.decideProductionDraftReviewCard>>) => void;
    vi.spyOn(api, "decideProductionDraftReviewCard").mockReturnValue(new Promise(done => { resolve = done; }));
    const announced = vi.spyOn(refresh, "announceProductionDraftRefresh");
    await render(); await act(async () => button("Vegan bestätigen")!.click());
    await render({ ...draft(), draftId: "draft-B" }, "case-B"); await render();
    await act(async () => resolve({ draft: draft(), reviewCard: draft().reviewCards[0]! }));
    expect(onChanged).not.toHaveBeenCalled(); expect(announced).not.toHaveBeenCalled(); expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
