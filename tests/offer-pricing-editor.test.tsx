// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfferPricingEditor } from "../backoffice-ui/src/offer-pricing-editor.js";
import { reviseOfferPricing } from "../backoffice-ui/src/api.js";
import { calculateOfferPricing } from "../shared-core/src/offer-calculation.js";
vi.mock("../backoffice-ui/src/api.js", () => ({ reviseOfferPricing: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ""; });

const input = [{ id: "food", label: "Speisenpaket", category: "food", quantity: "100", unit: "guest",
  unitNetCents: 5800, taxRateBps: 1900, sourceKind: "synthetic", sourceReference: "SYNTHETISCHER-100-GAESTE-TEST" }];
const summary = calculateOfferPricing({ lines: input }, 100);
const button = (label: string) => Array.from(document.querySelectorAll("button")).find(x => x.textContent === label)!;
const field = (label: string) => Array.from(document.querySelectorAll("label")).find(x => x.textContent?.startsWith(label))!.querySelector("input")!;
async function change(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function mount() {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  const saved = vi.fn(async (_id: string) => undefined), editing = vi.fn();
  await act(async () => root.render(createElement(OfferPricingEditor, {
    draftId: "draft-a", revision: 1, variants: [{ variantId: "calculated", label: "Geprüfte Testfassung", guests: 100 }],
    menuPlan: [{ label: "Hähnchenragout", servings: 55 }, { label: "Gemüsebratlinge", servings: 25 }, { label: "Linsenragout", servings: 20 }],
    pricingSummary: summary, disabled: false, onSaved: saved, onEditingChange: editing
  })));
  return { root, saved, editing };
}
describe("offer pricing editor", () => {
  it("retains synthetic provenance, missing tax, user edits on conflict and retries without duplicate submit", async () => {
    const { root, saved } = await mount();
    expect(document.body.textContent).toContain("Enthält synthetische Testannahmen");
    await act(async () => button("Preisaufstellung bearbeiten").click());
    await change(field("Einzelpreis netto"), "58,25");
    await change(field("Steuerfestlegung"), "");
    expect(document.body.textContent).toContain("Brutto bleibt offen");
    vi.mocked(reviseOfferPricing).mockRejectedValueOnce(new Error("Der Auftrag wurde inzwischen bearbeitet."));
    await act(async () => button("Preisaufstellung als neue Fassung speichern").click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("inzwischen bearbeitet");
    expect(field("Einzelpreis netto").value).toBe("58,25");
    expect(saved).not.toHaveBeenCalled();
    let finish!: (value: any) => void;
    vi.mocked(reviseOfferPricing).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await act(async () => {
      button("Preisaufstellung als neue Fassung speichern").click();
      button("Preisaufstellung als neue Fassung speichern").click();
    });
    expect(reviseOfferPricing).toHaveBeenCalledTimes(2);
    expect(reviseOfferPricing).toHaveBeenLastCalledWith("draft-a", 1, "calculated",
      [expect.objectContaining({ quantity: "100", unitNetCents: 5825, sourceKind: "synthetic" })]);
    expect((vi.mocked(reviseOfferPricing).mock.calls[1]![3]![0] as any).taxRateBps).toBeUndefined();
    await act(async () => finish({ draftId: "draft-b" }));
    expect(saved).toHaveBeenCalledExactlyOnceWith("draft-b");
    await act(async () => root.unmount());
  });
  it("discards a delayed save response after leaving its editor", async () => {
    const { root, saved } = await mount();
    let finish!: (value: any) => void;
    vi.mocked(reviseOfferPricing).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await act(async () => button("Preisaufstellung bearbeiten").click());
    await act(async () => button("Preisaufstellung als neue Fassung speichern").click());
    await act(async () => root.unmount());
    await act(async () => finish({ draftId: "old-case-revised" }));
    expect(saved).not.toHaveBeenCalled();
  });
});
