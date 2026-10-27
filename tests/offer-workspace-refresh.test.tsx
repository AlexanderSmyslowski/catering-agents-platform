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
function Harness({ caseId }: { caseId?: string }) {
  current = useOfferWorkspaceData(caseId);
  renders.push({ caseId, loading: current.loading });
  return null;
}
function result(caseId?: string): ProductData {
  return {
    workspace: { cases: [], activeEvents: [], activeSources: [], activeCase: caseId ? { caseId, schemaVersion: "1.0", businessId: "local", product: "offer", displayName: "Synthetischer Test", status: "open", version: 1, createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z" } : undefined },
    intakeRequests: [], acceptedSpecs: [], offerDrafts: [],
    serviceHealth: emptyServiceHealthState
  };
}
async function render(caseId?: string) {
  if (!root) {
    const node = document.createElement("div"); document.body.append(node);
    root = createRoot(node);
  }
  await act(async () => root!.render(createElement(Harness, { caseId })));
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; renders.length = 0; document.body.innerHTML = ""; vi.resetAllMocks();
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
