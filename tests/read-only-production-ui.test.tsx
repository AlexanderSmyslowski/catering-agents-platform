// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../backoffice-ui/src/App.js";
import {
  loadProductionRouteAccessData,
  type ProductionRouteAccessData
} from "../backoffice-ui/src/api.js";
import { ProductionReadOnlyView } from "../backoffice-ui/src/production-read-only-view.js";

const roots: Root[] = [];

const authenticatedSession = {
  authenticated: true,
  user: { userId: "production-reader", displayName: "Produktionsleser" },
  access: { capabilities: ["production_read"] }
};

type BrowserCall = {
  url: string;
  method: string;
  credentials?: RequestCredentials;
  identityHeaders: string[];
};

function identityHeaders(init?: RequestInit) {
  return [...new Headers(init?.headers).keys()].filter((name) =>
    name === "authorization" ||
    name === "x-actor-name" ||
    name.startsWith("x-catering-") ||
    /(?:actor|subject|role|business|identity)/u.test(name)
  );
}

beforeEach(() => {
  const storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    }
  });
});

function productionPlan() {
  return {
    schemaVersion: "1.0",
    planId: "plan-reader",
    eventSpecId: "spec-reader",
    readiness: { status: "complete", reasons: [] },
    productionBatches: [],
    timeline: [],
    recipeSelections: [],
    unresolvedItems: [],
    kitchenSheets: [{
      title: "Roastbeef rosa",
      instructions: [
        "35 Minuten bei 230 °C garen, bis 54 °C Kerntemperatur erreicht sind.",
        "<img src=x onerror=alert('nicht-ausführen')>"
      ],
      componentId: "component-roastbeef",
      productionQty: { amount: 45, unit: "Portionen" },
      station: "Warme Küche",
      prepWindow: "09:00–11:00 Uhr",
      ingredients: [{
        ingredientId: "ingredient-roastbeef",
        name: "Roastbeef",
        quantity: { amount: 3_100, unit: "g" },
        group: "Fleisch"
      }],
      steps: [{
        index: 1,
        instruction: "Roastbeef vorbereiten und kontrolliert garen.",
        durationMinutes: 35
      }],
      allergens: ["egg", "mustard", "milk", "nuts"]
    }]
  };
}

function purchaseList() {
  return {
    schemaVersion: "1.0",
    purchaseListId: "purchase-reader",
    eventSpecId: "spec-reader",
    groupingMode: "group",
    totals: { itemCount: 1, groups: ["Fleisch"] },
    items: [{
      ingredientId: "ingredient-roastbeef",
      displayName: "Roastbeef",
      normalizedQty: 3.1,
      normalizedUnit: "kg",
      purchaseQty: 3.1,
      purchaseUnit: "kg",
      group: "Fleisch",
      supplierHint: "Metzgerei",
      sourceRecipes: ["recipe-roastbeef"],
      mappingConfidence: 1
    }]
  };
}

async function renderReader(data: ProductionRouteAccessData) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(createElement(ProductionReadOnlyView, {
      productionPlans: data.productionPlans,
      purchaseLists: data.purchaseLists
    }));
  });
  return container;
}

