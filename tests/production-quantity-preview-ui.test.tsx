// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductionQuantityWorkflowPanel } from "../backoffice-ui/src/production-quantity-workflow-panel.js";
import { fetchProductionQuantityWorkflow, previewProductionQuantityOverride, confirmProductionQuantityOverride, type ProductionQuantityWorkflowItem } from "../backoffice-ui/src/production-quantity-api.js";
vi.mock("../backoffice-ui/src/production-quantity-api.js", () => ({
  fetchProductionQuantityWorkflow: vi.fn(), previewProductionQuantityOverride: vi.fn(), confirmProductionQuantityOverride: vi.fn()
}));
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ""; });
const item: ProductionQuantityWorkflowItem = {
  componentId: "chicken", label: "Hähnchenragout", status: "recommended", evidenceReferences: [], sourceRevision: "rev-1",
  currentAuthority: { perUnitAmount: 0.55, targetAmount: 55, unit: "servings", reviewStatus: "approved" }, canEdit: true, purchaseRows: []
};
const button = (label: string) => Array.from(document.querySelectorAll("button")).find(x => x.textContent === label)!;
async function mount() {
  vi.mocked(fetchProductionQuantityWorkflow).mockResolvedValue({ items: [item] });
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-a" })));
  return root;
}
async function change(value: string) {
  const field = document.querySelector('input[aria-label="Hähnchenragout Menge pro Person"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
describe("quantity workflow preview UI", () => {
  it("renders no quantities or requests before an order is selected", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, {})));
    expect(document.body.textContent).toBe("");
    expect(fetchProductionQuantityWorkflow).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("accepts German decimals and shows actual before/after values and pending kitchen approval", async () => {
    const root = await mount();
    vi.mocked(previewProductionQuantityOverride).mockResolvedValue({
      previewId: "preview-a", sourceRevision: "rev-1",
      preview: { status: "preview_ready", confirmable: true, scaleFactor: 60 / 55,
        resultingTarget: { amount: 60, unit: "servings" },
        recipeChanges: [{ ingredientId: "chicken", name: "Hähnchenbrust roh", previousAmount: 6.6, baselineAmount: 7.2, effectiveAmount: 7.2, unit: "kg" },
          { ingredientId: "spice", name: "Gewürz", previousAmount: 0.002, baselineAmount: 0.003, effectiveAmount: 0.003, unit: "kg" }] }
    });
    await change("0,6");
    await act(async () => button("Änderung prüfen").click());
    expect(previewProductionQuantityOverride).toHaveBeenCalledExactlyOnceWith("case-a", "chicken", { origin: "target_output", perUnitAmount: 0.6, unit: "servings" });
    expect(document.body.textContent).toContain("6,6 kg → 7,2 kg");
    expect(document.body.textContent).toContain("0,002 kg → 0,003 kg");
    expect(document.body.textContent).toContain("Faktor 1,0909");
    expect(document.body.textContent).toContain("Die neue Menge benötigt eine neue Küchenfreigabe");
    expect(document.body.textContent).not.toContain("servings");
    await act(async () => button("Abbrechen").click());
    expect(document.querySelector('[aria-label="Mengenvorschau"]')).toBeNull();
    expect(confirmProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
  const ready = (previewId: string, amount: number) => ({
    previewId, sourceRevision: "rev-1",
    preview: { status: "preview_ready" as const, confirmable: true, scaleFactor: amount / 55, resultingTarget: { amount, unit: "servings" }, recipeChanges: [] }
  });

  it("drops a pending preview when the visible input changes and never confirms the old value", async () => {
    const root = await mount();
    vi.mocked(previewProductionQuantityOverride).mockResolvedValue(ready("preview-060", 60));
    await change("0,6");
    await act(async () => button("Änderung prüfen").click());
    expect(document.querySelector('[aria-label="Mengenvorschau"]')?.textContent).toContain("Hähnchenragout");
    expect(document.querySelector('[aria-label="Mengenvorschau"]')?.textContent).toContain("0,6 Portionen pro Person");
    await change("0,7");
    expect(document.querySelector('[aria-label="Mengenvorschau"]')).toBeNull();
    expect(button("Änderung übernehmen")).toBeUndefined();
    expect(confirmProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("ignores a late preview response after the input changed during the request", async () => {
    const root = await mount();
    let finish!: (value: ReturnType<typeof ready>) => void;
    vi.mocked(previewProductionQuantityOverride).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await change("0,6");
    await act(async () => button("Änderung prüfen").click());
    await change("0,8");
    await act(async () => finish(ready("preview-060", 60)));
    expect(document.querySelector('[aria-label="Mengenvorschau"]')).toBeNull();
    vi.mocked(previewProductionQuantityOverride).mockResolvedValueOnce(ready("preview-080", 80));
    vi.mocked(confirmProductionQuantityOverride).mockResolvedValue({ status: "review_required" });
    await act(async () => button("Änderung prüfen").click());
    await act(async () => button("Änderung übernehmen").click());
    expect(confirmProductionQuantityOverride).toHaveBeenCalledExactlyOnceWith("case-a", "chicken", "preview-080", { origin: "target_output", perUnitAmount: 0.8, unit: "servings" });
    expect(document.body.textContent).toContain("benötigt noch die Küchenfreigabe");
    await act(async () => root.unmount());
  });

  it("clears an earlier preview when a new preview fails and shows the failure as an error", async () => {
    const root = await mount();
    vi.mocked(previewProductionQuantityOverride).mockResolvedValueOnce(ready("preview-060", 60)).mockRejectedValueOnce(new Error("409 Conflict"));
    await change("0,6");
    await act(async () => button("Änderung prüfen").click());
    expect(button("Änderung übernehmen")).toBeDefined();
    await change("0,9");
    await act(async () => button("Änderung prüfen").click());
    expect(document.querySelector('[aria-label="Mengenvorschau"]')).toBeNull();
    expect(document.querySelector('[role="alert"]')?.className).toContain("form-error");
    expect(confirmProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("does not carry a preview over to another production case", async () => {
    vi.mocked(fetchProductionQuantityWorkflow).mockResolvedValue({ items: [item] });
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-a" })));
    vi.mocked(previewProductionQuantityOverride).mockResolvedValue(ready("preview-060", 60));
    await change("0,6");
    await act(async () => button("Änderung prüfen").click());
    expect(button("Änderung übernehmen")).toBeDefined();
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-b" })));
    expect(document.querySelector('[aria-label="Mengenvorschau"]')).toBeNull();
    expect((document.querySelector('input[aria-label="Hähnchenragout Menge pro Person"]') as HTMLInputElement).value).toBe("0,55");
    expect(confirmProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("removes loaded case A items immediately when case B with the same component is delayed or fails", async () => {
    const root = await mount();
    let fail!: (reason: Error) => void;
    vi.mocked(fetchProductionQuantityWorkflow).mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-b" })));
    expect(document.body.textContent).not.toContain(item.label);
    expect(button("Änderung prüfen")).toBeUndefined();
    await act(async () => fail(new Error("Laden fehlgeschlagen")));
    expect(document.body.textContent).not.toContain(item.label);
    expect(previewProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("never shows or edits another case's quantities while loading or after failure, including late responses", async () => {
    let resolveA!: (value: { items: ProductionQuantityWorkflowItem[] }) => void;
    let rejectB!: (reason: Error) => void;
    vi.mocked(fetchProductionQuantityWorkflow).mockReturnValueOnce(new Promise(resolve => { resolveA = resolve; }));
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-a" })));
    vi.mocked(fetchProductionQuantityWorkflow).mockReturnValueOnce(new Promise((_, reject) => { rejectB = reject; }));
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-b" })));
    await act(async () => resolveA({ items: [item] }));
    expect(document.body.textContent).not.toContain(item.label);
    await act(async () => rejectB(new Error("Laden fehlgeschlagen")));
    expect(document.body.textContent).not.toContain(item.label);
    expect(button("Änderung prüfen")).toBeUndefined();
    vi.mocked(fetchProductionQuantityWorkflow).mockResolvedValueOnce({ items: [{ ...item, label: "Anderes Gericht" }] });
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-c" })));
    expect(document.body.textContent).toContain("Anderes Gericht");
    expect(document.body.textContent).not.toContain(item.label);
    expect(previewProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("shows the stored value in German notation and previews it unchanged without rounding", async () => {
    const root = await mount();
    const field = document.querySelector('input[aria-label="Hähnchenragout Menge pro Person"]') as HTMLInputElement;
    expect(field.value).toBe("0,55");
    vi.mocked(previewProductionQuantityOverride).mockResolvedValue(ready("preview-055", 55));
    await act(async () => button("Änderung prüfen").click());
    expect(previewProductionQuantityOverride).toHaveBeenCalledExactlyOnceWith("case-a", "chicken", { origin: "target_output", perUnitAmount: 0.55, unit: "servings" });
    await act(async () => root.unmount());
  });

  it("renders preview and failures inside the affected component row and moves focus there", async () => {
    const other: ProductionQuantityWorkflowItem = { ...item, componentId: "muffins", label: "Tortilla-Muffins" };
    vi.mocked(fetchProductionQuantityWorkflow).mockResolvedValue({ items: [item, other] });
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-a" })));
    const rows = () => Array.from(document.querySelectorAll('[data-testid="production-quantity-workflow"] > ul > li'));
    vi.mocked(previewProductionQuantityOverride).mockResolvedValueOnce(ready("preview-060", 60)).mockRejectedValueOnce(new Error("409 Conflict"));
    await change("0,6");
    await act(async () => button("Änderung prüfen").click());
    const preview = document.querySelector('[aria-label="Mengenvorschau"]')!;
    expect(rows()[0].contains(preview)).toBe(true);
    expect(rows()[1].contains(preview)).toBe(false);
    expect(document.activeElement?.contains(preview)).toBe(true);

    await change("0,9");
    expect(rows()[0].querySelector('[role="status"]')?.textContent).toContain("Die Eingabe wurde geändert");
    await act(async () => button("Änderung prüfen").click());
    const failure = document.querySelector('[role="alert"]')!;
    expect(rows()[0].contains(failure)).toBe(true);
    expect(failure.textContent).toContain("409 Conflict");
    expect(document.activeElement?.contains(failure)).toBe(true);

    await change("0");
    await act(async () => button("Änderung prüfen").click());
    expect(rows()[0].querySelector('[role="alert"]')?.textContent).toContain("positive Menge");
    expect(rows()[1].querySelector('[role="alert"]')).toBeNull();
    expect(confirmProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("shows a purchase quantity preview inside its purchase row", async () => {
    const withPurchase: ProductionQuantityWorkflowItem = { ...item, purchaseRows: [
      { rowId: "row-zimt", articleName: "Zimt", amount: 0.002, unit: "kg", editable: true, lineage: { ingredientId: "zimt" } } as ProductionQuantityWorkflowItem["purchaseRows"][number]
    ] };
    vi.mocked(fetchProductionQuantityWorkflow).mockResolvedValue({ items: [withPurchase] });
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(createElement(ProductionQuantityWorkflowPanel, { caseId: "case-a" })));
    const purchaseInput = document.querySelector('input[aria-label="Zimt Einkaufsmenge"]') as HTMLInputElement;
    expect(purchaseInput.value).toBe("0,002");
    vi.mocked(previewProductionQuantityOverride).mockResolvedValue(ready("preview-zimt", 55));
    await act(async () => button("Einkaufsmenge prüfen").click());
    expect(previewProductionQuantityOverride).toHaveBeenCalledExactlyOnceWith("case-a", "chicken", { origin: "purchase_ingredient", ingredientId: "zimt", amount: 0.002, unit: "kg" });
    expect(purchaseInput.closest("li")!.querySelector('[aria-label="Mengenvorschau"]')).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("rejects nonpositive or malformed quantities before requesting a preview", async () => {
    const root = await mount();
    for (const value of ["-1", "0", "abc", "1,2,3", ""]) {
      await change(value);
      await act(async () => button("Änderung prüfen").click());
      expect(document.querySelector('[role="alert"]')?.textContent).toContain("positive Menge");
    }
    expect(previewProductionQuantityOverride).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
