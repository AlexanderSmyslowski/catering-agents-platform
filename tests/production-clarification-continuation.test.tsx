// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../backoffice-ui/src/api.js";
import { ProductionClarificationContinuation } from "../backoffice-ui/src/production-clarification-continuation.js";

const parent: api.ProductionDraft = { draftId: "applied-parent", revision: 3, status: "approved", createdAt: "2026-10-30T10:00:00Z", reviewCards: [], draftArtifacts: { eventSpec: { specId: "synthetic-spec" } } };
const child: api.ProductionDraft = { ...parent, draftId: "pending-child", status: "pending_review", revision: 4, supersedesDraftId: parent.draftId };
const lastApplied = { approvedProductionSpecId: "approved-parent", draftId: parent.draftId, draftRevision: 3, eventSpec: { specId: "synthetic-spec" }, productionPlan: { planId: "old-plan" }, purchaseList: { purchaseListId: "old-shopping" } } as api.LastAppliedProductionSnapshot;
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); document.body.innerHTML = ""; window.history.replaceState({}, "", "/produktion"); vi.restoreAllMocks(); });
async function mount() {
  const node = document.createElement("div"); document.body.appendChild(node);
  const root = createRoot(node); roots.push(root);
  const onChanged = vi.fn(async () => undefined);
  const render = async (draft = parent, caseId = "synthetic-case", applied = true) => act(async () => root.render(createElement(ProductionClarificationContinuation, { caseId, draft, applied, lastApplied, openQuestionCount: 4, busy: false, onChanged })));
  await render();
  return { node, render, onChanged, button: (text: string) => [...node.querySelectorAll("button")].find(item => item.textContent === text) };
}

describe("visible review continuation", () => {
  it("creates one explicit bound followup and opens its own case and revision", async () => {
    let resolve!: (value: { draft: api.ProductionDraft }) => void;
    const create = vi.spyOn(api, "createProductionClarificationFollowup").mockReturnValue(new Promise(done => { resolve = done; }));
    const view = await mount();
    await act(async () => { view.button("Rückfragen in neuer Prüffassung beantworten")!.click(); view.button("Rückfragen in neuer Prüffassung beantworten")?.click(); });
    expect(create).toHaveBeenCalledExactlyOnceWith(parent.draftId, { caseId: "synthetic-case", expectedRevision: 3 });
    await act(async () => resolve({ draft: child }));
    expect(new URLSearchParams(window.location.search).get("productionDraftId")).toBe(child.draftId);
    expect(new URLSearchParams(window.location.search).get("productionCaseId")).toBe("synthetic-case");
    expect(view.onChanged).toHaveBeenCalledOnce();
  });

  it("does not navigate or refresh for a late A→B→A response", async () => {
    let resolve!: (value: { draft: api.ProductionDraft }) => void;
    vi.spyOn(api, "createProductionClarificationFollowup").mockReturnValue(new Promise(done => { resolve = done; }));
    const view = await mount();
    await act(async () => view.button("Rückfragen in neuer Prüffassung beantworten")!.click());
    await view.render(parent, "another-case"); await view.render();
    await act(async () => resolve({ draft: child }));
    expect(window.location.search).toBe("");
    expect(view.onChanged).not.toHaveBeenCalled();
  });

  it("requires a fresh load after an unknown mutation outcome", async () => {
    vi.spyOn(api, "createProductionClarificationFollowup").mockRejectedValue(new Error("synthetic unknown outcome"));
    const view = await mount();
    await act(async () => view.button("Rückfragen in neuer Prüffassung beantworten")!.click());
    expect(view.node.textContent).toContain("konnte nicht sicher bestätigt werden");
    expect(view.button("Rückfragen in neuer Prüffassung beantworten")!.disabled).toBe(true);
    expect(view.node.querySelector('a')?.getAttribute("href")).toContain("productionCaseId=synthetic-case");
  });

  it("keeps historical documents separately bound while preparation remains an explicit action", async () => {
    const prepare = vi.spyOn(api, "prepareProductionDraft").mockResolvedValue({ draft: { ...child, draftId: "prepared-child", revision: 5, supersedesDraftId: child.draftId } });
    const view = await mount(); await view.render(child, "synthetic-case", false);
    expect(view.node.textContent).toContain("Letzter übernommener Stand");
    expect(prepare).not.toHaveBeenCalled();
    const links = [...view.node.querySelectorAll('a[target="_blank"]')];
    expect(links).toHaveLength(3);
    expect(links.every(link => link.getAttribute("href")?.includes("snapshotCaseId=synthetic-case"))).toBe(true);
    await act(async () => view.button("Prüffassung vorbereiten")!.click());
    expect(prepare).toHaveBeenCalledExactlyOnceWith(child.draftId);
  });
});
