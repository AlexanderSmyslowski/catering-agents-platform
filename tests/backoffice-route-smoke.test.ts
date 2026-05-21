// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";

type RouteSmokeDashboardFixture = {
  intakeRequests?: Array<Record<string, unknown>>;
  acceptedSpecs?: Array<Record<string, unknown>>;
  offerDrafts?: Array<Record<string, unknown>>;
  productionPlans?: Array<Record<string, unknown>>;
  purchaseLists?: Array<Record<string, unknown>>;
  recipes?: Array<Record<string, unknown>>;
  auditEvents?: Array<Record<string, unknown>>;
};

function installBackofficeEnvironmentMocks(fixture: RouteSmokeDashboardFixture = {}) {
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

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/intake/v1/intake/requests")) {
        return new Response(JSON.stringify({ items: fixture.intakeRequests ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/intake/v1/intake/specs")) {
        return new Response(JSON.stringify({ items: fixture.acceptedSpecs ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/offers/v1/offers/drafts")) {
        return new Response(JSON.stringify({ items: fixture.offerDrafts ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/plans")) {
        return new Response(JSON.stringify({ items: fixture.productionPlans ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return new Response(JSON.stringify({ items: fixture.purchaseLists ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/production/v1/production/recipes")) {
        return new Response(JSON.stringify({ items: fixture.recipes ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.includes("/api/production/v1/production/audit/events")) {
        return new Response(JSON.stringify({ items: fixture.auditEvents ?? [] }), {
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

      throw new Error(`Unexpected fetch: ${url}`);
    })
  );
}

async function renderRoute(pathname: string): Promise<{ text: string; html: string }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", pathname);

  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
    await Promise.resolve();
  });

  const result = {
    text: document.body.textContent ?? "",
    html: document.body.innerHTML
  };

  await act(async () => {
    root.unmount();
  });
  container.remove();

  return result;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("backoffice route smoke", () => {
  it("renders the three core routes with stable markers", async () => {
    installBackofficeEnvironmentMocks();

    const home = (await renderRoute("/")).text;
    expect(home).toContain("Catering-Agenten");
    expect(home).toMatch(/gemeinsam.*regelkern/i);

    const offer = await renderRoute("/angebot");
    expect(offer.text).toContain("Angebotsagent");
    expect(offer.text).toContain("Kundenanfrage einfügen und ruhigen Entwurf erzeugen");
    expect(offer.text).not.toContain("Catering-Betriebssystem");
    expect(offer.html).not.toContain("Bearbeitername");
    expect(offer.text).not.toContain("Demo-Daten laden");
    expect(offer.text).not.toContain("Aktualisieren");
    expect(offer.text).not.toContain("Ruhige Workbench für Kundenanfragen und Angebotsentwürfe.");

    const production = (await renderRoute("/produktion")).text;
    expect(production).toContain("Produktionsagent");
    expect(production).toContain("Was braucht die Produktion als Nächstes?");
    expect(production).toContain("production-calm-summary");
    expect(production).toContain("Bestehende Spezifikationen, Pläne und Rezepte durchsuchen.");
  });

  it("keeps the offer route anchored on existing drafts and operative handoff status", async () => {
    installBackofficeEnvironmentMocks({
      acceptedSpecs: [
        { specId: "offer-spec-complete", readiness: { status: "complete" }, event: { type: "lunch" } },
        { specId: "offer-spec-partial", readiness: { status: "partial" }, event: { type: "meeting" } }
      ],
      offerDrafts: [
        {
          draftId: "offer-draft-buffet",
          eventSummary: "Sommerfest mit Buffet",
          variantSet: [
            {
              variantId: "basis",
              label: "Basis"
            }
          ],
          openQuestions: ["Getränkepaket noch klären"]
        }
      ]
    });

    const offer = (await renderRoute("/angebot")).text;

    expect(offer).toContain("Zusammenfassung");
    expect(offer).toContain("Sommerfest mit Buffet · 1 Varianten · 1 offene Punkte");
    expect(offer).toContain("Übergabe: 1 vollständig · 1 teilweise");
    expect(offer).toContain("offer-draft-buffet");
    expect(offer).toContain("Ausgewählter Entwurf");
    expect(offer).toContain("Variante übernehmen: Basis");
    expect(offer).toContain("Angebot exportieren");
    expect(offer).toContain("Operative Übergabe und Audit");
    expect(offer).toContain("Status: vollständig");
    expect(offer).toContain("Status: teilweise vollständig");
    expect(offer).not.toContain("1 Entwürfe mit Varianten und Export stehen bereit.");
    expect(offer).not.toContain("Angebotsdienst");
  });

  it("keeps the start overview anchored on existing operational counts", async () => {
    installBackofficeEnvironmentMocks({
      intakeRequests: [
        {
          requestId: "start-intake-old",
          source: { channel: "email", receivedAt: "2026-07-01T09:00:00.000Z" }
        },
        {
          requestId: "start-intake-new",
          source: { channel: "manual_form", receivedAt: "2026-07-01T10:00:00.000Z" }
        }
      ],
      acceptedSpecs: [
        { specId: "start-spec-complete", readiness: { status: "complete" } },
        { specId: "start-spec-partial", readiness: { status: "partial" } }
      ],
      offerDrafts: [{ draftId: "start-offer-1" }],
      productionPlans: [{ planId: "start-plan-1" }],
      recipes: [
        { recipeId: "start-recipe-approved", source: { approvalState: "approved_internal" } },
        { recipeId: "start-recipe-review", source: { approvalState: "review_required" } }
      ],
      auditEvents: [
        {
          auditId: "start-audit-1",
          summary: "Demo-Daten geladen",
          action: "seed_demo",
          at: "2026-07-01T10:05:00.000Z",
          actor: { name: "Mia" }
        }
      ]
    });

    const home = (await renderRoute("/")).text;

    expect(home).toContain("Operative Spezifikationen");
    expect(home).toContain("2 operative Datensätze stehen dienstübergreifend bereit.");
    expect(home).toContain("1 vollständig · 1 teilweise vollständig");
    expect(home).toContain("1 kaufmännische Entwürfe können direkt übernommen werden.");
    expect(home).toContain("1 Küchenpläne mit Rezept- und Einkaufsbezug sind verfügbar.");
    expect(home).toContain("2 Rezepte · 1 intern freigegeben · 1 Prüfung nötig");
    expect(home).toContain("letzte Erfassung: start-intake-new via manual_form");
    expect(home).toContain("1 Änderungen geladen · neueste: Demo-Daten geladen");
  });
});
