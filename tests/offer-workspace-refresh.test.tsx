// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOfferProductData } from "../backoffice-ui/src/api.js";
import { emptyServiceHealthState } from "../backoffice-ui/src/app-shell-state.js";
import { useOfferWorkspaceData } from "../backoffice-ui/src/use-offer-workspace-data.js";

vi.mock("../backoffice-ui/src/api.js", () => ({ loadOfferProductData: vi.fn() }));
const load = vi.mocked(loadOfferProductData);
type ProductData = Awaited<ReturnType<typeof loadOfferProductData>>;
let current: ReturnType<typeof useOfferWorkspaceData>;
let root: Root | undefined;
const renders: Array<{ caseId?: string; loading: boolean }> = [];
function Harness({ caseId, userId }: { caseId?: string; userId?: string }) {
  current = useOfferWorkspaceData(caseId, userId);
  renders.push({ caseId, loading: current.loading });
  return null;
}
function result(caseId?: string): ProductData {
  return {
    workspace: { cases: [], activeEvents: [], activeSources: [], caseEventsInScope: true, activeCase: caseId ? { caseId, schemaVersion: "1.0", businessId: "local", product: "offer", displayName: "Synthetischer Test", status: "open", version: 1, createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z" } : undefined },
    intakeRequests: [], acceptedSpecs: [], offerDrafts: [],
    serviceHealth: emptyServiceHealthState
  };
}
async function render(caseId?: string, userId?: string) {
  if (!root) {
    const node = document.createElement("div"); document.body.append(node);
    root = createRoot(node);
  }
  await act(async () => root!.render(createElement(Harness, { caseId, userId })));
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; renders.length = 0; document.body.innerHTML = ""; window.sessionStorage.clear(); vi.resetAllMocks();
});
describe("offer workspace refresh after case creation", () => {

  it("treats a newly selected case as loading from the first render until its request settles", async () => {
    let finish!: (value: ProductData) => void;
    load.mockImplementation(async caseId => caseId === "case-b"
      ? new Promise<ProductData>(resolve => { finish = resolve; })
      : result(caseId));
    await render("case-a");
    renders.length = 0;
    await render("case-b");
    expect(renders.filter(entry => entry.caseId === "case-b").every(entry => entry.loading)).toBe(true);
    await act(async () => { finish(result("case-b")); });
    expect(current.loading).toBe(false);
    expect(current.data.activeCase?.caseId).toBe("case-b");
  });

  it("does not accept an earlier result after switching away and back to the same case", async () => {
    let finishB!: (value: ProductData) => void;
    let finishA!: (value: ProductData) => void;
    let visitsA = 0;
    load.mockImplementation(async caseId => {
      if (caseId === "case-b") return new Promise<ProductData>(resolve => { finishB = resolve; });
      if (caseId === "case-a" && ++visitsA > 1) return new Promise<ProductData>(resolve => { finishA = resolve; });
      return result(caseId);
    });
    await render("case-a");
    await render("case-b");
    renders.length = 0;
    await render("case-a");
    expect(renders.filter(entry => entry.caseId === "case-a").every(entry => entry.loading)).toBe(true);
    await act(async () => { finishB(result("case-b")); });
    expect(current.loading).toBe(true);
    await act(async () => { finishA(result("case-a")); });
    expect(current.loading).toBe(false);
    expect(current.data.activeCase?.caseId).toBe("case-a");
  });

  it("refreshes the explicitly created case through the callback captured before it existed", async () => {
    load.mockImplementation(async (caseId) => result(caseId));
    await render();
    const beforeCreation = current.refresh;
    await render("case-new");
    load.mockClear();
    await act(async () => beforeCreation({ focusedOfferCaseId: "case-new" }));
    expect(load).toHaveBeenCalledExactlyOnceWith("case-new");
    expect(current.data.activeCase?.caseId).toBe("case-new");
  });
  it("rejects an old unbound refresh or an explicit case that is no longer active", async () => {
    load.mockImplementation(async (caseId) => result(caseId));
    await render();
    const beforeCreation = current.refresh;
    await render("case-other");
    load.mockClear();
    await act(async () => {
      await beforeCreation();
      await beforeCreation({ focusedOfferCaseId: "case-new" });
    });
    expect(load).not.toHaveBeenCalled();
    expect(current.data.activeCase?.caseId).toBe("case-other");
  });
  it("discards a created-case refresh response after switching to another case", async () => {
    load.mockImplementation(async (caseId) => result(caseId));
    await render();
    const beforeCreation = current.refresh;
    await render("case-new");
    let finish!: (data: ProductData) => void;
    load.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    let pending!: Promise<void>;
    await act(async () => { pending = beforeCreation({ focusedOfferCaseId: "case-new" }); });
    await render("case-other");
    await act(async () => { finish(result("case-new")); await pending; });
    expect(current.data.activeCase?.caseId).toBe("case-other");
    expect(current.loading).toBe(false);
  });
  it("keeps a pending saved version bound to its user and case when the selected case changes", async () => {
    load.mockImplementation(async caseId => result(caseId));
    await render("case-a", "user-a");
    await act(async () => {
      await expect(current.refresh({ requiredOfferDraftId: "saved-a" })).rejects.toThrow("neue Angebotsfassung");
    });
    await render("case-b", "user-a");
    expect(current.data.activeCase?.caseId).toBe("case-b");
    expect(current.error).toBeUndefined();
    await render("case-a", "user-a");
    expect(current.data.activeCase).toBeUndefined();
    expect(current.error).toContain("neue Angebotsfassung");
    await render("case-a", "user-b");
    expect(current.data.activeCase?.caseId).toBe("case-a");
    expect(current.error).toBeUndefined();
  });

  it("hides the previous user's case while the next user's case is loading", async () => {
    load.mockImplementation(async caseId => result(caseId));
    await render("case-a", "user-a");
    let finish!: (value: ProductData) => void;
    load.mockImplementationOnce(() => new Promise<ProductData>(resolve => { finish = resolve; }));
    await render("case-a", "user-b");
    expect(current.loading).toBe(true);
    expect(current.data.activeCase).toBeUndefined();
    await act(async () => { finish(result("case-a")); });
    expect(current.data.activeCase?.caseId).toBe("case-a");
  });

  it("does not acknowledge a saved draft when its refresh is superseded by an older load", async () => {
    load.mockImplementation(async caseId => result(caseId));
    await render("case-edit");
    let finishSaved!: (value: ProductData) => void;
    load.mockImplementationOnce(() => new Promise<ProductData>(resolve => { finishSaved = resolve; }));
    let savedRefresh!: Promise<string>;
    await act(async () => {
      savedRefresh = current.refresh({ requiredOfferDraftId: "saved" }).then(() => "resolved", () => "rejected");
    });
    await act(async () => { await current.refresh(); });
    const saved = result("case-edit");
    saved.offerDrafts = [{ draftId: "saved" }] as ProductData["offerDrafts"];
    await act(async () => { finishSaved(saved); await savedRefresh; });
    expect(await savedRefresh).toBe("rejected");
    expect(current.error).toContain("neue Angebotsfassung");
    expect(current.offerDrafts).toEqual([]);
  });


  it("requires an explicit review of a later draft after a saved draft is superseded", async () => {
    load.mockImplementation(async caseId => result(caseId));
    await render("case-edit", "user-a");
    await act(async () => {
      await expect(current.refresh({ requiredOfferDraftId: "saved-b" })).rejects.toThrow("neue Angebotsfassung");
    });
    const data = result("case-edit");
    const event = (id: string, sequence: number) => ({
      businessId: "local", eventId: "event-" + id, caseId: "case-edit", sequence,
      at: "2026-10-27T00:00:00Z", role: "assistant" as const, kind: "draft_created" as const,
      text: "", artifactId: id,
      revisionRef: { artifactType: "OfferDraft" as const, artifactId: id, revision: 2, createdAt: "2026-10-27T00:00:00Z" }
    });
    data.workspace.activeEvents = [event("saved-b", 2), event("later-c", 3)];
    data.workspace.currentDraft = { businessId: "local", draftId: "later-c", revision: 2 } as ProductData["workspace"]["currentDraft"];
    data.offerDrafts = [data.workspace.currentDraft!] as ProductData["offerDrafts"];
    load.mockResolvedValue(data);
    await act(async () => { await current.refresh(); });
    expect(current.error).toContain("Auftrag wurde danach verändert");
    expect(current.offerDrafts.some(draft => draft.draftId === "later-c")).toBe(false);
    expect(Array.from({ length: window.sessionStorage.length }, (_, i) => window.sessionStorage.getItem(window.sessionStorage.key(i)!))).toContain("saved-b");

    // The explicit action re-fetches and must not trust the earlier observation.
    load.mockResolvedValueOnce({ ...data, workspace: { ...data.workspace, activeEvents: [] } });
    await act(async () => { await current.refresh({ acceptNewerOfferDraft: true }); });
    expect(current.error).toBeDefined();
    expect(current.offerDrafts.some(draft => draft.draftId === "later-c")).toBe(false);
    expect(Array.from({ length: window.sessionStorage.length }, (_, i) => window.sessionStorage.getItem(window.sessionStorage.key(i)!))).toContain("saved-b");

    await act(async () => { await current.refresh({ acceptNewerOfferDraft: true }); });
    expect(current.error).toBeUndefined();
    expect(current.offerDrafts[0]?.draftId).toBe("later-c");
    expect(Array.from({ length: window.sessionStorage.length }, (_, i) => window.sessionStorage.getItem(window.sessionStorage.key(i)!))).not.toContain("saved-b");
  });

  it.each(["missing-saved", "wrong-case", "same-sequence", "missing-current", "newer-unseen", "contradictory-event", "duplicate-other-draft"] as const)(
    "does not release a saved draft on ambiguous history: %s", async ambiguity => {
      load.mockImplementation(async caseId => result(caseId));
      await render("case-edit", "user-a");
      await act(async () => { await expect(current.refresh({ requiredOfferDraftId: "saved-b" })).rejects.toThrow(); });
      const data = result("case-edit");
      const event = (id: string, sequence: number, caseId = "case-edit") => ({
        businessId: "local", eventId: "event-" + id, caseId, sequence, at: "2026-10-27T00:00:00Z",
        role: "assistant" as const, kind: "draft_created" as const, text: "", artifactId: id,
        revisionRef: { artifactType: "OfferDraft" as const, artifactId: id, revision: 2, createdAt: "2026-10-27T00:00:00Z" }
      });
      const saved = event("saved-b", ambiguity === "duplicate-other-draft" ? 3 : 2, ambiguity === "wrong-case" ? "other-case" : "case-edit");
      const later = event("later-c", ambiguity === "same-sequence" ? 2 : ambiguity === "duplicate-other-draft" ? 4 : 3);
      data.workspace.activeEvents = [
        ...(ambiguity === "duplicate-other-draft" ? [
          { ...event("other-d", 1), revisionRef: { ...event("other-d", 1).revisionRef, revision: 1 } },
          event("other-d", 2)
        ] : []),
        ...(ambiguity === "missing-saved" ? [] : [saved]),
        ...(ambiguity === "missing-current" ? [] : [later]),
        ...(ambiguity === "newer-unseen" ? [event("later-d", 4)] : []),
        ...(ambiguity === "contradictory-event" ? [{
          ...event("later-d", 4), revisionRef: { ...event("later-d", 4).revisionRef, artifactId: "later-c" }
        }] : [])
      ];
      data.workspace.currentDraft = { businessId: "local", draftId: "later-c", revision: 2 } as ProductData["workspace"]["currentDraft"];
      data.offerDrafts = [data.workspace.currentDraft!] as ProductData["offerDrafts"];
      load.mockResolvedValue(data);
      await act(async () => { await current.refresh({ acceptNewerOfferDraft: true }); });
      expect(current.error).toBeDefined();
      expect(current.offerDrafts.some(draft => draft.draftId === "later-c")).toBe(false);
      expect(Array.from({ length: window.sessionStorage.length }, (_, i) => window.sessionStorage.getItem(window.sessionStorage.key(i)!))).toContain("saved-b");
    }
  );

  it("requires the saved draft before acknowledging a revision, and propagates refresh failure only for that explicit path", async () => {
    load.mockImplementation(async caseId => result(caseId));
    await render("case-edit");
    await act(async () => {
      await expect(current.refresh({requiredOfferDraftId:"saved"})).rejects.toThrow("neue Angebotsfassung");
    });
    expect(current.data.activeCase?.caseId).toBe("case-edit");
    load.mockRejectedValueOnce(new Error("Netz unterbrochen"));
    await act(async () => { await expect(current.refresh({requiredOfferDraftId:"saved"})).rejects.toThrow("Netz unterbrochen"); });
    load.mockRejectedValueOnce(new Error("Normales Laden fehlgeschlagen"));
    await act(async () => { await expect(current.refresh()).resolves.toBeUndefined(); });
    const data = result("case-edit");
    data.offerDrafts = [{draftId:"saved"}] as ProductData["offerDrafts"];
    load.mockResolvedValueOnce(data);
    await act(async () => { await current.refresh({requiredOfferDraftId:"saved"}); });
    expect(current.offerDrafts[0]?.draftId).toBe("saved");
    expect(current.error).toBeUndefined();
  });

});
