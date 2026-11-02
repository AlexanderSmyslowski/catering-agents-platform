// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { IngredientCostHelper } from "../backoffice-ui/src/ingredient-cost-helper.js";
import { ApiResponseError, previewSupplierInvoice } from "../backoffice-ui/src/api.js";

vi.mock("../backoffice-ui/src/supplier-price-import.js", () => ({ readSchwanPriceList: () => [
  { article: "TEST-1", product: "Beispielreis", content: "5 kg", unit: "Kolli", price: "12.50", row: 13 }
] }));
vi.mock("../backoffice-ui/src/api.js", () => ({
  ApiResponseError: class extends Error { constructor(message: string, public status: number) { super(message); } },
  previewSupplierInvoice: vi.fn()
}));
const preview = vi.mocked(previewSupplierInvoice);
const label = (name: string) => Array.from(document.querySelectorAll("label")).find(x => x.textContent?.startsWith(name))!;
const candidate = { supplier: "Testlieferant", invoiceId: "INV-1", invoiceDate: "2026-10-01", lineId: "1", article: "Testware", quantity: "2.5", unit: "kg", lineNetEur: "10.00", reviewRequired: true as const };
afterEach(() => { document.body.innerHTML = ""; vi.resetAllMocks(); });
async function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
function fileWithContent(name: string, value: string) {
  const file = new File([value], name);
  Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(value).buffer });
  return file;
}
it("shows unreviewed evidence and transfers a position only on explicit selection", async () => {
  preview.mockResolvedValue({ candidates: [candidate] });
  const apply = vi.fn();
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: apply, onInvalidate: vi.fn() })));
  await selectFile(label("E-Rechnung (XML)").querySelector("input")!, fileWithContent("invoice.xml", "<test/>"));
  expect(document.body.textContent).toContain("„Stück“ kann auch ein Gebinde bezeichnen");
  expect(preview).toHaveBeenCalledWith("<test/>");
  expect(label("Menge im Preisbezug").querySelector("input")!.value).toBe("");
  const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("INV-1"))!;
  expect(button.textContent).toContain("ungeprüft");
  expect(button.textContent).toContain("2.5 kg");
  await act(async () => button.click());
  expect(label("Menge im Preisbezug").querySelector("input")!.value).toBe("2.5");
  expect(label("Einheit für beide Mengen").querySelector("select")!.value).toBe("kg");
  expect(label("Preis des Preisbezugs netto").querySelector("input")!.value).toBe("10.00");
  expect(document.body.textContent).toContain("Testlieferant, Beleg INV-1 vom 01.10.2026, Position 1: 2.5 kg, 10.00 € netto; ungeprüft");
  expect(apply).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
it("reports a rejected legacy session and never sends an obsolete file", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: vi.fn(), onInvalidate: vi.fn() })));
  const input = label("E-Rechnung (XML)").querySelector("input")!;
  let finish!: (buffer: ArrayBuffer) => void;
  const old = new File(["old"], "old.xml");
  Object.defineProperty(old, "arrayBuffer", { value: () => new Promise(resolve => { finish = resolve; }) });
  await selectFile(input, old);
  preview.mockRejectedValue(new ApiResponseError("not allowed", 403));
  await selectFile(input, fileWithContent("new.xml", "new"));
  await act(async () => finish(new TextEncoder().encode("old").buffer));
  expect(preview).toHaveBeenCalledTimes(1);
  expect(preview).toHaveBeenCalledWith("new");
  expect(document.body.textContent).toContain("persönlich anmelden");
  await act(async () => root.unmount());
});

it.each(["price", "reference", "unit", "article"])("keeps a changed invoice %s marked after editing the source and on transfer", async (field) => {
  preview.mockResolvedValue({ candidates: [candidate] });
  const apply = vi.fn();
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: apply, onInvalidate: vi.fn() })));
  await selectFile(label("E-Rechnung (XML)").querySelector("input")!, fileWithContent("invoice.xml", "<test/>"));
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("INV-1"))!.click());
  const set = async (title: string, value: string) => {
    const input = label(title).querySelector("input")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  if (field === "article") await set("Zutat oder Kostenbestandteil", "Andere Ware");
  if (field === "price") await set("Preis des Preisbezugs netto", "11");
  if (field === "reference") await set("Menge im Preisbezug", "3");
  if (field === "unit") {
    const select = label("Einheit für beide Mengen").querySelector("select")!;
    await act(async () => { select.value = "g"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  }
  await set("Quelle oder Schätzgrund", "Manuell bearbeitete Quelle");
  expect(document.body.textContent).toContain("Rechnungsartikel, Bezug, Einheit oder Preis wurden manuell geändert");
  await set("Benötigte Menge", "1");
  await act(async () => label("Alle direkten Kosten").querySelector("input")!.click());
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Kostensumme als Schätzung übernehmen")!.click());
  expect(apply).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("Rechnungsartikel, Bezug, Einheit oder Preis manuell geändert"));
  expect(apply).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("Testlieferant, INV-1, 2026-10-01, Pos. 1, Testware: 2.5 kg, 10.00 EUR netto, ungeprüft"));
  await act(async () => root.unmount());
});

