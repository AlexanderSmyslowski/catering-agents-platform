// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";
import { OfferEventEditor } from "../backoffice-ui/src/offer-event-editor.js";
import { reviseOfferMenu } from "../backoffice-ui/src/api.js";
vi.mock("../backoffice-ui/src/api.js", () => ({ reviseOfferMenu: vi.fn() }));
const spec = normalizeEventRequestToSpec(createEventRequestFromText({requestId:"synthetic-editor",channel:"text",rawText:"SYNTHETISCH: Abendbuffet für 100 Gäste am 12.11.2026. 55 Portionen Hähnchen, 25 Portionen Bratlinge, 20 Portionen Linsenragout."}));
spec.event.schedule = [{label:"Empfang",start:"18:00",end:"19:00"}];
let root: Root;
let container: HTMLDivElement;
const onSaved = vi.fn(async (_id: string) => undefined);
const onEditingChange = vi.fn();
async function mount(draftId = "original") {
  if (!container) { container = document.createElement("div"); document.body.append(container); root = createRoot(container); }
  await act(async () => root.render(createElement(OfferEventEditor, {draftId, revision:1, spec, disabled:false, onSaved, onEditingChange})));
}
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") ?? b.textContent) === label);
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); container = undefined!; vi.resetAllMocks(); });
describe("safe event editing", () => {
  it("focuses an incomplete added time slot and allows removing it without losing existing times", async () => {
    await mount(); await click("Veranstaltungsdaten bearbeiten"); await click("Zeitabschnitt ergänzen");
    await click("Änderungen speichern");
    expect(reviseOfferMenu).not.toHaveBeenCalled();
    const invalid = container.querySelector('[aria-invalid="true"]');
    expect(invalid).not.toBeNull(); expect(document.activeElement).toBe(invalid);
    await click("Zeitabschnitt 2 entfernen");
    vi.mocked(reviseOfferMenu).mockResolvedValue({draftId:"saved"} as never);
    await click("Änderungen speichern");
    expect(vi.mocked(reviseOfferMenu).mock.calls[0]![3]?.eventSchedule).toEqual(spec.event.schedule);
    await mount("saved");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Gespeichert");
    expect(container.textContent).toContain("12.11.2026");
    expect(container.textContent).toContain("Buffet");
  });
  it("sends explicit empty times and preserves entered data on a failed save", async () => {
    await mount(); await click("Veranstaltungsdaten bearbeiten"); await click("Zeitabschnitt 1 entfernen");
    vi.mocked(reviseOfferMenu).mockRejectedValue(new Error("Verbindung unterbrochen"));
    await click("Änderungen speichern");
    expect(vi.mocked(reviseOfferMenu).mock.calls[0]![3]?.eventSchedule).toEqual([]);
    expect(container.textContent).toContain("Speichern nicht bestätigt");
    expect(container.textContent).toContain("Verbindung unterbrochen");
    expect(container.querySelector('input[type="number"]')?.getAttribute("value")).toBe("100");
    expect(container.querySelector('input[type="time"]')).toBeNull();
  });
  it("stores a selected German event label as its existing key", async () => {
    await mount();await click("Veranstaltungsdaten bearbeiten");
    const input=container.querySelector('input[list]') as HTMLInputElement;
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"Konferenz");input.dispatchEvent(new Event("input",{bubbles:true}));});
    vi.mocked(reviseOfferMenu).mockResolvedValue({draftId:"conference"} as never);
    await click("Änderungen speichern");
    expect(vi.mocked(reviseOfferMenu).mock.calls[0]![3]?.eventType).toBe("conference");
  });

});
