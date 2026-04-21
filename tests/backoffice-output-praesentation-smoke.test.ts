// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";

function createDashboardResponse(blocked = false) {
  const requestId = blocked ? "presentation-intake-blocked" : "presentation-intake-success";
  const specId = blocked ? "presentation-spec-blocked" : "presentation-spec-success";
  const planId = blocked ? "presentation-plan-blocked" : "presentation-plan-success";
  const purchaseListId = blocked ? "presentation-purchase-blocked" : "presentation-purchase-success";

  const acceptedSpec = {
    specId,
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: requestId
      }
    ],
    event: {
      type: "lunch",
      date: "2026-07-18"
    },
    attendees: {
      expected: 45
    },
    servicePlan: {
      serviceForm: "buffet"
    },
    readiness: {
      status: blocked ? "insufficient" : "complete"
    },
    menuPlan: [
      {
        componentId: "vegetarian-tomato-soup",
        label: "Vegetarische Tomatensuppe",
        menuCategory: "vegetarian",
        productionDecision: {
          mode: "scratch"
        }
      }
    ],
    productionConstraints: ["vegetarian", "gluten_free"],
    assumptions: blocked
      ? []
      : [
          {
            code: "event_type_defaulted",
            message: "Event type inferred as lunch.",
            applied: true
          },
          {
            code: "service_form_defaulted",
            message: "Service form inferred as buffet.",
            applied: true
          }
        ],
    uncertainties: blocked
      ? [
          {
            field: "attendees.expected",
            message: "Die Teilnehmerzahl konnte nicht zuverlässig aus dem Dokument abgeleitet werden."
          }
        ]
      : [
          {
            field: "event.schedule",
            message: "Zeitangabe in \"gegen 12:30 Uhr\" ist nicht als vollständiger Termin belastbar."
          }
        ]
  };

  const productionPlan = {
    planId,
    eventSpecId: specId,
    readiness: {
      status: blocked ? "insufficient" : "complete"
    },
    isFallback: blocked,
    unresolvedItems: blocked ? ["Teilnehmerzahl bitte noch präzisieren"] : [],
    productionBatches: blocked
      ? []
      : [
          {
            batchId: "batch-vegetarian-tomato-soup",
            title: "Rezeptblatt Vegetarische Tomatensuppe"
          }
        ],
    kitchenSheets: blocked
      ? []
      : [
          {
            title: "Küchenblatt Vegetarische Tomatensuppe",
            instructions: [
              "45 Portionen vorbereiten",
              "Vegetarisch und glutenfrei getrennt führen",
              "Buffetausgabe für 12:30 Uhr einplanen"
            ]
          }
        ],
    recipeSelections: blocked
      ? [
          {
            componentId: "vegetarian-tomato-soup",
            recipeId: "recipe-vegetarian-tomato-soup",
            selectionReason: "Noch keine belastbare operative Freigabe."
          }
        ]
      : [
          {
            componentId: "vegetarian-tomato-soup",
            recipeId: "recipe-vegetarian-tomato-soup",
            selectionReason: "Intern freigegebenes Rezept für vegetarische Tomatensuppe.",
            qualityScore: 0.96,
            fitScore: 0.98,
            searchTrace: ["interne Bibliothek", "kein Internet-Fallback"]
          }
        ]
  };

  const purchaseList = {
    purchaseListId,
    eventSpecId: specId,
    totals: {
      itemCount: blocked ? 0 : 3
    },
    items: blocked
      ? []
      : [
          {
            displayName: "Tomaten",
            purchaseQty: 8,
            purchaseUnit: "kg",
            normalizedQty: 8000,
            normalizedUnit: "g"
          }
        ]
  };

  const requestDetail = {
    requestId,
    source: {
      channel: "manual_form",
      receivedAt: "2026-07-01T09:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "form",
        content: blocked
          ? "Internes Mittagessen für 45 Personen mit Buffet. Bitte vegetarisch und glutenfrei."
          : "Internes Mittagessen für 45 Personen mit Buffet. Bitte vegetarisch und glutenfrei. Gegen 12:30 Uhr."
      }
    ]
  };

  return {
    dashboard: {
      intakeRequests: [
        {
          requestId,
          source: {
            channel: "manual_form",
            receivedAt: "2026-07-01T09:00:00.000Z"
          }
        }
      ],
      acceptedSpecs: [acceptedSpec],
      offerDrafts: [],
      productionPlans: [productionPlan],
      purchaseLists: [purchaseList],
      recipes: [
        {
          recipeId: "recipe-vegetarian-tomato-soup",
          name: "Vegetarische Tomatensuppe",
          source: {
            tier: "internal_verified",
            approvalState: "approved_internal"
          }
        }
      ],
      auditEvents: []
    },
    requestDetail
  };
}