it("replaces the prior evidence when switching Schwan to UBL and back", async () => {
  preview.mockResolvedValue({ candidates: [candidate] });
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: vi.fn(), onInvalidate: vi.fn() })));
  const set = async (title: string, value: string) => {
    const input = label(title).querySelector("input")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  await selectFile(label("Schwan-Exceldatei").querySelector("input")!, fileWithContent("prices.xlsx", "test"));
  await set("Preisstand der Liste", "2026-11-02");
  await set("Zutat oder Kostenbestandteil", "Reis");
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Beispielreis ·"))!.click());
  expect(label("Quelle oder Schätzgrund").querySelector("input")!.value).toContain("Schwan");
  await set("Zutat oder Kostenbestandteil", "Anderer Artikel");
  expect(document.body.textContent).toContain("Listenartikel manuell geändert");
  await set("Quelle oder Schätzgrund", "Manuell angepasst");
  expect(document.body.textContent).toContain("Ursprüngliche Listenquelle");
  await selectFile(label("E-Rechnung (XML)").querySelector("input")!, fileWithContent("invoice.xml", "<test/>"));
  await set("Zutat oder Kostenbestandteil", "");
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("INV-1"))!.click());
  expect(document.body.textContent).toContain("Rechnungsquelle: Testlieferant");
  expect(document.body.textContent).not.toContain("Listenartikel manuell geändert");
  expect(document.body.textContent).not.toContain("Ursprüngliche Listenquelle");
  await set("Zutat oder Kostenbestandteil", "Reis");
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Beispielreis ·"))!.click());
  expect(label("Quelle oder Schätzgrund").querySelector("input")!.value).toContain("Schwan");
  expect(document.body.textContent).not.toContain("Rechnungsquelle: Testlieferant");
  expect(document.body.textContent).not.toContain("Rechnungsartikel, Bezug, Einheit oder Preis wurden manuell geändert");
  await act(async () => root.unmount());
});

it.each([[401, "persönlich anmelden"], [403, "persönlich anmelden"], [413, "zu groß"], [429, "Zu viele Prüfungen"], [503, "Rechnungsdienst ist gerade nicht verfügbar"]])("explains API failure %s", async (status, expected) => {
  preview.mockRejectedValue(new ApiResponseError("ignored", status));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: vi.fn(), onInvalidate: vi.fn() })));
  await selectFile(label("E-Rechnung (XML)").querySelector("input")!, fileWithContent("invoice.xml", "test"));
  expect(document.body.textContent).toContain(expected);
  await act(async () => root.unmount());
});
it("distinguishes network and UTF-8 errors and permits retrying the same file", async () => {
  preview.mockRejectedValue(new Error("network"));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: vi.fn(), onInvalidate: vi.fn() })));
  const input = label("E-Rechnung (XML)").querySelector("input")!;
  const file = fileWithContent("invoice.xml", "test");
  await selectFile(input, file);
  expect(document.body.textContent).toContain("Verbindung zum Rechnungsdienst");
  await selectFile(input, file);
  expect(preview).toHaveBeenCalledTimes(2);
  const invalid = new File(["invalid"], "invalid.xml");
  Object.defineProperty(invalid, "arrayBuffer", { value: async () => new Uint8Array([255]).buffer });
  await selectFile(input, invalid);
  expect(document.body.textContent).toContain("UTF-8-kodiert");
  expect(preview).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});
it("retains three original invoice positions within the source limit and blocks oversized provenance", async () => {
  preview.mockResolvedValue({ candidates: [candidate, { ...candidate, lineId: "2", article: "Bohne" }, { ...candidate, lineId: "3", article: "Reis" }] });
  const apply = vi.fn();
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: apply, onInvalidate: vi.fn() })));
  await selectFile(label("E-Rechnung (XML)").querySelector("input")!, fileWithContent("invoice.xml", "test"));
  const setInput = async (input: HTMLInputElement, value: string) => { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); };
  for (const [index, article] of ["Testware", "Bohne", "Reis"].entries()) {
    if (index) await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Weiteren Ansatz hinzufügen")!.click());
    const row = Array.from(document.querySelectorAll("fieldset")).find(f => f.querySelector("legend")?.textContent === `Ansatz ${index + 1}`)!;
    await act(async () => Array.from(row.querySelectorAll("button")).find(b => b.textContent?.includes(article + " ·"))!.click());
    const used = Array.from(row.querySelectorAll("label")).find(l => l.textContent?.startsWith("Benötigte Menge"))!.querySelector("input")!;
    await setInput(used, "1");
  }
  await act(async () => label("Alle direkten Kosten").querySelector("input")!.click());
  const transfer = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Kostensumme als Schätzung übernehmen")!;
  expect(transfer.disabled).toBe(false);
  await act(async () => transfer.click());
  expect(apply).toHaveBeenCalledOnce();
  for (const article of ["Testware", "Bohne", "Reis"]) expect(apply.mock.calls[0]![1]).toContain(article);
  await setInput(label("Quelle oder Schätzgrund").querySelector("input")!, "x".repeat(500));
  expect(document.body.textContent).toContain("Quellenhinweise sind zu lang");
  expect(transfer.disabled).toBe(true);
  await act(async () => root.unmount());
});

it.each([["LTR", "l"], ["C62", "Stück"], ["KGM", "kg"]])("preserves already normalized unit %s as %s", async (_code, unit) => {
  preview.mockResolvedValue({ candidates: [{ ...candidate, unit }] });
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: vi.fn(), onInvalidate: vi.fn() })));
  await selectFile(label("E-Rechnung (XML)").querySelector("input")!, fileWithContent("invoice.xml", "test"));
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("INV-1"))!.click());
  expect(label("Einheit für beide Mengen").querySelector("select")!.value).toBe(unit);
  await act(async () => root.unmount());
});
