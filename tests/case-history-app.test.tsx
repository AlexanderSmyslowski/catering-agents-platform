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

function caseSummary(caseId: string, displayName: string) {
  return {
    caseId,
    product: "offer" as const,
    displayName,
    status: "open",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z"
  };
}

describe("case history in the rendered offer route", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it("opens only the selected case and copies through the product-scoped route", async () => {
    const cases = [caseSummary("case-a", "Fall A"), caseSummary("case-b", "Fall B")];
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ method, url });
      if (url.endsWith("/api/intake/v1/auth/session")) {
        return adminSessionResponse();
      }
      if (url.endsWith("/api/offers/health")) {
        return Response.json({ service: "offer-service", status: "ok", timestamp: "", counts: {} });
      }
      if (method === "GET" && url.endsWith("/api/offers/v1/offers/cases")) {
        return Response.json({ items: cases });
      }
      const detailMatch = url.match(/\/api\/offers\/v1\/offers\/cases\/(case-a|case-b|case-copy)/u);
      if (method === "GET" && detailMatch) {
        const selected = cases.find((item) => item.caseId === detailMatch[1])!;
        return Response.json({
          case: {
            ...selected,
            schemaVersion: "1.0",
            businessId: "local",
            version: 1
          },
          events: []
        });
      }
      if (method === "POST" && url.endsWith("/api/offers/v1/offers/cases/case-a/copies")) {
        const copied = caseSummary("case-copy", "Fall A (Kopie)");
        cases.unshift(copied);
        return Response.json({ case: copied, events: [] }, { status: 201 });
      }
      return Response.json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
    });
    window.history.replaceState({}, "", "/angebot");

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(createElement(App));
      await flush();
    });

    const openButtons = () => Array.from(container.querySelectorAll("button[data-action='open-case']"));
    expect(openButtons().map((button) => button.textContent)).toEqual([
      expect.stringContaining("Fall A"),
      expect.stringContaining("Fall B")
    ]);

    await act(async () => {
      (openButtons()[1] as HTMLButtonElement).click();
      await flush();
    });
    expect(calls.some(({ method, url }) => method === "GET" && url.endsWith("/cases/case-b"))).toBe(true);
    expect(calls.some(({ method, url }) => method === "GET" && url.endsWith("/cases/case-a"))).toBe(false);

    await act(async () => {
      (openButtons()[0] as HTMLButtonElement).click();
      await flush();
      (container.querySelector("button[data-action='copy-case']") as HTMLButtonElement).click();
      await flush();
    });
    expect(calls.some(({ method, url }) => method === "POST" && url.endsWith("/cases/case-a/copies"))).toBe(true);
    expect(calls.some(({ method, url }) => method === "GET" && url.endsWith("/cases/case-copy"))).toBe(true);
    expect(container.textContent).toContain("Fall A (Kopie)");
  });
});
