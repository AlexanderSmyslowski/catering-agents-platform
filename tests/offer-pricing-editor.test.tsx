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
async function mount(pricingSummary = summary) {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  const saved = vi.fn(async (_id: string) => undefined), editing = vi.fn();
  await act(async () => root.render(createElement(OfferPricingEditor, {
    draftId: "draft-a", revision: 1, variants: [{ variantId: "calculated", label: "Geprüfte Testfassung", guests: 100 }],
    menuPlan: [{ label: "Hähnchenragout", servings: 55 }, { label: "Gemüsebratlinge", servings: 25 }, { label: "Linsenragout", servings: 20 }],
    pricingSummary, disabled: false, onSaved: saved, onEditingChange: editing
  })));
  return { root, saved, editing };
}
describe("offer pricing editor", () => {
  it("reads a future costed offer honestly and prevents an unsupported edit", async () => {
    const priced = calculateOfferPricing({ lines: [{ ...input[0], directCost: {
      totalNetCents: 185000, basis: "estimated", sourceReference: "SYNTHETISCHE INTERNE KOSTEN" }
    }] }, 100);
    const { root } = await mount(priced);
    expect(document.body.textContent).toContain("Interne Kosten sind gespeichert");
    expect(document.body.textContent).toContain("Daten bleiben erhalten");
    expect(button("Preisaufstellung bearbeiten").disabled).toBe(true);
    expect(document.body.textContent).not.toContain("1.850");
    await act(async () => root.unmount());
  });
  it("identifies the current operator-confirmed service rate next to its field", async () => {
    const { root } = await mount();
    await act(async () => button("Preisaufstellung bearbeiten").click());
    await act(async () => button("Servicepersonal – Personenstunden gesamt").click());
    const staff = Array.from(document.querySelectorAll("fieldset")).find(section => section.querySelector("legend")?.textContent?.includes("Servicepersonal"))!;
    const price = Array.from(staff.querySelectorAll("label")).find(label => label.textContent?.startsWith("Einzelpreis netto"))!.querySelector("input")!;
    expect(price.value).toBe("45.55");
    const hint = document.getElementById(price.getAttribute("aria-describedby")!);
    expect(hint?.textContent).toContain("45,55");
    expect(hint?.textContent).toContain("bestätigter aktueller Stundensatz");
    expect(document.body.textContent).not.toContain("historisch ungeklärt");
    await act(async () => root.unmount());
  });
  it.each([["42,02", 4202, "Manuell"], ["45,55", 4555, "Betreiberbestätigung vom 25.10.2026"]])("saves service rate %s with truthful provenance", async (entered, cents, source) => {
    const { root, saved } = await mount();
    await act(async () => button("Preisaufstellung bearbeiten").click());
    await act(async () => button("Servicepersonal – Personenstunden gesamt").click());
    const staff = Array.from(document.querySelectorAll("fieldset")).find(section => section.querySelector("legend")?.textContent?.includes("Servicepersonal"))!;
    const within = (name: string) => Array.from(staff.querySelectorAll("label")).find(label => label.textContent?.startsWith(name))!.querySelector("input")!;
    await change(within("Personenstunden"), "8");
    await change(within("Einzelpreis netto"), String(entered));
    vi.mocked(reviseOfferPricing).mockResolvedValueOnce({ draftId: "explicit-service-price" } as any);
    await act(async () => button("Preisaufstellung als neue Fassung speichern").click());
    expect(reviseOfferPricing).toHaveBeenCalledExactlyOnceWith("draft-a", 1, "calculated", expect.arrayContaining([
      expect.objectContaining({ id: "staff", quantity: "8", unitNetCents: cents, sourceKind: "operator", sourceReference: expect.stringContaining(String(source)) })
    ]));
    expect(saved).toHaveBeenCalledExactlyOnceWith("explicit-service-price");
    await act(async () => root.unmount());
  });
  it("does not reapply the operator confirmation after a changed service price returns to 45.55", async () => {
    const { root } = await mount();
    await act(async () => button("Preisaufstellung bearbeiten").click());
    await act(async () => button("Servicepersonal – Personenstunden gesamt").click());
    const staff = Array.from(document.querySelectorAll("fieldset")).find(section => section.querySelector("legend")?.textContent?.includes("Servicepersonal"))!;
    const within = (name: string) => Array.from(staff.querySelectorAll("label")).find(label => label.textContent?.startsWith(name))!.querySelector("input")!;
    await change(within("Einzelpreis netto"), "50,00");
    expect(within("Quellenreferenz").value).toContain("Manuell");
    expect(within("Quellenreferenz").value).not.toContain("Betreiberbestätigung");
    await change(within("Einzelpreis netto"), "45,55");
    expect(within("Quellenreferenz").value).toContain("Manuell");
    expect(within("Steuerfestlegung").value).toBe("");
    await act(async () => root.unmount());
  });
  it("withdraws the service confirmation even when the price source is temporarily changed", async () => {
    const { root } = await mount();
    await act(async () => button("Preisaufstellung bearbeiten").click());
    await act(async () => button("Servicepersonal – Personenstunden gesamt").click());
    const staff = Array.from(document.querySelectorAll("fieldset")).find(section => section.querySelector("legend")?.textContent?.includes("Servicepersonal"))!;
    const within = (name: string) => Array.from(staff.querySelectorAll("label")).find(label => label.textContent?.startsWith(name))!.querySelector("input")!;
    const source = staff.querySelector("select")!;
    await act(async () => { source.value = "app_transfer"; source.dispatchEvent(new Event("change", { bubbles: true })); });
    await change(within("Einzelpreis netto"), "50,00");
    await act(async () => { source.value = "operator"; source.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(within("Quellenreferenz").value).toContain("Manuell");
    expect(within("Einzelpreis netto").hasAttribute("aria-describedby")).toBe(false);
    await act(async () => root.unmount());
  });
  it.each([4202, 4555])("preserves an existing stored service rate of %i cents on edit", async cents => {
    const priced = calculateOfferPricing({ lines: [
      ...input,
      { ...input[0]!, id: "staff", label: "Servicepersonal", category: "staff", quantity: "8", unit: "hour", unitNetCents: cents }
    ] }, 100);
    const { root } = await mount(priced);
    await act(async () => button("Preisaufstellung bearbeiten").click());
    const staff = Array.from(document.querySelectorAll("fieldset")).find(section => section.querySelector("legend")?.textContent?.includes("Servicepersonal"))!;
    const price = Array.from(staff.querySelectorAll("label")).find(label => label.textContent?.startsWith("Einzelpreis netto"))!.querySelector("input")!;
    expect(price.value).toBe((cents / 100).toFixed(2));
    const source = Array.from(staff.querySelectorAll("label")).find(label => label.textContent?.startsWith("Quellenreferenz"))!.querySelector("input")!;
    expect(source.value).toBe("SYNTHETISCHER-100-GAESTE-TEST");
    expect(price.hasAttribute("aria-describedby")).toBe(false);
    await act(async () => root.unmount());
  });
  it("retains the independent delivery working value and leaves tax unselected", async () => {
    const { root } = await mount();
    await act(async () => button("Preisaufstellung bearbeiten").click());
    await act(async () => button("Lieferung & Abholung").click());
    const delivery = Array.from(document.querySelectorAll("fieldset")).find(section => section.querySelector("legend")?.textContent?.includes("Lieferung"))!;
    const within = (name: string) => Array.from(delivery.querySelectorAll("label")).find(label => label.textContent?.startsWith(name))!.querySelector("input")!;
    expect(within("Einzelpreis netto").value).toBe("150.00");
    expect(within("Steuerfestlegung").value).toBe("");
    await act(async () => root.unmount());
  });
  it("uses singular labels for one flat-rate item and keeps plural quantities", async () => {
    const priced = calculateOfferPricing({ lines: [
      ...input,
      { ...input[0]!, id: "delivery", label: "Anlieferung", quantity: "1", unit: "flat" },
      { ...input[0]!, id: "staff", label: "Service", quantity: "24", unit: "hour" }
    ] }, 100);
    const { root } = await mount(priced);
    expect(document.body.textContent).toContain("1 Pauschale");
    expect(document.body.textContent).not.toContain("1 Pauschalen");
    expect(document.body.textContent).toContain("24 Personenstunden");
    await act(async () => root.unmount());
  });
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
