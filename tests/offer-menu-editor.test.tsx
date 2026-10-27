// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfferMenuEditor } from "../backoffice-ui/src/offer-menu-editor.js";
import { reviseOfferMenu } from "../backoffice-ui/src/api.js";
vi.mock("../backoffice-ui/src/api.js", () => ({ reviseOfferMenu: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ""; });

describe("offer menu editing", () => {
  it("does not switch a different case after the saving editor was unmounted", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    let finish!: (value: any) => void;
    vi.mocked(reviseOfferMenu).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const saved = vi.fn();
    await act(async () => root.render(createElement(OfferMenuEditor, {
      draftId: "old-case-draft", revision: 1, disabled: false,
      menuPlan: [{ label: "Hähnchenragout", servings: 55 }],
      onSaved: saved, onEditingChange: vi.fn()
    })));
    await act(async () => (Array.from(document.querySelectorAll("button")).find(x => x.textContent === "Menü bearbeiten")!).click());
    await act(async () => (Array.from(document.querySelectorAll("button")).find(x => x.textContent === "Menü als neue Fassung speichern")!).click());
    await act(async () => root.unmount());
    await act(async () => finish({ draftId: "old-case-revised-draft" }));
    expect(saved).not.toHaveBeenCalled();
  });

  it("reloads an already saved menu after a failed refresh without posting it again", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const saved = vi.fn().mockRejectedValueOnce(new Error("Synthetischer Verbindungsfehler")).mockResolvedValueOnce(undefined);
    const editing = vi.fn();
    vi.mocked(reviseOfferMenu).mockResolvedValue({ draftId: "saved-menu" } as any);
    await act(async () => root.render(createElement(OfferMenuEditor, {
      draftId: "original-draft", revision: 1, disabled: false,
      menuPlan: [{ label: "Synthetisches Gericht", servings: 55 }], onSaved: saved, onEditingChange: editing
    })));
    const button = (label: string) => Array.from(document.querySelectorAll("button")).find(x => x.textContent === label)!;
    await act(async () => button("Menü bearbeiten").click());
    await act(async () => button("Menü als neue Fassung speichern").click());
    expect(document.body.textContent).toContain("Die neue Fassung wurde gespeichert");
    expect((document.querySelector('input[type="number"]') as HTMLInputElement).disabled).toBe(true);
    expect(button("Menü als neue Fassung speichern")).toBeUndefined();
    await act(async () => button("Gespeicherte Fassung laden").click());
    expect(reviseOfferMenu).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls.map(args => args[0])).toEqual(["saved-menu", "saved-menu"]);
    expect(editing).toHaveBeenLastCalledWith(false);
    await act(async () => root.unmount());
  });

  it("allows closing an already saved menu without another write when loading keeps failing", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const saved = vi.fn().mockRejectedValue(new Error("Synthetischer Verbindungsfehler"));
    const editing = vi.fn();
    vi.mocked(reviseOfferMenu).mockResolvedValue({ draftId: "saved-menu" } as any);
    await act(async () => root.render(createElement(OfferMenuEditor, {
      draftId: "original-draft", revision: 1, disabled: false,
      menuPlan: [{ label: "Synthetisches Gericht", servings: 55 }], onSaved: saved, onEditingChange: editing
    })));
    const button = (label: string) => Array.from(document.querySelectorAll("button")).find(x => x.textContent === label)!;
    await act(async () => button("Menü bearbeiten").click());
    await act(async () => button("Menü als neue Fassung speichern").click());
    await act(async () => button("Gespeicherte Fassung laden").click());
    expect(reviseOfferMenu).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Fassung bleibt gespeichert");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Zugriff auf den Auftrag prüfen");
    expect(document.querySelector('[role="alert"]')?.textContent).not.toContain("Verbindung prüfen");
    await act(async () => button("Bearbeitung schließen").click());
    expect(editing).toHaveBeenLastCalledWith(false);
    expect(reviseOfferMenu).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Fassung bleibt gespeichert");
    await act(async () => root.unmount());
  });

  it("shows individual counts and saves them as a new draft without silent guest multiplication", async () => {
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const saved = vi.fn().mockResolvedValue(undefined);
    const editing = vi.fn();
    vi.mocked(reviseOfferMenu).mockResolvedValue({ draftId: "new-draft" } as any);
    await act(async () => root.render(createElement(OfferMenuEditor, {
      draftId: "original-draft", revision: 1, disabled: false,
      menuPlan: [{ componentId: "chicken", label: "Hähnchenragout", servings: 55, menuCategory: "classic" }, { componentId: "veg", label: "Gemüsebratlinge", servings: 25 }, { componentId: "vegan", label: "Linsenragout", servings: 20 }],
      onSaved: saved, onEditingChange: editing
    })));
    expect(document.body.textContent).toContain("55 Portionen · klassisch");
    await act(async () => (Array.from(document.querySelectorAll("button")).find(x => x.textContent === "Menü bearbeiten")!).click());
    expect(Array.from(document.querySelectorAll('input[type="number"]')).map(x => (x as HTMLInputElement).value)).toEqual(["55", "25", "20"]);
    await act(async () => (Array.from(document.querySelectorAll("button")).find(x => x.textContent === "Menü als neue Fassung speichern")!).click());
    expect(reviseOfferMenu).toHaveBeenCalledWith("original-draft", 1, expect.arrayContaining([expect.objectContaining({ label: "Hähnchenragout", servings: 55 }), expect.objectContaining({ servings: 25 }), expect.objectContaining({ servings: 20 })]));
    expect(saved).toHaveBeenCalledWith("new-draft");
    expect(editing).toHaveBeenLastCalledWith(false);
    await act(async () => root.unmount());
  });
});
