// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeEventRequestToSpec, SCHEMA_VERSION, type EventRequest } from "@catering/shared-core";
import { App } from "../backoffice-ui/src/App.js";

function buildEventRequest(): EventRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: "request-detail-1",
    source: {
      channel: "text",
      receivedAt: "2026-04-10T09:30:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: "Konferenz am 2026-04-18 fuer 45 Teilnehmer mit Lunchbuffet, Wasserstation und Dessert."
      }
    ]
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("backoffice intake request detail", () => {
  it("shows the original intake request in the production context", async () => {
    const spec = normalizeEventRequestToSpec(buildEventRequest(), {
      sourceType: "manual_input",
      reference: "request-detail-1",
      commercialState: "manual"
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/intake/v1/intake/requests/request-detail-1")) {
          return new Response(
            JSON.stringify({
              requestId: "request-detail-1",
              source: {
                channel: "text",
                receivedAt: "2026-04-10T09:30:00.000Z"
              },
              rawInputs: [
                {
                  kind: "text",
                  content:
                    "Konferenz am 2026-04-18 fuer 45 Teilnehmer mit Lunchbuffet, Wasserstation und Dessert.",
                  documentIngestion: {
                    status: "fallback",
                    warnings: ["document_text_extraction_fallback"]
                  },
                  sourceMetadata: {
                    filename: "angebot-detail.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 2048,
                    sha256: "ddddddddddddeeeeeeeeeeeeffffffffffffffffaaaabbbbbbbbbbbbcccccccccccc",
                    ingestedAt: "2026-04-10T09:31:00.000Z",
                    uploadContext: "intake"
                  }
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.endsWith("/api/intake/v1/intake/requests")) {
          return new Response(JSON.stringify({ items: [buildEventRequest()] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/intake/v1/intake/specs")) {
          return new Response(JSON.stringify({ items: [spec] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/offers/v1/offers/drafts")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/production/v1/production/plans")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/production/v1/production/purchase-lists")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/production/v1/production/recipes")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.includes("/api/production/v1/production/audit/events")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/intake/health") || url.endsWith("/api/offers/health") || url.endsWith("/api/production/health") || url.endsWith("/api/exports/health")) {
          return new Response(
            JSON.stringify({ service: "ok", status: "ok", timestamp: "2026-04-10T09:30:00.000Z", counts: {} }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      }
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true
    });
    vi.stubGlobal("localStorage", localStorageMock);

    window.history.pushState({}, "", "/produktion");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
      await Promise.resolve();
    });

    const historyJob = container.querySelector<HTMLButtonElement>(
      ".production-filter-details .quiet-list__button"
    );
    expect(historyJob).not.toBeNull();
    await act(async () => {
      historyJob?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Ursprüngliche Intake-Anfrage");
    expect(document.body.textContent).toContain("Intake-Ursprung: Text · erhalten 2026-04-10T09:30:00.000Z");
    expect(document.body.textContent).not.toContain("requestId: request-detail-1");
    expect(document.body.textContent).not.toContain("channel: text");
    expect(document.body.textContent).toContain("2026-04-10T09:30:00.000Z");
    expect(document.body.textContent).toContain("Herkunft und Übergabe");
    expect(document.body.textContent).toContain("Intake-Ursprung");
    expect(document.body.textContent).not.toContain("Konferenz am 2026-04-18 fuer 45 Teilnehmer");
    expect(document.body.textContent).toContain("Dokumentprüfung");
    expect(document.body.textContent).toContain(
      "Quelle prüfen: angebot-detail.pdf · Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    );
    expect(document.body.textContent).toContain(
      "Dokumentprüfung: Lesbarkeit: Textextraktion unsicher · Hinweise: PDF-Text nur unsicher extrahiert"
    );

    await act(async () => {
      root.unmount();
    });
  });
});
