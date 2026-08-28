// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";
import {
  createAcceptedSpecFromDocument,
  createAcceptedSpecFromText,
  loadOfferCaseSummaries,
  uploadRecipeFile,
  uploadSourceDocument
} from "../backoffice-ui/src/api.js";
import { fetchProductionQuantityWorkflow } from "../backoffice-ui/src/production-quantity-api.js";

const roots: Root[] = [];
const storageWrites: Array<{ area: "local" | "session"; key: string; value: string }> = [];

const authenticatedSession = {
  authenticated: true,
  user: {
    userId: "user-anna",
    displayName: "Anna Beispiel"
  },
  access: {
    capabilities: ["offer", "production_read"]
  }
};

function installStorage(area: "local" | "session") {
  const values = new Map<string, string>();
  Object.defineProperty(window, area === "local" ? "localStorage" : "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
        storageWrites.push({ area, key, value });
      },
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear()
    }
  });
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function offerRouteResponse(url: string) {
  if (url.endsWith("/api/offers/v1/offers/cases")) {
    return jsonResponse({ items: [] });
  }
  if (url.endsWith("/api/offers/health")) {
    return jsonResponse({ service: "offers", status: "ok", timestamp: "", counts: {} });
  }
  throw new Error(`Unerwarteter Fachabruf: ${url}`);
}

function forbiddenIdentityHeaders(init?: RequestInit) {
  return [...new Headers(init?.headers).keys()].filter((name) =>
    name === "authorization" ||
    name === "x-actor-name" ||
    name.startsWith("x-catering-") ||
    /(?:actor|subject|role|business|identity)/u.test(name)
  );
}

async function settle(rounds = 4) {
  for (let round = 0; round < rounds; round += 1) {
    await Promise.resolve();
  }
}

async function renderApp(pathname = "/angebot") {
  window.history.replaceState({}, "", pathname);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<App />);
    await settle();
  });
  await act(async () => {
    await settle();
  });
  return container;
}

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function buttonWithText(container: HTMLElement, label: string) {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(label)
  );
}

