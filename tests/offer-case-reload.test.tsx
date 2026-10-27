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

function setup() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
  });
  let userId = "test-admin";
  let missing = false;
  let invalid = false;
  let delayCaseB = false;
  let finishCaseB: (() => void) | undefined;
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
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
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
      return Response.json({ case: { ...item, caseId: invalid ? "wrong-id" : item.caseId, schemaVersion: "1.0", businessId: "local", version: 1 }, events: [] });
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
    calls, container, mount,
    changeUser: (next: string) => { userId = next; },
    removeCase: () => { missing = true; },
    restoreCase: () => { missing = false; },
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
    const { container, mount, invalidateCase } = setup();
    const first = await mount();
    await openCase(container);
    await act(async () => first.unmount());
    roots.splice(roots.indexOf(first), 1);
    invalidateCase();
    await mount();
    expect(container.querySelector('[aria-label="Geöffneter Auftrag"]')?.textContent)
      .toContain("Der Auftrag konnte nicht geladen werden");
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
    const { container, mount, removeCase } = setup();
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
