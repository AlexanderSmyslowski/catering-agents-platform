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
  const render = async (draft = parent, caseId = "synthetic-case", applied = true, options: { openQuestionCount?: number; busy?: boolean; snapshot?: api.LastAppliedProductionSnapshot | null } = {}) => act(async () => root.render(createElement(ProductionClarificationContinuation, { caseId, draft, applied, lastApplied: options.snapshot === null ? undefined : options.snapshot ?? lastApplied, openQuestionCount: options.openQuestionCount ?? 4, busy: options.busy ?? false, onChanged })));
  await render();
  return { node, render, onChanged, button: (text: string) => [...node.querySelectorAll("button")].find(item => item.textContent === text) };
}

describe("visible review continuation", () => {
  it("opens a new planning revision without inventing a question", async () => {
    const create = vi.spyOn(api, "createProductionClarificationFollowup").mockResolvedValue({ draft: child });
    const announced = vi.fn();
    window.addEventListener("catering:production-draft-review", announced, { once: true });
    const view = await mount();
    await view.render(parent, "synthetic-case", true, { openQuestionCount: 0 });
    expect(view.node.textContent).toContain("Der bisherige Plan bleibt erhalten. Änderungen werden in einer neuen Prüffassung erneut geprüft, freigegeben und übernommen.");
    expect(view.node.textContent).not.toContain("Offene Rückfragen klären");
    await act(async () => view.button("Neue Prüffassung erstellen")!.click());
    expect(create).toHaveBeenCalledExactlyOnceWith(parent.draftId, { caseId: "synthetic-case", expectedRevision: 3 });
    expect(announced).toHaveBeenCalledOnce();
    expect((announced.mock.calls[0]![0] as CustomEvent).detail.draftId).toBe(child.draftId);
    expect(new URLSearchParams(window.location.search).get("productionDraftId")).toBe(child.draftId);
    expect(view.node.textContent).toContain("Mengen und Rezepte müssen erneut geprüft werden");
    expect(view.node.textContent).not.toContain("Rückfragen einzeln prüfen");
  });

  it("keeps the new action unavailable without a matching applied snapshot or while busy", async () => {
    const create = vi.spyOn(api, "createProductionClarificationFollowup");
    const view = await mount();
    await view.render(parent, "synthetic-case", false, { openQuestionCount: 0 });
    expect(view.button("Neue Prüffassung erstellen")).toBeUndefined();
    await view.render(parent, "synthetic-case", true, { openQuestionCount: 0, snapshot: null });
    expect(view.button("Neue Prüffassung erstellen")).toBeUndefined();
    await view.render(parent, "synthetic-case", true, { openQuestionCount: 0, snapshot: { ...lastApplied, approvedProductionSpecId: "" } });
    expect(view.button("Neue Prüffassung erstellen")).toBeUndefined();
    await view.render(parent, "synthetic-case", true, { openQuestionCount: 0, snapshot: { ...lastApplied, draftRevision: 2 } });
    expect(view.button("Neue Prüffassung erstellen")).toBeUndefined();
    await view.render(parent, "synthetic-case", true, { openQuestionCount: 0, busy: true });
    expect(view.button("Neue Prüffassung erstellen")!.disabled).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("ignores a late response after the applied revision binding changes", async () => {
    let resolve!: (value: { draft: api.ProductionDraft }) => void;
    vi.spyOn(api, "createProductionClarificationFollowup").mockReturnValue(new Promise(done => { resolve = done; }));
    const view = await mount();
    await view.render(parent, "synthetic-case", true, { openQuestionCount: 0 });
    await act(async () => view.button("Neue Prüffassung erstellen")!.click());
    await view.render({ ...parent, revision: 4 }, "synthetic-case", true, { openQuestionCount: 0, snapshot: { ...lastApplied, draftRevision: 4 } });
    await act(async () => resolve({ draft: child }));
    expect(window.location.search).toBe("");
    expect(view.onChanged).not.toHaveBeenCalled();
  });

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

  it("shows the previous documents and preparation directly for a zero-question continuation", async () => {
    const view = await mount();
    await view.render(child, "synthetic-case", false, { openQuestionCount: 0 });
    expect(view.node.textContent).toContain("Letzter übernommener Stand · Fassung 3");
    expect(view.button("Prüffassung vorbereiten")).toBeDefined();
    const links = [...view.node.querySelectorAll('a[target="_blank"]')];
    expect(links).toHaveLength(3);
    expect(links.every(link => link.closest("details") === null && link.getAttribute("href")?.includes("snapshotCaseId=synthetic-case"))).toBe(true);
    expect(view.node.textContent).not.toContain("einzeln beantwortbaren Rückfragen");
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
