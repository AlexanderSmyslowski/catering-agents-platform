// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";
import { adminSessionResponse } from "./support/catering-session-ui-fixture.js";

const roots: Array<ReturnType<typeof createRoot>> = [];

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setup(options: { draft?: boolean; staleAfterSave?: boolean; sessionStorageBlocked?: boolean; sessionStorageReadOnly?: boolean } = {}) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
  });
  const sessionValues = new Map<string, string>();
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        if (options.sessionStorageBlocked) throw new Error("storage blocked");
        return sessionValues.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (options.sessionStorageBlocked || options.sessionStorageReadOnly) throw new Error("storage blocked");
        sessionValues.set(key, String(value));
      },
      removeItem: (key: string) => {
        if (options.sessionStorageBlocked) throw new Error("storage blocked");
        sessionValues.delete(key);
      }
    }
  });
  let userId = "test-admin";
  let missing = false;
  let invalid = false;
  let delayCaseA = false;
  let finishCaseA: (() => void) | undefined;
  let delayCaseB = false;
  let finishCaseB: (() => void) | undefined;
  let currentDraftId = "draft-a";
  let revealSavedDraft = !options.staleAfterSave;
  let syntheticEvents: unknown[] = [];
  const calls: string[] = [];
  const item = {
    caseId: "case-a",
    product: "offer",
    displayName: "Synthetischer Auftrag",
    status: "open",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z"
  };
  const secondItem = { ...item, caseId: "case-b", displayName: "Synthetischer Auftrag B" };
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/api/offers/v1/offers/drafts/draft-a/menu") && init?.method === "POST") {
      currentDraftId = "draft-new";
      return Response.json({ draftId: currentDraftId });
    }
    if (url.endsWith("/api/intake/v1/auth/session")) {
      const session = await adminSessionResponse().json();
      return Response.json({ ...session, user: { ...session.user, userId } });
    }
    if (url.endsWith("/api/offers/health")) {
      return Response.json({ service: "offer-service", status: "ok", timestamp: "", counts: {} });
    }
    if (url.endsWith("/api/offers/v1/offers/cases")) return Response.json({ items: [item, secondItem] });
    if (url.endsWith("/api/offers/v1/offers/cases/case-b")) {
      const response = () => Response.json({ case: { ...secondItem, schemaVersion: "1.0", businessId: "local", version: 1 }, events: [] });
      if (delayCaseB) return new Promise<Response>((resolve) => { finishCaseB = () => resolve(response()); });
      return response();
    }
    if (url.endsWith("/api/offers/v1/offers/cases/case-a")) {
      if (missing) return Response.json({ error: "not found" }, { status: 404 });
      const servedDraftId = revealSavedDraft ? currentDraftId : "draft-a";
      const currentDraft = options.draft ? {
        schemaVersion: "1.0", businessId: "local", draftId: servedDraftId, revision: servedDraftId === "draft-a" ? 1 : 2,
        eventSummary: "Synthetischer Auftrag", serviceModules: [], pricingSummary: {}, assumptions: [], openQuestions: [],
        variantSet: [{ variantId: "classic", label: "Klassisch" }], customerFacingText: "", internalWorkingText: "",
        proposedEventSpec: { specId: "", readiness: { status: "complete" }, menuPlan: [{ label: "Synthetisches Gericht", servings: 55 }] }
      } : undefined;
      const response = () => Response.json({ case: { ...item, caseId: invalid ? "wrong-id" : item.caseId, schemaVersion: "1.0", businessId: "local", version: 1 }, events: syntheticEvents, currentDraft });
      if (delayCaseA) return new Promise<Response>((resolve) => { finishCaseA = () => resolve(response()); });
      return response();
    }
    return Response.json({ items: [] });
  }));

  const container = document.createElement("div");
  document.body.append(container);
  const mount = async () => {
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(createElement(App));
      await flush();
    });
    return root;
  };
  return {
    calls, container, mount, sessionValues,
    changeUser: (next: string) => { userId = next; },
    removeCase: () => { missing = true; },
    restoreCase: () => { missing = false; },
    revealSavedDraft: () => { revealSavedDraft = true; },
    advanceToNewerDraft: (includeForeignEvent = false) => {
      revealSavedDraft = true;
      currentDraftId = "draft-later";
      const event = (id: string, sequence: number) => ({
        businessId: "local", eventId: "event-" + id, caseId: "case-a", sequence,
        at: "2026-10-27T00:00:00Z", role: "assistant", kind: "draft_created", text: "", artifactId: id,
        revisionRef: { artifactType: "OfferDraft", artifactId: id, revision: 2, createdAt: "2026-10-27T00:00:00Z" }
      });
      syntheticEvents = [
        event("draft-new", 2), event("draft-later", 3),
        ...(includeForeignEvent ? [{ ...event("foreign-draft", 4), caseId: "case-b" }] : [])
      ];
    },
    deferCaseA: () => { delayCaseA = true; },
    resolveCaseA: () => { expect(finishCaseA).toBeDefined(); delayCaseA = false; finishCaseA!(); },
    deferCaseB: () => { delayCaseB = true; },
    resolveCaseB: () => { expect(finishCaseB).toBeDefined(); finishCaseB!(); },
    invalidateCase: () => { invalid = true; }
  };
}