async function renderProductionRoute(
  responder: (url: string, init?: RequestInit) => Promise<Response> | Response,
  pathname = "/produktion"
) {
  window.history.replaceState({}, "", pathname);
  const calls: BrowserCall[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      credentials: init?.credentials,
      identityHeaders: identityHeaders(init)
    });
    if (url.endsWith("/api/intake/v1/auth/session")) {
      return Response.json(authenticatedSession);
    }
    return responder(url, init);
  }));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(createElement(App));
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, calls };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gate B production read-only UI", () => {
  it("loads only projected plans and purchase lists for read-only access", async () => {
    const calls: BrowserCall[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? "GET",
        credentials: init?.credentials,
        identityHeaders: identityHeaders(init)
      });
      if (url.endsWith("/api/production/v1/production/plans")) {
        return Response.json({
          access: { canOperateProduction: false },
          items: [productionPlan()],
          hiddenIntakePricingSentinel: "8.192,44 EUR"
        });
      }
      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return Response.json({ items: [purchaseList()] });
      }
      throw new Error(`Unerwarteter Read-only-Abruf: ${url}`);
    }));

    const result = await loadProductionRouteAccessData();

    expect(result.access.canOperateProduction).toBe(false);
    expect(result.productionPlans).toHaveLength(1);
    expect(result.purchaseLists).toHaveLength(1);
    expect(calls).toEqual([
      {
        url: "/api/production/v1/production/plans",
        method: "GET",
        credentials: "same-origin",
        identityHeaders: []
      },
      {
        url: "/api/production/v1/production/purchase-lists",
        method: "GET",
        credentials: "same-origin",
        identityHeaders: []
      }
    ]);
    expect(JSON.stringify(result)).not.toContain("8.192,44 EUR");
  });

  it("renders executable kitchen and purchase facts without actions or exports", async () => {
    const container = await renderReader({
      access: { canOperateProduction: false },
      productionPlans: [productionPlan()] as never,
      purchaseLists: [purchaseList()] as never
    });

    expect(container.textContent).toContain("Roastbeef rosa");
    expect(container.textContent).toContain("45 Portionen");
    expect(container.textContent).toContain("3.100 g");
    expect(container.textContent).toContain("09:00–11:00 Uhr");
    expect(container.textContent).toContain("35 Minuten");
    expect(container.textContent).toContain("230 °C");
    expect(container.textContent).toContain("54 °C");
    expect(container.textContent).toContain("Ei");
    expect(container.textContent).toContain("Senf");
    expect(container.textContent).toContain("Milch");
    expect(container.textContent).toContain("Nüsse");
    expect(container.textContent).toContain("3,1 kg");
    expect(container.textContent).toContain("Metzgerei");
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert('nicht-ausführen')>");
    expect(container.textContent).not.toMatch(/Freigeben|Übernehmen|Review entscheiden|Exportieren/);
  });

  it.each([
    {},
    { access: {} },
    { access: { canOperateProduction: null } },
    { access: { canOperateProduction: "false" } }
  ])("fails closed for an invalid access context %#", async (plansResponse) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("same-origin");
      expect(identityHeaders(init)).toEqual([]);
      return Response.json(plansResponse);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadProductionRouteAccessData()).rejects.toThrow("Produktionszugriff");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not load reader follow-up data for an operative production user", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(init?.credentials).toBe("same-origin");
      expect(identityHeaders(init)).toEqual([]);
      calls.push(url);
      if (url.endsWith("/api/production/v1/production/plans")) {
        return Response.json({ access: { canOperateProduction: true }, items: [productionPlan()] });
      }
      throw new Error(`Unerwarteter operativer Access-Abruf: ${url}`);
    }));

    const result = await loadProductionRouteAccessData();

    expect(result.access.canOperateProduction).toBe(true);
    expect(result.purchaseLists).toEqual([]);
    expect(calls).toEqual(["/api/production/v1/production/plans"]);
  });

  it("mounts the read-only route without workbench actions, exports, or hidden follow-up requests", async () => {
    const { container, calls } = await renderProductionRoute((url) => {
      if (url.endsWith("/api/production/v1/production/plans")) {
        return Response.json({ access: { canOperateProduction: false }, items: [productionPlan()] });
      }
      if (url.endsWith("/api/production/v1/production/purchase-lists")) {
        return Response.json({ items: [purchaseList()] });
      }
      throw new Error(`Unerwarteter UI-Read-only-Abruf: ${url}`);
    });

    expect(container.textContent).toContain("Nur-Lese-Zugriff");
    expect(container.textContent).toContain("Roastbeef rosa");
    expect(container.textContent).not.toContain("Produktionsassistent");
    expect(container.querySelector("form")).toBeNull();
    expect([...container.querySelectorAll("a")].some((link) => link.href.includes("/exports/"))).toBe(false);
    expect([...container.querySelectorAll("button")].map((button) => button.textContent?.trim())).toEqual(["Abmelden"]);
    expect(calls).toEqual([
      {
        url: "/api/intake/v1/auth/session",
        method: "GET",
        credentials: "same-origin",
        identityHeaders: []
      },
      {
        url: "/api/production/v1/production/plans",
        method: "GET",
        credentials: "same-origin",
        identityHeaders: []
      },
      {
        url: "/api/production/v1/production/purchase-lists",
        method: "GET",
        credentials: "same-origin",
        identityHeaders: []
      }
    ]);
  });

  it("keeps the route fail-closed when the server access context is missing", async () => {
    const { container, calls } = await renderProductionRoute((url) => {
      if (url.endsWith("/api/production/v1/production/plans")) {
        return Response.json({ items: [productionPlan()] });
      }
      throw new Error(`Unerwarteter Folgeabruf ohne Access-Context: ${url}`);
    });

    expect(container.textContent).toContain("Produktionszugriff konnte nicht eindeutig bestimmt werden");
    expect(container.textContent).not.toContain("Produktionsassistent");
    expect(container.textContent).not.toContain("Roastbeef rosa");
    expect(calls).toEqual([
      {
        url: "/api/intake/v1/auth/session",
        method: "GET",
        credentials: "same-origin",
        identityHeaders: []
      },
      {
        url: "/api/production/v1/production/plans",
        method: "GET",
        credentials: "same-origin",
        identityHeaders: []
      }
    ]);
  });

  it("keeps the existing production workbench for an operative capability", async () => {
    const { container, calls } = await renderProductionRoute((url) => {
      if (url.endsWith("/api/production/v1/production/plans")) {
        return Response.json({ access: { canOperateProduction: true }, items: [] });
      }
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [] });
      }
      if (url.endsWith("/api/production/health")) {
        return Response.json({ service: "production", status: "ok", timestamp: "", counts: {} });
      }
      throw new Error(`Unerwarteter operativer UI-Abruf: ${url}`);
    });

    expect(container.textContent).toContain("Produktionsassistent");
    expect(container.textContent).not.toContain("Nur-Lese-Zugriff");
    expect(calls.some(({ url }) => url.includes("/api/intake/") && !url.endsWith("/auth/session"))).toBe(false);
    expect(calls.some(({ url }) => url.endsWith("/api/production/v1/production/cases"))).toBe(true);
    expect(calls.every((call) => call.credentials === "same-origin" && call.identityHeaders.length === 0)).toBe(true);
  });

  it("does not let the mounted operative workbench reload Intake request details", async () => {
    const { container, calls } = await renderProductionRoute((url) => {
      if (url.endsWith("/api/production/v1/production/plans")) {
        return Response.json({ access: { canOperateProduction: true }, items: [] });
      }
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [{ caseId: "case-a", product: "production", displayName: "A", status: "open", createdAt: "", updatedAt: "" }] });
      }
      if (url.endsWith("/api/production/v1/production/cases/case-a")) {
        return Response.json({
          case: {
            schemaVersion: "1.0",
            businessId: "local",
            caseId: "case-a",
            product: "production",
            displayName: "A",
            status: "open",
            version: 2,
            createdAt: "",
            updatedAt: "",
            sourceSpecId: "spec-a"
          },
          events: [{
            businessId: "local",
            eventId: "event-a",
            caseId: "case-a",
            sequence: 2,
            at: "",
            role: "assistant",
            kind: "draft_created",
            text: "Entwurf erstellt.",
            artifactId: "draft-a",
            revisionRef: {
              artifactType: "ProductionDraft",
              artifactId: "draft-a",
              revision: 1,
              createdAt: ""
            }
          }]
        });
      }
      if (url.endsWith("/api/production/v1/production/drafts?caseId=case-a")) {
        return Response.json({
          items: [{
            businessId: "local",
            draftId: "draft-a",
            revision: 1,
            status: "pending_review",
            createdAt: "",
            source: { kind: "handoff", receivedAt: "" },
            reviewCards: [],
            draftArtifacts: {
              eventSpec: {
                schemaVersion: "1.0",
                specId: "spec-a",
                lifecycle: { commercialState: "accepted" },
                readiness: { status: "complete", reasons: [] },
                sourceLineage: [{ sourceType: "manual_input", reference: "request-price-sentinel" }],
                event: { title: "Operativer Auftrag" },
                attendees: { expected: 45 },
                servicePlan: { eventType: "Dinner", serviceForm: "Buffet", modules: [] },
                menuPlan: []
              }
            }
          }],
          approvedProductionSpecs: []
        });
      }
      if (url.endsWith("/api/production/health")) {
        return Response.json({ service: "production", status: "ok", timestamp: "", counts: {} });
      }
      if (url.includes("/api/intake/")) {
        return Response.json({ requestId: "request-price-sentinel", targetBudget: "8.192,44 EUR" });
      }
      throw new Error(`Unerwarteter operativer Workspace-Abruf: ${url}`);
    }, "/produktion?productionCaseId=case-a");

    expect(container.textContent).toContain("Produktionsassistent");
    expect(calls.some(({ url }) => url.includes("/api/intake/") && !url.endsWith("/auth/session"))).toBe(false);
    expect(container.textContent).not.toContain("8.192,44 EUR");
    expect(container.innerHTML).not.toContain("8.192,44 EUR");
    expect(calls.every((call) => call.credentials === "same-origin" && call.identityHeaders.length === 0)).toBe(true);
  });
});