function installBackofficeMocks(blocked = false) {
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

  const { dashboard, requestDetail } = createDashboardResponse(blocked);

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/intake/v1/intake/requests")) {
        return new Response(JSON.stringify({ items: dashboard.intakeRequests }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/intake/v1/intake/specs")) {
        return new Response(JSON.stringify({ items: dashboard.acceptedSpecs }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/offers/v1/offers/drafts")) {
        return new Response(JSON.stringify({ items: dashboard.offerDrafts }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/plans")) {
        return new Response(JSON.stringify({ items: dashboard.productionPlans }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return new Response(JSON.stringify({ items: dashboard.purchaseLists }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/recipes")) {
        return new Response(JSON.stringify({ items: dashboard.recipes }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.includes("/api/production/v1/production/audit/events")) {
        return new Response(JSON.stringify({ items: dashboard.auditEvents }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith(`/api/intake/v1/intake/requests/${requestDetail.requestId}`)) {
        return new Response(JSON.stringify(requestDetail), {
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
          JSON.stringify({ service: "ok", status: "ok", timestamp: "2026-07-01T09:05:00.000Z", counts: {} }),
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

describe("backoffice production presentation smoke", () => {
  it("shows a plausible successful production result with visible assumptions and operational context", async () => {
    installBackofficeMocks(false);

    const content = await renderProductionRoute();

    expect(content).toContain("Produktionsagent");
    expect(content).toContain("Status: vollständig");
    expect(content).toContain("Arbeitsblätter: 1");
    expect(content).toContain("Rezeptblätter: 1");
    expect(content).toContain("Rezeptauswahl: 1");
    expect(content).toContain("Offene Punkte: keine");
    expect(content).toContain("Vegetarische Tomatensuppe");
    expect(content).toContain("Küchenblatt Vegetarische Tomatensuppe");
    expect(content).toContain("Tomaten");
    expect(content).toContain("Veranstaltungstyp als Lunch abgeleitet.");
    expect(content).toContain("Serviceform als Buffet abgeleitet.");
    expect(content).toContain("Zeitangabe in \"gegen 12:30 Uhr\" ist nicht als vollständiger Termin belastbar.");
    expect(content).toContain("Ursprüngliche Intake-Anfrage");
    expect(content).toContain("requestId: presentation-intake-success");
    expect(content).toContain("channel: manual_form");
    expect(content).toContain("Einkaufsliste herunterladen");
    expect(content).not.toContain("Status: unzureichend");
    expect(content).not.toContain("Noch keine Produktionspläne für den aktuellen Vorgang vorhanden.");
  });

  it("keeps a blocked production result visibly blocked instead of looking operationally complete", async () => {
    installBackofficeMocks(true);

    const content = await renderProductionRoute();

    expect(content).toContain("Status: unzureichend");
    expect(content).toContain("Offene Punkte:");
    expect(content).toContain("Teilnehmerzahl bitte noch präzisieren");
    expect(content).not.toContain("Offene Punkte: keine");
    expect(content).not.toContain("Arbeitsblätter: 1");
    expect(content).not.toContain("Rezeptblätter: 1");
  });
});
