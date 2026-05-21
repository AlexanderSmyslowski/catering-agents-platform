// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";

function installProductionAcceptanceMocks(options: { stalePlanOnly?: boolean; withCurrentPurchaseList?: boolean } = {}) {
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

  const requestId = "request-production-fallback-1";
  const specId = "spec-production-fallback-1";
  const previousSpecId = "spec-production-previous-1";
  const planSpecId = options.stalePlanOnly ? previousSpecId : specId;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/intake/v1/intake/requests")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                requestId,
                source: {
                  channel: "manual_form",
                  receivedAt: "2026-04-18T10:30:00.000Z"
                },
                rawInputs: [
                  {
                    kind: "form",
                    content:
                      "Konferenz am 2026-07-13 fuer 36 Teilnehmer. Bitte glutenfrei. Buffet mit Brot-Baguette."
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/intake/v1/intake/specs")) {
        return new Response(
          JSON.stringify({
            items: [
              ...(options.stalePlanOnly
                ? [
                    {
                      schemaVersion: 1,
                      specId: previousSpecId,
                      requestId: "request-production-previous-1",
                      sourceLineage: [],
                      readiness: { status: "complete", reasons: [] },
                      event: { type: "meeting", date: "2026-07-12" },
                      servicePlan: { eventType: "meeting", serviceForm: "buffet" },
                      attendees: { expected: 12 },
                      menuPlan: []
                    }
                  ]
                : []),
              {
                schemaVersion: 1,
                specId,
                requestId,
                sourceLineage: [
                  {
                    sourceType: "manual_input",
                    reference: requestId
                  }
                ],
                readiness: {
                  status: "insufficient",
                  reasons: ["Glutenfrei-Konflikt mit Brot-Baguette und fehlender Ersatzklassifikation."]
                },
                event: {
                  type: "conference",
                  date: "2026-07-13"
                },
                servicePlan: {
                  eventType: "conference",
                  serviceForm: "buffet"
                },
                attendees: {
                  expected: 36
                },
                menuPlan: [
                  {
                    componentId: "component-bread-baguette",
                    label: "Brot-Baguette",
                    menuCategory: "classic",
                    productionDecision: {
                      mode: "scratch"
                    }
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/offers/v1/offers/drafts")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/plans")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                planId: "plan-production-fallback-1",
                eventSpecId: planSpecId,
                readiness: {
                  status: "insufficient",
                  reasons: ["Glutenfrei-Konflikt bleibt ungelöst."]
                },
                isFallback: true,
                fallbackReason: "Glutenfrei-Konflikt bleibt ungelöst.",
                unresolvedItems: ["Glutenfrei-Konflikt bleibt ungelöst.", "Klassifikation für Brot-Baguette fehlt."],
                productionBatches: [],
                kitchenSheets: [],
                recipeSelections: []
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return new Response(
          JSON.stringify({
            items: options.withCurrentPurchaseList
              ? [
                  {
                    purchaseListId: "purchase-production-current-1",
                    eventSpecId: specId,
                    totals: { itemCount: 2 },
                    items: [
                      {
                        articleName: "Glutenfreies Baguette",
                        purchaseQty: 4,
                        purchaseUnit: "Stück"
                      },
                      {
                        articleName: "Olivenöl",
                        purchaseQty: 1,
                        purchaseUnit: "l"
                      }
                    ]
                  }
                ]
              : []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

      if (
        url.endsWith("/api/intake/health") ||
        url.endsWith("/api/offers/health") ||
        url.endsWith("/api/production/health") ||
        url.endsWith("/api/exports/health")
      ) {
        return new Response(
          JSON.stringify({ service: "ok", status: "ok", timestamp: "2026-04-10T09:30:00.000Z", counts: {} }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith(`/api/intake/v1/intake/requests/${requestId}`)) {
        return new Response(
          JSON.stringify({
            requestId,
            source: {
              channel: "manual_form",
              receivedAt: "2026-04-18T10:30:00.000Z"
            },
            rawInputs: [
              {
                kind: "form",
                content:
                  "Konferenz am 2026-07-13 fuer 36 Teilnehmer. Bitte glutenfrei. Buffet mit Brot-Baguette."
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

async function renderProductionRoute(): Promise<string> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", "/produktion");

  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  const content = document.body.textContent ?? "";

  await act(async () => {
    root.unmount();
  });
  container.remove();

  return content;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("backoffice production acceptance smoke", () => {
  it("shows a blocking fallback plan and the linked intake request on the production route", async () => {
    installProductionAcceptanceMocks();

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsagent");
    expect(content).toContain("Produktionsagent-Chat");
    expect(content).toContain("Was braucht die Produktion als Nächstes?");
    expect(content).toContain("+ Angebot hinzufügen");
    expect(content).toContain("Angebot hier ablegen");
    expect(content).toContain("Downloadbereich");
    expect(content).toContain("production-calm-summary");
    expect(content).toContain("production-objects-zone");
    expect(content).toContain("Produktionsobjekte");
    expect(content).not.toContain("Schritt 3");
    expect(content).toContain("Workbench-Projektion");
    expect(content).toContain("Strukturierte Veranstaltungsdaten bleiben führend");
    expect(content).toContain("Klärbereich");
    expect(content).toContain("1 offene Rückfrage");
    expect(content).toContain("Strukturierte Rückfragen im Chatfluss");
    expect(content).toContain("Agent fragt");
    expect(content).toContain("Deine strukturierte Antwort im Chatfluss");
    expect(content).toContain("Antwort direkt zur Agentenfrage");
    expect(content).toContain("kein freier LLM-Chat");
    expect(content).toContain("Status");
    expect(content).toContain("unzureichend");
    expect(content).toContain("Offene Punkte:");
    expect(content).toContain("Glutenfrei-Konflikt bleibt ungelöst.");
    expect(content).toContain("Klassifikation für Brot-Baguette fehlt.");
    expect(content).toContain("Ursprüngliche Intake-Anfrage");
    expect(content).toContain("requestId: request-production-fallback-1");
    expect(content).toContain("channel: manual_form");
    expect(content).toContain("Konferenz am 2026-07-13 fuer 36 Teilnehmer");
    expect(content).not.toContain("Offene Punkte: keine");
  });

  it("does not surface a previous plan as current results for a newly focused production spec", async () => {
    installProductionAcceptanceMocks({ stalePlanOnly: true });

    const content = await renderProductionRoute();

    expect(content).toContain("Aktueller Vorgang");
    expect(content).toContain("Noch keine Produktionspläne vorhanden.");
    expect(content).toContain("Einkauf: offen");
    expect(content).not.toContain("Klassifikation für Brot-Baguette fehlt.");
    expect(content).not.toContain("Produktionsblatt exportieren");
  });

  it("keeps purchase lists reachable through a quiet progressive workbench zone", async () => {
    installProductionAcceptanceMocks({ withCurrentPurchaseList: true });

    const content = await renderProductionRoute();

    expect(content).toContain("production-purchase-zone");
    expect(content).toContain("Einkaufsliste");
    expect(content).toContain("1 Liste · 2 Positionen");
    expect(content).toContain("Einkaufsliste herunterladen");
    expect(content).toContain("Glutenfreies Baguette");
    expect(content).toContain("Olivenöl");
    expect(content).not.toContain("Aktueller Vorgang zuerst");
  });
});
