// @vitest-environment jsdom
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEventRequestFromManualForm,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type OfferDraft,
  type Recipe
} from "@catering/shared-core";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  buildProductionArtifacts,
  type WebRecipeSearchProvider
} from "@catering/production-service";
import {
  renderProductionPlanHtml,
  renderPurchaseListCsv
} from "@catering/print-export";
import { App } from "../backoffice-ui/src/App.js";

class EmptyWebProvider implements WebRecipeSearchProvider {
  async searchRecipes() {
    return [];
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-ui-critical-path-"));
}

function createRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "ui-critical-path-tomato-soup",
    name: "Vegetarische Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal/ui-critical-path-tomato-soup",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.97,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "ui-critical-path-tomatoes",
        name: "Tomaten",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten garen, passieren und fuer das Buffet heisshalten."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: [],
    dietTags: ["vegetarian"]
  };
}

function withProductionDecisions(spec: AcceptedEventSpec): AcceptedEventSpec {
  const servings = spec.attendees.expected ?? 0;
  return {
    ...spec,
    menuPlan: spec.menuPlan.map((component) => ({
      ...component,
      menuCategory: "vegetarian" as const,
      serviceStyle: "buffet",
      servings,
      recipeOverrideId: "ui-critical-path-tomato-soup",
      productionDecision: {
        mode: "scratch" as const,
        notes: "UI-Rehearsal nutzt die interne Rezeptbibliothek."
      }
    }))
  };
}

function buildOfferDraft(spec: AcceptedEventSpec): OfferDraft {
  return {
    schemaVersion: SCHEMA_VERSION,
    draftId: "draft-ui-critical-path-lunch-1",
    eventSummary: "UI Critical Path Lunch \u00b7 42 Personen \u00b7 Buffet",
    serviceModules: [],
    proposedEventSpec: spec,
    variantSet: [
      {
        variantId: "variant-accepted",
        label: "Ausgewogener Lunch",
        qualityTier: "standard",
        estimatedPrice: {
          amount: 1260,
          currency: "EUR"
        },
        moduleIds: [],
        proposedEventSpec: spec
      }
    ],
    pricingSummary: {
      subtotal: {
        amount: 1260,
        currency: "EUR"
      },
      perPerson: {
        amount: 30,
        currency: "EUR"
      },
      notes: ["Synthetic UI rehearsal offer."]
    },
    assumptions: [],
    customerFacingText: "Angebotsentwurf fuer synthetischen Lunch.",
    internalWorkingText: "Interne Kalkulationssicht bleibt getrennt.",
    openQuestions: []
  };
}

async function flush(times = 5) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

async function renderAppRoute(pathname: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", pathname);

  await act(async () => {
    root.render(createElement(App));
    await flush();
  });

  await act(async () => {
    await flush();
  });

  return { root, container };
}

function findAnchorByText(text: string): HTMLAnchorElement {
  const anchor = Array.from(document.querySelectorAll("a")).find((el) =>
    (el.textContent ?? "").includes(text)
  );
  if (!anchor) {
    throw new Error(`Link not found: ${text}`);
  }
  return anchor as HTMLAnchorElement;
}

function findButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find((el) =>
    (el.textContent ?? "").includes(text)
  );
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button as HTMLButtonElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("UI critical path rehearsal", () => {
  it("shows the synthetic intake, offer handoff, production, purchase and export evidence path", async () => {
    const dataRoot = createDataRoot();
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    const recipe = createRecipe();
    await repository.save(recipe);

    const request = createEventRequestFromManualForm({
      requestId: "ui-critical-path-request-1",
      customerName: "Synthetic Demo Account",
      eventType: "Business Lunch",
      eventDate: "2026-09-18",
      attendeeCount: 42,
      serviceForm: "Buffet",
      menuItems: ["Vegetarische Tomatensuppe"],
      notes: "Synthetischer UI-Rehearsal-Fall ohne echte Kundendaten."
    });
    const proposedSpec = normalizeEventRequestToSpec(request, {
      sourceType: "manual_input",
      reference: request.requestId,
      commercialState: "provisional"
    });
    const offerDraft = buildOfferDraft(proposedSpec);
    const promotedSpec = withProductionDecisions({
      ...proposedSpec,
      specId: "spec-ui-critical-path-lunch-1",
      lifecycle: {
        commercialState: "accepted"
      },
      sourceLineage: [
        {
          sourceType: "offer_service",
          reference: offerDraft.draftId
        },
        {
          sourceType: "manual_input",
          reference: request.requestId
        }
      ]
    });
    const discovery = new RecipeDiscoveryService(repository, new EmptyWebProvider());
    const artifacts = await buildProductionArtifacts(promotedSpec, discovery);
    const auditEvent = {
      id: "audit-ui-critical-path-plan-created",
      action: "production.plan_created",
      entityId: artifacts.productionPlan.planId,
      entityType: "production_plan",
      actor: {
        name: "Produktions-Mitarbeiter",
        source: "synthetic-ui-rehearsal"
      },
      createdAt: "2026-06-09T08:00:00.000Z"
    };
    const fetchCalls: Array<{ method: string; url: string }> = [];
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
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (
          input instanceof Request ? input.method : init?.method ?? "GET"
        ).toUpperCase();
        fetchCalls.push({ method, url });

        if (method === "GET" && url.endsWith("/api/intake/v1/intake/requests")) {
          return Response.json({ items: [request] });
        }

        if (method === "GET" && url.endsWith("/api/intake/v1/intake/specs")) {
          return Response.json({ items: [promotedSpec] });
        }

        if (method === "GET" && url.endsWith("/api/offers/v1/offers/drafts")) {
          return Response.json({ items: [offerDraft] });
        }

        if (method === "GET" && url.endsWith("/api/production/v1/production/plans")) {
          return Response.json({ items: [artifacts.productionPlan] });
        }

        if (method === "GET" && url.endsWith("/api/production/v1/production/purchase-lists")) {
          return Response.json({ items: [artifacts.purchaseList] });
        }

        if (method === "GET" && url.endsWith("/api/production/v1/production/recipes")) {
          return Response.json({ items: [recipe] });
        }

        if (method === "GET" && url.includes("/api/production/v1/production/audit/events")) {
          return Response.json({ items: [auditEvent] });
        }

        if (method === "GET" && url.endsWith(`/api/intake/v1/intake/requests/${request.requestId}`)) {
          return Response.json(request);
        }

        if (method === "POST" && url.endsWith(`/api/offers/v1/offers/drafts/${offerDraft.draftId}/promote`)) {
          return Response.json(promotedSpec);
        }

        if (method === "GET" && url.endsWith(`/api/exports/v1/exports/offers/${offerDraft.draftId}/html`)) {
          return new Response(`<html><body>${offerDraft.draftId}</body></html>`, {
            headers: { "content-type": "text/html" }
          });
        }

        if (method === "GET" && url.endsWith(`/api/exports/v1/exports/production-plans/${artifacts.productionPlan.planId}/html`)) {
          return new Response(renderProductionPlanHtml(artifacts.productionPlan), {
            headers: { "content-type": "text/html" }
          });
        }

        if (method === "GET" && url.endsWith(`/api/exports/v1/exports/purchase-lists/${artifacts.purchaseList.purchaseListId}/csv`)) {
          return new Response(renderPurchaseListCsv(artifacts.purchaseList), {
            headers: { "content-type": "text/csv" }
          });
        }

        if (
          method === "GET" &&
          (url.endsWith("/api/intake/health") ||
            url.endsWith("/api/offers/health") ||
            url.endsWith("/api/production/health") ||
            url.endsWith("/api/exports/health"))
        ) {
          return Response.json({
            service: "ok",
            status: "ok",
            timestamp: "2026-06-09T08:00:00.000Z",
            counts: {}
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    try {
      const homeRoute = await renderAppRoute("/");
      expect(document.body.textContent ?? "").toContain("Interner Arbeitsstand");
      expect(findAnchorByText("Angebotsagent \u00f6ffnen").getAttribute("href")).toBe("/angebot");
      expect(findAnchorByText("Produktionsagent \u00f6ffnen").getAttribute("href")).toBe("/produktion");

      await act(async () => {
        homeRoute.root.unmount();
      });
      homeRoute.container.remove();

      const offerRoute = await renderAppRoute("/angebot");
      const offerText = document.body.textContent ?? "";
      expect(offerText).toContain("Angebotsagent");
      expect(offerText).toContain("UI Critical Path Lunch");
      expect(offerText).toContain(offerDraft.draftId);
      expect(offerText).toContain("42 Personen");
      expect(offerText).toContain("Export: Angebots-HTML");
      expect(offerText).toContain("Entwurfs-Spezifikation");
      expect(offerText).toContain("manual_input");
      expect(offerText).toContain("Grenze: nur interne Demo- oder Testdaten");
      expect(findAnchorByText("Angebot exportieren").getAttribute("href")).toBe(
        `/api/exports/v1/exports/offers/${offerDraft.draftId}/html`
      );

      await act(async () => {
        findButtonByText("Variante \u00fcbernehmen: Ausgewogener Lunch").click();
        await flush(6);
      });

      expect(fetchCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: "POST",
            url: `/api/offers/v1/offers/drafts/${offerDraft.draftId}/promote`
          })
        ])
      );
      expect(document.body.textContent ?? "").toContain(
        "Angebotsvariante wurde als operative Spezifikation \u00fcbernommen."
      );
      expect(findAnchorByText("Zur Produktion").getAttribute("href")).toBe("/produktion");

      await act(async () => {
        offerRoute.root.unmount();
      });
      offerRoute.container.remove();

      const productionRoute = await renderAppRoute("/produktion");
      const productionText = document.body.textContent ?? "";
      expect(productionText).toContain("Was braucht die Produktion als N\u00e4chstes?");
      expect(productionText).toContain("Urspr\u00fcngliche Intake-Anfrage");
      expect(productionText).toContain("Intake-Ursprung: manuelle Eingabe");
      expect(productionText).not.toContain(`requestId: ${request.requestId}`);
      expect(productionText).toContain("Eventtyp: Business Lunch");
      expect(productionText).toContain("Datum: 2026-09-18");
      expect(productionText).toContain("Teilnehmerzahl: 42");
      expect(productionText).toContain("Vegetarische Tomatensuppe");
      expect(productionText).toContain("Status: vollst\u00e4ndig");
      expect(productionText).toContain("Arbeitsbl\u00e4tter: 1");
      expect(productionText).toContain("Rezeptbl\u00e4tter: 1");
      expect(productionText).toContain("Rezeptauswahl: 1");
      expect(productionText).toContain("Produktionsblatt exportieren");
      expect(productionText).toContain("Einkaufsliste exportieren");
      expect(productionText).toContain("Tomaten");
      expect(productionText).toContain("Rezeptquelle:");
      expect(productionText).toContain("Internes Rezept freigegeben");
      expect(productionText).toContain("internal/ui-critical-path-tomato-soup");
      expect(productionText).toContain("Audit-Spur");
      expect(productionText).toContain("production.plan_created");
      expect(productionText).toContain("Beta-Endpunkt");
      const productionExportLink = findAnchorByText("Produktionsblatt exportieren");
      const purchaseExportLink = findAnchorByText("Einkaufsliste exportieren");
      expect(productionExportLink.getAttribute("href")).toBe(
        `/api/exports/v1/exports/production-plans/${artifacts.productionPlan.planId}/html`
      );
      expect(purchaseExportLink.getAttribute("href")).toBe(
        `/api/exports/v1/exports/purchase-lists/${artifacts.purchaseList.purchaseListId}/csv`
      );

      const productionExport = await fetch(productionExportLink.getAttribute("href") ?? "");
      const purchaseExport = await fetch(purchaseExportLink.getAttribute("href") ?? "");
      const productionExportHtml = await productionExport.text();
      expect(productionExportHtml).toContain("Rezeptquelle:");
      expect(productionExportHtml).not.toContain("real customer");
      const purchaseCsv = await purchaseExport.text();
      expect(purchaseCsv).toContain("source_recipes");
      expect(purchaseCsv).toContain("source_recipe_origins");
      expect(purchaseCsv).toContain("ui-critical-path-tomato-soup");
      expect(purchaseCsv).toContain("Internes Rezept freigegeben");

      expect(fetchCalls.every((call) => call.url.startsWith("/api/"))).toBe(true);
      expect(fetchCalls.map((call) => call.url).join("\n")).not.toContain("openai");
      expect(fetchCalls.map((call) => call.url).join("\n")).not.toContain("duckduckgo");

      await act(async () => {
        productionRoute.root.unmount();
      });
      productionRoute.container.remove();
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  }, 15000);
});
