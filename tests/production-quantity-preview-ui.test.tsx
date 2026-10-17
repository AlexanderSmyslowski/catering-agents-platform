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