async function openCase(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>("button[data-action='open-case']");
  expect(button).not.toBeNull();
  await act(async () => {
    button!.click();
    await flush();
  });
  expect(container.querySelector('[aria-label="Geöffneter Auftrag"] h2')?.textContent).toBe("Synthetischer Auftrag");
}

describe("Angebotsauftrag nach Neuladen", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) act(() => root.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("guards leaving while the menu editor is open and removes the guard on cancel or unmount", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount } = setup({ draft: true });
    const root = await mount();
    await openCase(container);
    const leaving = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const button = (label: string) => Array.from(container.querySelectorAll("button")).find(b => b.textContent === label)!;
    expect(leaving()).toBe(false);
    await act(async () => { button("Menü bearbeiten").click(); await flush(); });
    expect(leaving()).toBe(true);
    await act(async () => { button("Abbrechen").click(); await flush(); });
    expect(leaving()).toBe(false);
    await act(async () => { button("Menü bearbeiten").click(); await flush(); });
    expect(leaving()).toBe(true);
    await act(async () => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(leaving()).toBe(false);
  });

  it("removes the leave guard after saving and loading the new menu", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount } = setup({ draft: true });
    await mount();
    await openCase(container);
    const button = (label: string) => Array.from(container.querySelectorAll("button")).find(b => b.textContent === label)!;
    await act(async () => { button("Menü bearbeiten").click(); await flush(); });
    await act(async () => { button("Menü als neue Fassung speichern").click(); await flush(); });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("opens the previously selected offer again after a page reload for the same user", async () => {
    window.history.replaceState({ existingContext: "preserve" }, "", "/angebot");
    const { container, mount } = setup();
    const first = await mount();
    await openCase(container);
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    await mount();
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"] h2')?.textContent).toBe("Synthetischer Auftrag");
    expect(window.history.state.existingContext).toBe("preserve");
  });

  it("offers a safe return to the list if the remembered case cannot be loaded", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, removeCase } = setup();
    const first = await mount();
    await openCase(container);
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    removeCase();
    await mount();
    const returnButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Zur Auftragsübersicht");
    expect(returnButton).toBeDefined();
    await act(async () => {
      returnButton!.click();
      await flush();
    });
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')).toBeNull();
    expect(container.textContent).toContain("Bestehenden Auftrag öffnen");
    expect(window.history.state["catering.offerCaseFocus"]).toBeUndefined();
  });

  it("shows a way back if a loaded case has the wrong identity", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, invalidateCase } = setup({ draft: true });
    const first = await mount();
    await openCase(container);
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    invalidateCase();
    await mount();
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')?.textContent)
      .toContain("Der Auftrag konnte nicht geladen werden");
    expect(container.querySelector('a[href*="/drafts/"][href*="/html"]')).toBeNull();
    expect(Array.from(container.querySelectorAll("button")).filter(button => /freigeben/i.test(button.textContent ?? "")).every(button => button.disabled)).toBe(true);
    const returnButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Zur Auftragsübersicht");
    expect(returnButton).toBeDefined();
    await act(async () => { returnButton!.click(); await flush(); });
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')).toBeNull();
  });

  it("remembers the most recently opened case when the operator switches", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount } = setup();
    const first = await mount();
    await openCase(container);
    const summary = container.querySelector<HTMLElement>("#history summary")!;
    await act(async () => { summary.click(); await flush(); });
    const buttons = container.querySelectorAll<HTMLButtonElement>("button[data-action='open-case']");
    await act(async () => { buttons[1].click(); await flush(); });
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"] h2')?.textContent).toBe("Synthetischer Auftrag B");
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    await mount();
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"] h2')?.textContent).toBe("Synthetischer Auftrag B");
  });

  it("can retry an unavailable case without losing text typed in the meantime", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, removeCase, restoreCase } = setup();
    const first = await mount();
    await openCase(container);
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    removeCase();
    await mount();
    const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Kundenanfrage als Text"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Nicht gesendeter Text");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    const submit = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Entwurf aus Text erstellen"))!;
    expect(submit.disabled).toBe(true);
    expect(container.querySelector('[data-testid="case-next-action-bar"]')).toBeNull();
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Zur Auftragsübersicht")!.click();
      await flush();
    });
    expect(container.textContent).toContain("Der Auftrag ist nicht verfügbar.");
    restoreCase();
    const retry = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Erneut versuchen");
    expect(retry).toBeDefined();
    await act(async () => { retry!.click(); await flush(); });
    expect(input.value).toBe("Nicht gesendeter Text");
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')?.textContent).not.toContain("konnte nicht geladen werden");
    expect(container.textContent).not.toContain("Der Auftrag ist nicht verfügbar.");
    expect(submit.disabled).toBe(false);
  });

  it("does not say a still-loading case is unavailable when protecting typed input", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, deferCaseB, resolveCaseB } = setup();
    await mount();
    await openCase(container);
    deferCaseB();
    const summary = container.querySelector<HTMLElement>("#history summary")!;
    await act(async () => { summary.click(); await flush(); });
    const buttons = container.querySelectorAll<HTMLButtonElement>("button[data-action='open-case']");
    await act(async () => { buttons[1].click(); await flush(); });
    const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Kundenanfrage als Text"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Nicht gesendeter Text");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await act(async () => { summary.click(); await flush(); });
    const firstCase = container.querySelector<HTMLButtonElement>("button[data-action='open-case']")!;
    await act(async () => { firstCase.click(); await flush(); });
    expect(container.textContent).not.toContain("Der Auftrag ist nicht verfügbar.");
    expect(container.textContent).toContain("Der Auftrag wird noch geladen.");
    await act(async () => { resolveCaseB(); await flush(); });
    expect(input.value).toBe("Nicht gesendeter Text");
    expect(container.textContent).not.toContain("Der Auftrag wird noch geladen.");
  });

  it("distinguishes a refresh failure from a case that was never loaded", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, removeCase, restoreCase, deferCaseA, resolveCaseA, calls } = setup();
    await mount();
    await openCase(container);
    removeCase();
    const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Kundenanfrage als Text"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Synthetische Anfrage");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    const submit = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Entwurf aus Text erstellen"))!;
    await act(async () => { submit.click(); await flush(); });
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')?.textContent).toContain("Auftragsdaten konnten nicht aktualisiert werden");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Ungesendete Ergänzung");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    const nextAction = container.querySelector<HTMLButtonElement>('[data-action="case-next-action"]')!;
    expect(nextAction.disabled).toBe(true);
    expect(container.querySelector('[data-testid="case-next-action-bar"]')?.textContent).toContain("Zuerst Auftragsdaten erneut laden.");
    expect(submit.disabled).toBe(true);
    const before = calls.filter(url => url.endsWith("/api/offers/v1/offers/from-text")).length;
    await act(async () => { submit.click(); await flush(); });
    expect(calls.filter(url => url.endsWith("/api/offers/v1/offers/from-text"))).toHaveLength(before);

    restoreCase();
    deferCaseA();
    const retry = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Erneut versuchen")!;
    await act(async () => { retry.click(); await flush(); });
    expect(submit.disabled).toBe(true);
    expect(input.value).toBe("Ungesendete Ergänzung");
    await act(async () => { resolveCaseA(); await flush(); });
    expect(input.value).toBe("Ungesendete Ergänzung");
    expect(submit.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('[data-action="case-next-action"]')?.disabled).toBe(false);
  });

  it("keeps edited menu inputs and prevents another save after the saved draft cannot refresh", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, removeCase, restoreCase } = setup({ draft: true });
    await mount();
    await openCase(container);
    const menu = container.querySelector<HTMLElement>('[aria-label="Menü und Portionszahlen"]')!;
    const begin = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü bearbeiten")!;
    await act(async () => { begin.click(); await flush(); });
    const input = menu.querySelector<HTMLInputElement>('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Synthetische Änderung");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    removeCase();
    const save = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü als neue Fassung speichern")!;
    await act(async () => { save.click(); await flush(); });
    expect(input.value).toBe("Synthetische Änderung");
    expect(input.disabled).toBe(true);
    expect(menu.textContent).toContain("Die neue Fassung wurde gespeichert");
    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    expect(Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü als neue Fassung speichern")).toBeUndefined();
    const retry = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Erneut versuchen")!;
    expect(retry.disabled).toBe(true);
    expect(container.textContent).toContain("Die Bearbeitung ist geöffnet");
    const close = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Bearbeitung schließen")!;
    expect(close.disabled).toBe(false);
    await act(async () => { close.click(); await flush(); });
    expect(retry.disabled).toBe(false);
    restoreCase();
    await act(async () => { retry.click(); await flush(); });
    expect(container.textContent).not.toContain("Auftragsdaten konnten nicht aktualisiert werden");
    expect(container.querySelector('a[href*="draft-new/html"]')).not.toBeNull();
  });

  it("keeps the older draft blocked after closing a saved edit until its new draft is loaded", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, revealSavedDraft, calls } = setup({ draft: true, staleAfterSave: true });
    await mount();
    await openCase(container);
    const menu = container.querySelector<HTMLElement>('[aria-label="Menü und Portionszahlen"]')!;
    const begin = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü bearbeiten")!;
    await act(async () => { begin.click(); await flush(); });
    const save = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü als neue Fassung speichern")!;
    await act(async () => { save.click(); await flush(); });
    expect(menu.textContent).toContain("Die neue Fassung wurde gespeichert");

    const close = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Bearbeitung schließen")!;
    await act(async () => { close.click(); await flush(); });
    const retry = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Erneut versuchen")!;
    await act(async () => { retry.click(); await flush(); });
    expect(container.querySelector('a[href*="draft-a/html"]')).toBeNull();
    expect(container.querySelector<HTMLButtonElement>('[data-action="case-next-action"]')?.disabled).toBe(true);

    revealSavedDraft();
    const retryAgain = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Erneut versuchen")!;
    await act(async () => { retryAgain.click(); await flush(); });
    expect(container.querySelector('a[href*="draft-new/html"]')).not.toBeNull();
    expect(calls.filter(url => url.endsWith("/api/offers/v1/offers/drafts/draft-a/menu"))).toHaveLength(1);
  });

  it("keeps a saved but not yet loaded draft protected after the offer page is reopened", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, revealSavedDraft, calls, sessionValues } = setup({ draft: true, staleAfterSave: true });
    const first = await mount();
    await openCase(container);
    const menu = container.querySelector<HTMLElement>('[aria-label="Menü und Portionszahlen"]')!;
    const begin = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü bearbeiten")!;
    await act(async () => { begin.click(); await flush(); });
    const save = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü als neue Fassung speichern")!;
    await act(async () => { save.click(); await flush(); });
    expect(menu.textContent).toContain("Die neue Fassung wurde gespeichert");
    expect(Array.from(sessionValues.values())).toContain("draft-new");
    const close = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Bearbeitung schließen")!;
    await act(async () => { close.click(); await flush(); });

    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    await mount();
    expect(container.querySelector('a[href*="draft-a/html"]')).toBeNull();
    expect(container.textContent).toContain("konnte nicht geladen werden");

    revealSavedDraft();
    const retry = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Erneut versuchen")!;
    await act(async () => { retry.click(); await flush(); });
    expect(container.querySelector('a[href*="draft-new/html"]')).not.toBeNull();
    expect(calls.filter(url => url.endsWith("/api/offers/v1/offers/drafts/draft-a/menu"))).toHaveLength(1);
    expect(Array.from(sessionValues.values())).not.toContain("draft-new");
  });


  it("asks to inspect the current draft when the saved draft was superseded", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, advanceToNewerDraft, calls, sessionValues } = setup({ draft: true, staleAfterSave: true });
    await mount(); await openCase(container);
    const menu = container.querySelector<HTMLElement>('[aria-label="Menü und Portionszahlen"]')!;
    await act(async () => { Array.from(menu.querySelectorAll("button")).find(b => b.textContent === "Menü bearbeiten")!.click(); await flush(); });
    await act(async () => { Array.from(menu.querySelectorAll("button")).find(b => b.textContent === "Menü als neue Fassung speichern")!.click(); await flush(); });
    await act(async () => { Array.from(menu.querySelectorAll("button")).find(b => b.textContent === "Bearbeitung schließen")!.click(); await flush(); });
    advanceToNewerDraft();
    await act(async () => { Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Erneut versuchen")!.click(); await flush(); });
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')?.textContent).toContain("Auftrag wurde danach verändert");
    expect(container.querySelector('a[href*="draft-a/html"]')).toBeNull();
    expect(container.querySelector('a[href*="draft-later/html"]')).toBeNull();
    expect(Array.from(sessionValues.values())).toContain("draft-new");
    const inspect = Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Aktuelle Fassung prüfen");
    expect(inspect).toBeDefined();
    await act(async () => { inspect!.click(); await flush(); });
    expect(container.querySelector('a[href*="draft-later/html"]')).not.toBeNull();
    expect(Array.from(sessionValues.values())).not.toContain("draft-new");
    expect(calls.filter(url => url.endsWith("/api/offers/v1/offers/drafts/draft-a/menu"))).toHaveLength(1);
  });

  it("keeps the marker if the real loader receives events from another case", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, advanceToNewerDraft, sessionValues } = setup({ draft: true, staleAfterSave: true });
    await mount(); await openCase(container);
    const menu = container.querySelector<HTMLElement>('[aria-label="Menü und Portionszahlen"]')!;
    await act(async () => { Array.from(menu.querySelectorAll("button")).find(b => b.textContent === "Menü bearbeiten")!.click(); await flush(); });
    await act(async () => { Array.from(menu.querySelectorAll("button")).find(b => b.textContent === "Menü als neue Fassung speichern")!.click(); await flush(); });
    await act(async () => { Array.from(menu.querySelectorAll("button")).find(b => b.textContent === "Bearbeitung schließen")!.click(); await flush(); });
    advanceToNewerDraft(true);
    await act(async () => { Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Erneut versuchen")!.click(); await flush(); });
    expect(Array.from(container.querySelectorAll("button")).some(b => b.textContent === "Aktuelle Fassung prüfen")).toBe(false);
    expect(container.querySelector('a[href*="draft-later/html"]')).toBeNull();
    expect(Array.from(sessionValues.values())).toContain("draft-new");
  });

  it("does not use another user's saved-draft marker after switching accounts", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, changeUser } = setup({ draft: true, staleAfterSave: true });
    const first = await mount();
    await openCase(container);
    const menu = container.querySelector<HTMLElement>('[aria-label="Menü und Portionszahlen"]')!;
    await act(async () => {
      Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü bearbeiten")!.click();
      await flush();
    });
    await act(async () => {
      Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Menü als neue Fassung speichern")!.click();
      await flush();
    });
    expect(menu.textContent).toContain("Die neue Fassung wurde gespeichert");
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);

    changeUser("another-test-admin");
    await mount();
    await openCase(container);
    expect(container.querySelector('a[href*="draft-a/html"]')).not.toBeNull();
  });

  it("does not present an offer as safe when its recovery storage is unavailable", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount } = setup({ draft: true, sessionStorageBlocked: true });
    await mount();
    await openCase(container);
    expect(container.querySelector('a[href*="draft-a/html"]')).toBeNull();
    expect(container.textContent).toContain("gespeicherte Angebotsstand");
  });

  it("blocks offer actions when recovery storage can be read but cannot be written", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount } = setup({ draft: true, sessionStorageReadOnly: true });
    await mount();
    await openCase(container);
    expect(container.querySelector('a[href*="draft-a/html"]')).toBeNull();
    expect(container.textContent).toContain("gespeicherte Angebotsstand");
  });

  it("does not discard unsent input when returning from an unavailable case", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, removeCase } = setup();
    const first = await mount();
    await openCase(container);
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    removeCase();
    await mount();
    const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Kundenanfrage als Text"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Nicht gesendeter Text");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Zur Auftragsübersicht")!.click();
      await flush();
    });
    expect(input.value).toBe("Nicht gesendeter Text");
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')).not.toBeNull();
    expect(container.textContent).toContain("Text kopieren oder über „Eingabefelder leeren“ verwerfen");
  });

  it("keeps the current workflow usable when the browser refuses history updates", async () => {
    window.history.replaceState({}, "", "/angebot");
    vi.spyOn(window.history, "replaceState").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    const { container, mount } = setup();
    await mount();
    await openCase(container);
  });

  it("does not restore another user's previous case after signing in", async () => {
    window.history.replaceState({}, "", "/angebot");
    const { container, mount, changeUser, calls } = setup();
    const first = await mount();
    await openCase(container);
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    calls.length = 0;
    changeUser("different-user");
    await mount();
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')).toBeNull();
    expect(calls.some((url) => url.endsWith("/api/offers/v1/offers/cases/case-a"))).toBe(false);
  });
});
