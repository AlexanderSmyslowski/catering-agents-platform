// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { IngredientCostHelper } from "../backoffice-ui/src/ingredient-cost-helper.js";

vi.mock("../backoffice-ui/src/supplier-price-import.js", () => ({ readSchwanPriceList: () => [
  { article: "TEST-1", product: "Beispielreis", content: "5 kg", unit: "Kolli", price: "12.50", row: 13 }
] }));
afterEach(() => { document.body.innerHTML = ""; });
const label = (name: string) => Array.from(document.querySelectorAll("label")).find(x => x.textContent?.startsWith(name))!;
async function setInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("requires a list date and a separate price basis for a selected supplier article", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  const apply = vi.fn();
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: apply, onInvalidate: vi.fn() })));
  const file = new File(["test"], "test.xlsx");
  Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  const input = label("Schwan-Exceldatei").querySelector("input")!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  await setInput(label("Zutat oder Kostenbestandteil").querySelector("input")!, "Reis");
  let candidate = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Beispielreis ·"))!;
  expect(candidate.disabled).toBe(true);
  await setInput(label("Preisstand der Liste").querySelector("input")!, "2026-11-02");
  candidate = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Beispielreis ·"))!;
  expect(candidate.disabled).toBe(false);
  await act(async () => candidate.click());
  expect(label("Preis des Preisbezugs netto").querySelector("input")!.value).toBe("12.50");
  expect(label("Menge im Preisbezug").querySelector("input")!.value).toBe("");
  expect(label("Einheit für beide Mengen").querySelector("select")!.value).toBe("");
  expect(label("Quelle oder Schätzgrund").querySelector("input")!.value).toContain("2026-11-02");
  expect(apply).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it("ignores a late failed read of an older file and clears the date for a new list", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: vi.fn(), onInvalidate: vi.fn() })));
  const input = label("Schwan-Exceldatei").querySelector("input")!;
  const first = new File(["first"], "first.xlsx");
  let rejectOld!: (error: Error) => void;
  Object.defineProperty(first, "arrayBuffer", { value: () => new Promise((_resolve, reject) => { rejectOld = reject; }) });
  Object.defineProperty(input, "files", { value: [first], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  await setInput(label("Preisstand der Liste").querySelector("input")!, "2026-10-01");
  const second = new File(["second"], "second.xlsx");
  Object.defineProperty(second, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  Object.defineProperty(input, "files", { value: [second], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(label("Preisstand der Liste").querySelector("input")!.value).toBe("");
  await act(async () => rejectOld(new Error("veralteter Fehler")));
  expect(document.body.textContent).toContain("1 Preisvorschläge gelesen");
  expect(document.body.textContent).not.toContain("veralteter Fehler");
  await act(async () => root.unmount());
});
