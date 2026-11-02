// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { IngredientCostHelper } from "../backoffice-ui/src/ingredient-cost-helper.js";
import { ApiResponseError, previewSupplierInvoice } from "../backoffice-ui/src/api.js";

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
  await selectFile(label("UBL-XML-Datei").querySelector("input")!, fileWithContent("invoice.xml", "<test/>"));
  expect(preview).toHaveBeenCalledWith("<test/>");
  expect(label("Menge im Preisbezug").querySelector("input")!.value).toBe("");
  const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("INV-1"))!;
  expect(button.textContent).toContain("ungeprüft");
  expect(button.textContent).toContain("2.5 kg");
  await act(async () => button.click());
  expect(label("Menge im Preisbezug").querySelector("input")!.value).toBe("2.5");
  expect(label("Einheit für beide Mengen").querySelector("select")!.value).toBe("kg");
  expect(label("Preis des Preisbezugs netto").querySelector("input")!.value).toBe("10.00");
  expect(document.body.textContent).toContain("Testlieferant, Beleg INV-1 vom 2026-10-01, Position 1: 2.5 kg, 10.00 € netto; ungeprüft");
  expect(apply).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
it("reports a rejected legacy session and never sends an obsolete file", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: vi.fn(), onInvalidate: vi.fn() })));
  const input = label("UBL-XML-Datei").querySelector("input")!;
  let finish!: (buffer: ArrayBuffer) => void;
  const old = new File(["old"], "old.xml");
  Object.defineProperty(old, "arrayBuffer", { value: () => new Promise(resolve => { finish = resolve; }) });
  await selectFile(input, old);
  preview.mockRejectedValue(new ApiResponseError("not allowed", 403));
  await selectFile(input, fileWithContent("new.xml", "new"));
  await act(async () => finish(new TextEncoder().encode("old").buffer));
  expect(preview).toHaveBeenCalledTimes(1);
  expect(preview).toHaveBeenCalledWith("new");
  expect(document.body.textContent).toContain("persönliche Anmeldung");
  await act(async () => root.unmount());
});

it.each(["price", "reference", "unit"])("keeps a changed invoice %s marked after editing the source and on transfer", async (field) => {
  preview.mockResolvedValue({ candidates: [candidate] });
  const apply = vi.fn();
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(createElement(IngredientCostHelper, { onApply: apply, onInvalidate: vi.fn() })));
  await selectFile(label("UBL-XML-Datei").querySelector("input")!, fileWithContent("invoice.xml", "<test/>"));
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("INV-1"))!.click());
  const set = async (title: string, value: string) => {
    const input = label(title).querySelector("input")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  if (field === "price") await set("Preis des Preisbezugs netto", "11");
  if (field === "reference") await set("Menge im Preisbezug", "3");
  if (field === "unit") {
    const select = label("Einheit für beide Mengen").querySelector("select")!;
    await act(async () => { select.value = "g"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  }
  await set("Quelle oder Schätzgrund", "Manuell bearbeitete Quelle");
  expect(document.body.textContent).toContain("Rechnungsbezug, Einheit oder Preis wurden manuell geändert");
  await set("Benötigte Menge", "1");
  await act(async () => label("Alle direkten Kosten").querySelector("input")!.click());
  await act(async () => Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Kostensumme als Schätzung übernehmen")!.click());
  expect(apply).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("Rechnungsbezug, Einheit oder Preis manuell geändert"));
  expect(apply).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("Testlieferant, Beleg INV-1 vom 2026-10-01, Position 1: 2.5 kg, 10.00 EUR netto; ungeprüft"));
  await act(async () => root.unmount());
});