beforeEach(() => {
  storageWrites.length = 0;
  installStorage("local");
  installStorage("session");
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Catering session boundary", () => {
  it("shows only Kennung and PIN after a 401 without starting a Fachloader", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/intake/v1/auth/session")) {
        return jsonResponse({ message: "Ungültige Sitzung." }, 401);
      }
      return offerRouteResponse(url);
    }));

    const container = await renderApp();

    expect(container.querySelector("input[name='loginCode']")).not.toBeNull();
    expect(container.querySelector("input[name='pin']")).not.toBeNull();
    expect(container.textContent).not.toContain("Angebotsassistent");
    expect(container.textContent).not.toContain("Produktionsassistent");
    expect(calls.map(({ url }) => url)).toEqual(["/api/intake/v1/auth/session"]);
    expect(calls[0]?.init?.credentials).toBe("same-origin");
    expect(forbiddenIdentityHeaders(calls[0]?.init)).toEqual([]);
  });

  it.each([
    ["eine unvollständige Sitzung", { authenticated: true, user: { userId: "user-anna" }, access: { capabilities: [] } }],
    ["eine Sitzung mit browserseitiger Rollenbehauptung", { ...authenticatedSession, role: "admin" }]
  ])("fails closed for %s", async (_label, payload) => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/api/intake/v1/auth/session")) return jsonResponse(payload);
      return offerRouteResponse(url);
    }));

    const container = await renderApp();

    expect(container.textContent).toContain("Anwendung ist derzeit nicht verfügbar");
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).not.toContain("Angebotsassistent");
    expect(calls).toEqual(["/api/intake/v1/auth/session"]);
  });

  describe("Offer route capability boundary", () => {
    it.each([
      ["Production ohne Offer-Recht", ["production", "production_read"]],
      ["Read-only ohne Offer-Recht", ["production_read"]]
    ])("keeps %s out of the loader and interactive workbench", async (_label, capabilities) => {
      const calls: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/api/intake/v1/auth/session")) {
          return jsonResponse({
            authenticated: true,
            user: {
              userId: "user-without-offer-access",
              displayName: "Benutzer ohne Angebotsrecht"
            },
            access: { capabilities }
          });
        }
        return offerRouteResponse(url);
      }));

      const container = await renderApp("/angebot");

      expect(container.textContent).toContain("Kein Zugriff auf Angebote");
      expect(container.textContent).not.toContain("Angebotsassistent");
      expect(container.querySelector("textarea[aria-label='Kundenanfrage als Text']")).toBeNull();
      expect(container.querySelector("input[type='file']")).toBeNull();
      expect(buttonWithText(container, "Entwurf aus Text erstellen")).toBeUndefined();
      expect(calls).toEqual(["/api/intake/v1/auth/session"]);
    });

    it("keeps the existing offer workbench for an administrator", async () => {
      const calls: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/api/intake/v1/auth/session")) {
          return jsonResponse({
            ...authenticatedSession,
            access: {
              capabilities: [
                "intake",
                "offer",
                "production",
                "production_read",
                "operations_audit",
                "commercial"
              ]
            }
          });
        }
        return offerRouteResponse(url);
      }));

      const container = await renderApp("/angebot");

      expect(container.textContent).toContain("Angebotsassistent");
      expect(container.querySelector("textarea[aria-label='Kundenanfrage als Text']")).not.toBeNull();
      expect(calls).toContain("/api/offers/v1/offers/cases");
      expect(calls).toContain("/api/offers/health");
    });

    it.each([
      ["fehlendem Access-Kontext", {
        authenticated: true,
        user: { userId: "user-anna", displayName: "Anna Beispiel" }
      }],
      ["unbekannter Capability", {
        ...authenticatedSession,
        access: { capabilities: ["offer", "admin"] }
      }]
    ])("fails closed before the offer loader with %s", async (_label, payload) => {
      const calls: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/api/intake/v1/auth/session")) return jsonResponse(payload);
        return offerRouteResponse(url);
      }));

      const container = await renderApp("/angebot");

      expect(container.textContent).toContain("Anwendung ist derzeit nicht verfügbar");
      expect(container.textContent).not.toContain("Angebotsassistent");
      expect(container.querySelector("textarea[aria-label='Kundenanfrage als Text']")).toBeNull();
      expect(calls).toEqual(["/api/intake/v1/auth/session"]);
    });
  });

  it.each([
    ["einen Netzwerkfehler", "network"],
    ["einen anderen HTTP-Status", "status"]
  ])("shows only the generic unavailable state for %s", async (_label, failure) => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (failure === "network") throw new Error("interne Netzdiagnose");
      return jsonResponse({ message: "interne Upstream-Diagnose" }, 503);
    }));

    const container = await renderApp();

    expect(container.textContent).toContain("Anwendung ist derzeit nicht verfügbar");
    expect(container.textContent).not.toContain("interne Netzdiagnose");
    expect(container.textContent).not.toContain("interne Upstream-Diagnose");
    expect(container.querySelector("form")).toBeNull();
    expect(calls).toEqual(["/api/intake/v1/auth/session"]);
  });

  it("re-resolves the session after login before mounting the requested route", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let sessionReads = 0;
    let resolveRecheck!: (response: Response) => void;
    const recheck = new Promise<Response>((resolve) => {
      resolveRecheck = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/intake/v1/auth/session")) {
        sessionReads += 1;
        if (sessionReads === 1) return jsonResponse({ message: "Ungültige Sitzung." }, 401);
        return recheck;
      }
      if (url.endsWith("/api/intake/v1/auth/login")) {
        return jsonResponse({
          token: "server-token-must-be-ignored",
          role: "admin",
          user: { userId: "untrusted-login-user", displayName: "Nicht autoritativ" }
        });
      }
      return offerRouteResponse(url);
    }));

    const container = await renderApp();
    const loginCode = container.querySelector("input[name='loginCode']") as HTMLInputElement;
    const pin = container.querySelector("input[name='pin']") as HTMLInputElement;
    expect(loginCode).not.toBeNull();
    expect(pin).not.toBeNull();
    await act(async () => {
      setNativeValue(loginCode, "ANNA-01");
      setNativeValue(pin, "123456");
      buttonWithText(container, "Anmelden")?.click();
      await settle();
    });

    const loginCall = calls.find(({ url }) => url.endsWith("/api/intake/v1/auth/login"));
    expect(loginCall?.init?.method).toBe("POST");
    expect(loginCall?.init?.credentials).toBe("same-origin");
    expect(forbiddenIdentityHeaders(loginCall?.init)).toEqual([]);
    expect(JSON.parse(String(loginCall?.init?.body))).toEqual({ loginCode: "ANNA-01", pin: "123456" });
    expect(container.querySelector("input[name='loginCode']")).not.toBeNull();
    expect(container.textContent).not.toContain("Angebotsassistent");
    expect(calls.filter(({ url }) => url.endsWith("/api/intake/v1/auth/session"))).toHaveLength(2);

    await act(async () => {
      resolveRecheck(jsonResponse(authenticatedSession));
      await settle(8);
    });

    expect(container.textContent).toContain("Angebotsassistent");
    expect(container.textContent).toContain("Anna Beispiel");
    expect(container.textContent).not.toContain("Nicht autoritativ");
    expect(container.textContent).not.toContain("server-token-must-be-ignored");
    const secondSessionIndex = calls
      .map(({ url }) => url.endsWith("/api/intake/v1/auth/session"))
      .lastIndexOf(true);
    const firstFachIndex = calls.findIndex(({ url }) => url.includes("/api/offers/"));
    expect(firstFachIndex).toBeGreaterThan(secondSessionIndex);
    expect(calls.every(({ init }) => forbiddenIdentityHeaders(init).length === 0)).toBe(true);
    expect(calls.every(({ init }) => init?.credentials === "same-origin")).toBe(true);
    expect(JSON.stringify(storageWrites)).not.toMatch(/server-token-must-be-ignored|123456|admin|actor/iu);
  });

  it("uses one generic login error without exposing backend or account details", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/intake/v1/auth/session")) {
        return jsonResponse({ message: "Ungültige Sitzung." }, 401);
      }
      if (url.endsWith("/api/intake/v1/auth/login")) {
        return jsonResponse({ message: "Konto ANNA-01 ist gesperrt; Rate-Limit intern 57" }, 429);
      }
      return offerRouteResponse(url);
    }));

    const container = await renderApp();
    const loginCode = container.querySelector("input[name='loginCode']") as HTMLInputElement;
    const pin = container.querySelector("input[name='pin']") as HTMLInputElement;
    expect(loginCode).not.toBeNull();
    expect(pin).not.toBeNull();
    await act(async () => {
      setNativeValue(loginCode, "ANNA-01");
      setNativeValue(pin, "123456");
      buttonWithText(container, "Anmelden")?.click();
      await settle();
    });

    expect(container.textContent).toContain("Anmeldung nicht möglich");
    expect(container.textContent).not.toContain("gesperrt");
    expect(container.textContent).not.toContain("Rate-Limit");
  });

  it.each([
    ["JSON API", () => createAcceptedSpecFromText("Sitzung abgelaufen")],
    ["document upload", () => createAcceptedSpecFromDocument(
      new File(["Dokument"], "auftrag.pdf", { type: "application/pdf" }),
      "pdf_upload"
    )],
    ["source-document upload", () => uploadSourceDocument(
      new File(["Quelle"], "quelle.pdf", { type: "application/pdf" })
    )],
    ["recipe upload", () => uploadRecipeFile(
      "offer",
      new File(["Rezept"], "rezept.txt", { type: "text/plain" })
    )],
    ["quantity API", () => fetchProductionQuantityWorkflow("production-case-expired")]
  ])("unmounts loaded Fachdata and closes the request gate after a later %s 401", async (_label, issueRequest) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/intake/v1/auth/session")) return jsonResponse(authenticatedSession);
      if (url === "/api/offers/v1/offers/cases") {
        return jsonResponse({
          items: [{
            caseId: "offer-case-visible-before-expiry",
            product: "offer",
            displayName: "Geladener Auftrag vor Sitzungsablauf",
            status: "open",
            createdAt: "2026-08-28T10:00:00.000Z",
            updatedAt: "2026-08-28T10:00:00.000Z"
          }]
        });
      }
      if (
        url.endsWith("/api/intake/v1/intake/normalize") ||
        url.endsWith("/api/intake/v1/intake/documents/upload") ||
        url.endsWith("/api/intake/v1/intake/source-documents") ||
        url.endsWith("/api/offers/v1/offers/recipes/upload") ||
        url.endsWith("/api/production/v1/production/cases/production-case-expired/quantity-workflow")
      ) {
        return jsonResponse({ message: "Veraltete Sitzung mit interner Diagnose" }, 401);
      }
      return offerRouteResponse(url);
    }));

    const container = await renderApp();
    expect(container.textContent).toContain("Angebotsassistent");
    expect(container.textContent).toContain("Geladener Auftrag vor Sitzungsablauf");

    let requestError: unknown;
    await act(async () => {
      await issueRequest().catch((error: unknown) => {
        requestError = error;
      });
      await settle(8);
    });

    expect(requestError).toEqual(new Error("Die Sitzung wurde beendet."));
    expect(container.querySelector("input[name='loginCode']")).not.toBeNull();
    expect(container.textContent).not.toContain("Angebotsassistent");
    expect(container.textContent).not.toContain("Geladener Auftrag vor Sitzungsablauf");
    expect(container.textContent).not.toContain("interner Diagnose");

    const callCountAfterInvalidation = calls.length;
    let blockedError: unknown;
    await loadOfferCaseSummaries("nach Ablauf").catch((error: unknown) => {
      blockedError = error;
    });
    expect(blockedError).toEqual(new Error("Die Sitzung wurde beendet."));
    expect(calls).toHaveLength(callCountAfterInvalidation);
  });

  it("does not let an aborted request generation invalidate a newly authenticated session", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let resolveOldResponse!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => {
      resolveOldResponse = resolve;
    });
    let sessionReads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/intake/v1/auth/session")) {
        sessionReads += 1;
        return jsonResponse(sessionReads === 1
          ? authenticatedSession
          : {
              ...authenticatedSession,
              user: { userId: "user-berta", displayName: "Berta Neue Sitzung" }
            });
      }
      if (url.endsWith("/api/intake/v1/auth/login")) return new Response(null, { status: 204 });
      if (url.endsWith("/api/intake/v1/auth/logout")) return new Response(null, { status: 204 });
      if (url.includes("/api/offers/v1/offers/cases?search=alte")) return oldResponse;
      return offerRouteResponse(url);
    }));

    const container = await renderApp();
    const search = container.querySelector("#offer-case-history-search") as HTMLInputElement;
    await act(async () => {
      setNativeValue(search, "alte Anfrage");
      await settle();
    });

    await act(async () => {
      buttonWithText(container, "Abmelden")?.click();
      await settle();
    });
    const loginCode = container.querySelector("input[name='loginCode']") as HTMLInputElement;
    const pin = container.querySelector("input[name='pin']") as HTMLInputElement;
    await act(async () => {
      setNativeValue(loginCode, "BERTA-01");
      setNativeValue(pin, "654321");
      buttonWithText(container, "Anmelden")?.click();
      await settle(8);
    });
    expect(container.textContent).toContain("Berta Neue Sitzung");
    expect(container.textContent).toContain("Angebotsassistent");

    await act(async () => {
      resolveOldResponse(jsonResponse({ message: "Alte Sitzung" }, 401));
      await settle(8);
    });

    expect(container.querySelector("input[name='loginCode']")).toBeNull();
    expect(container.textContent).toContain("Berta Neue Sitzung");
    expect(container.textContent).toContain("Angebotsassistent");
    const freshCases = await loadOfferCaseSummaries();
    expect(freshCases).toEqual([]);
    expect(calls.some(({ url }) => url === "/api/offers/v1/offers/cases")).toBe(true);
  });

  it.each([
    ["einen Netzwerkfehler", "network"],
    ["HTTP 503", "status"]
  ])("keeps Fachdata and login blocked when logout fails through %s", async (_label, failure) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let logoutAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/intake/v1/auth/session")) return jsonResponse(authenticatedSession);
      if (url.endsWith("/api/intake/v1/auth/logout")) {
        logoutAttempts += 1;
        if (logoutAttempts === 1) {
          if (failure === "network") throw new Error("interne Netzdiagnose");
          return jsonResponse({ message: "interne Upstream-Diagnose" }, 503);
        }
        return new Response(null, { status: 204 });
      }
      return offerRouteResponse(url);
    }));

    const container = await renderApp();
    expect(container.textContent).toContain("Angebotsassistent");

    await act(async () => {
      buttonWithText(container, "Abmelden")?.click();
      await settle(8);
    });

    expect(container.textContent).toContain("Abmeldung nicht abgeschlossen");
    expect(container.textContent).toContain("Erneut versuchen");
    expect(container.textContent).not.toContain("Angebotsassistent");
    expect(container.querySelector("input[name='loginCode']")).toBeNull();
    expect(container.textContent).not.toContain("interne Netzdiagnose");
    expect(container.textContent).not.toContain("interne Upstream-Diagnose");

    const callsAfterFailure = calls.length;
    await expect(loadOfferCaseSummaries("nach fehlgeschlagener Abmeldung")).rejects.toEqual(
      new Error("Die Sitzung wurde beendet.")
    );
    expect(calls).toHaveLength(callsAfterFailure);

    await act(async () => {
      buttonWithText(container, "Erneut versuchen")?.click();
      await settle(8);
    });

    expect(logoutAttempts).toBe(2);
    expect(container.querySelector("input[name='loginCode']")).not.toBeNull();
    expect(container.textContent).not.toContain("Abmeldung nicht abgeschlossen");
  });

  it("unmounts on logout and blocks a stale offer mutation from issuing follow-up requests", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let resolveCreateCase!: (response: Response) => void;
    const pendingCreateCase = new Promise<Response>((resolve) => {
      resolveCreateCase = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/intake/v1/auth/session")) return jsonResponse(authenticatedSession);
      if (url.endsWith("/api/intake/v1/auth/logout")) return new Response(null, { status: 204 });
      if (url.endsWith("/api/offers/v1/offers/cases") && init?.method === "POST") return pendingCreateCase;
      return offerRouteResponse(url);
    }));

    const container = await renderApp();
    const offerText = container.querySelector("textarea[aria-label='Kundenanfrage als Text']") as HTMLTextAreaElement;
    await act(async () => {
      setNativeValue(offerText, "Besprechung für 35 Personen");
      buttonWithText(container, "Entwurf aus Text erstellen")?.click();
      await settle();
    });
    expect(calls.some(({ url, init }) => url.endsWith("/api/offers/v1/offers/cases") && init?.method === "POST")).toBe(true);

    await act(async () => {
      buttonWithText(container, "Abmelden")?.click();
    });
    expect(container.querySelector("input[name='loginCode']")).not.toBeNull();
    expect(container.textContent).not.toContain("Angebotsassistent");

    await act(async () => {
      resolveCreateCase(jsonResponse({ case: { caseId: "stale-case" } }, 201));
      await settle(8);
    });

    expect(calls.some(({ url }) => url.endsWith("/api/offers/v1/offers/from-text"))).toBe(false);
    const logoutCall = calls.find(({ url }) => url.endsWith("/api/intake/v1/auth/logout"));
    expect(logoutCall?.init?.method).toBe("POST");
    expect(logoutCall?.init?.credentials).toBe("same-origin");
    expect(forbiddenIdentityHeaders(logoutCall?.init)).toEqual([]);
  });

  it("blocks a new multipart follow-up request after logout when the first response body resumes", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let resolveSourceDocumentBody!: (document: {
      documentId: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      dataClass: string;
      createdAt: string;
    }) => void;
    const pendingSourceDocumentBody = new Promise<{
      documentId: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      dataClass: string;
      createdAt: string;
    }>((resolve) => {
      resolveSourceDocumentBody = resolve;
    });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/intake/v1/auth/session")) return jsonResponse(authenticatedSession);
      if (url.endsWith("/api/intake/v1/auth/logout")) return new Response(null, { status: 204 });
      if (url.endsWith("/api/intake/v1/intake/source-documents")) {
        return {
          ok: true,
          status: 201,
          statusText: "Created",
          json: () => pendingSourceDocumentBody
        } as Response;
      }
      if (url.endsWith("/api/intake/v1/intake/documents/upload")) {
        return jsonResponse({ acceptedEventSpec: { specId: "stale-spec" } }, 201);
      }
      return offerRouteResponse(url);
    }));

    const container = await renderApp();
    const file = new File(["stale upload"], "auftrag.pdf", { type: "application/pdf" });
    const followUp = uploadSourceDocument(file).then(() =>
      createAcceptedSpecFromDocument(file, "pdf_upload")
    );
    await act(async () => {
      await settle();
    });
    expect(calls.some(({ url }) => url.endsWith("/api/intake/v1/intake/source-documents"))).toBe(true);

    await act(async () => {
      buttonWithText(container, "Abmelden")?.click();
      await settle();
    });
    expect(container.querySelector("input[name='loginCode']")).not.toBeNull();

    let followUpResolved = false;
    let followUpError: unknown;
    await act(async () => {
      resolveSourceDocumentBody({
        documentId: "source-stale",
        filename: "auftrag.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12,
        sha256: "stale-sha256",
        dataClass: "source_document",
        createdAt: "2026-08-28T10:00:00.000Z"
      });
      await followUp.then(
        () => {
          followUpResolved = true;
        },
        (error: unknown) => {
          followUpError = error;
        }
      );
      await settle();
    });

    expect(followUpResolved).toBe(false);
    expect(followUpError).toEqual(new Error("Die Sitzung wurde beendet."));
    expect(calls.some(({ url }) => url.endsWith("/api/intake/v1/intake/documents/upload"))).toBe(false);
  });
});
