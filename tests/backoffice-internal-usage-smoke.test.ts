// @vitest-environment jsdom
import { mkdtempSync, rmSync } from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEventRequestFromManualForm,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type Recipe
} from "@catering/shared-core";
import {
  InMemoryRecipeRepository,
  RecipeDiscoveryService,
  buildProductionArtifacts,
  type WebRecipeSearchProvider
} from "@catering/production-service";
import { App } from "../backoffice-ui/src/App.js";

class EmptyWebProvider implements WebRecipeSearchProvider {
  async searchRecipes() {
    return [];
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-usage-"));
}

function createRecipe(recipe: {
  recipeId: string;
  name: string;
  ingredientName: string;
  dietTags?: string[];
  ingredientId?: string;
}): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: recipe.recipeId,
    name: recipe.name,
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: `internal/${recipe.recipeId}`,
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.96,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: recipe.ingredientId ?? `${recipe.recipeId}-ingredient`,
        name: recipe.ingredientName,
        quantity: {
          amount: 1,
          unit: "kg"
        },
        group: "main",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: `Zubereitung von ${recipe.name}.`
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: [],
    dietTags: recipe.dietTags ?? []
  };
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
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

function findInputByPlaceholder<T extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement>(
  placeholder: string
): T {
  const element = document.querySelector(`[placeholder="${placeholder}"]`) as T | null;
  if (!element) {
    throw new Error(`Field not found: ${placeholder}`);
  }
  return element;
}

async function flush(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function buildUsageFlowFixture() {
  const request = createEventRequestFromManualForm({
    requestId: "usage-manual-1",
    eventType: "conference",
    eventDate: "2026-07-12",
    attendeeCount: 24,
    serviceForm: "buffet",
    menuItems: ["Vegetarische Tomatensuppe"],
    notes: "Bitte vegetarisch"
  });
  const spec = normalizeEventRequestToSpec(request, {
    sourceType: "manual_input",
    reference: request.requestId,
    commercialState: "manual"
  });
  const plannedSpec = {
    ...spec,
    menuPlan: spec.menuPlan.map((item) => ({
      ...item,
      productionDecision: {
        mode: "scratch" as const
      }
    }))
  };

  const dataRoot = createDataRoot();
  const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
  const recipe = createRecipe({
    recipeId: "vegetarische-tomatensuppe-usage",
    name: "Vegetarische Tomatensuppe",
    ingredientName: "Tomaten",
    dietTags: ["vegetarian"]
  });

  return {
    request,
    spec,
    plannedSpec,
    recipe,
    repository,
    dataRoot
  };
}

async function buildArtifactsForFixture(plannedSpec: ReturnType<typeof buildUsageFlowFixture>["plannedSpec"], repository: InMemoryRecipeRepository) {
  await repository.save(createRecipe({
    recipeId: "vegetarische-tomatensuppe-usage",
    name: "Vegetarische Tomatensuppe",
    ingredientName: "Tomaten",
    dietTags: ["vegetarian"]
  }));
  const discovery = new RecipeDiscoveryService(repository, new EmptyWebProvider());
  return buildProductionArtifacts(plannedSpec, discovery);
}

async function renderProductionRoute() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  window.history.pushState({}, "", "/produktion");

  await act(async () => {
    root.render(createElement(App));
    await flush();
  });

  await act(async () => {
    await flush();
  });

  return { root, container };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("backoffice internal usage smoke", () => {
  it("walks one realistic internal catering flow from manual intake to a usable production plan", async () => {
    const fixture = buildUsageFlowFixture();
    const artifacts = await buildArtifactsForFixture(fixture.plannedSpec, fixture.repository);

    let currentRequestId = fixture.request.requestId;
    let currentRequest: typeof fixture.request | undefined;
    let currentSpec: typeof fixture.spec | undefined;
    let currentPlan = undefined as typeof artifacts.productionPlan | undefined;
    let currentPurchaseList = undefined as typeof artifacts.purchaseList | undefined;

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
          return new Response(JSON.stringify({ items: currentRequest ? [currentRequest] : [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/intake/v1/intake/specs")) {
          return new Response(JSON.stringify({ items: currentSpec ? [currentSpec] : [] }), {
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
          if (currentPlan) {
            return new Response(JSON.stringify({ items: [currentPlan] }), {
              status: 200,
              headers: { "content-type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/production/v1/production/purchase-lists")) {
          if (currentPurchaseList) {
            return new Response(JSON.stringify({ items: [currentPurchaseList] }), {
              status: 200,
              headers: { "content-type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/production/v1/production/recipes")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  recipeId: fixture.recipe.recipeId,
                  name: fixture.recipe.name,
                  source: {
                    approvalState: "approved_internal"
                  }
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
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

        if (url.endsWith("/api/intake/v1/intake/specs/manual")) {
          currentRequest = fixture.request;
          currentSpec = fixture.spec;
          return new Response(JSON.stringify({ acceptedEventSpec: currentSpec }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith(`/api/intake/v1/intake/specs/${fixture.spec.specId}`)) {
          currentSpec = fixture.plannedSpec;
          currentPlan = artifacts.productionPlan;
          currentPurchaseList = artifacts.purchaseList;
          return new Response(JSON.stringify({ acceptedEventSpec: currentSpec }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith(`/api/intake/v1/intake/requests/${currentRequestId}`)) {
          return new Response(JSON.stringify(currentRequest ?? fixture.request), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/production/v1/production/plans")) {
          currentPlan = artifacts.productionPlan;
          currentPurchaseList = artifacts.purchaseList;
          return new Response(JSON.stringify({ productionPlan: { planId: artifacts.productionPlan.planId } }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await renderProductionRoute();

    const manualEventType = findInputByPlaceholder<HTMLInputElement>("Veranstaltungstyp, z. B. Konferenz");
    const manualEventDate = findInputByPlaceholder<HTMLInputElement>("Datum, z. B. 2026-10-10");
    const manualAttendeeCount = findInputByPlaceholder<HTMLInputElement>("Teilnehmerzahl");
    const manualServiceForm = findInputByPlaceholder<HTMLInputElement>("Serviceform, z. B. Buffet");
    const manualMenuItems = findInputByPlaceholder<HTMLInputElement>("Menüpunkte, durch Komma getrennt");
    const manualNotes = findInputByPlaceholder<HTMLTextAreaElement>("Interne Notizen oder Einschränkungen");

    await act(async () => {
      setNativeValue(manualEventType, "conference");
      setNativeValue(manualEventDate, "2026-07-12");
      setNativeValue(manualAttendeeCount, "24");
      setNativeValue(manualServiceForm, "buffet");
      setNativeValue(manualMenuItems, "Vegetarische Tomatensuppe");
      setNativeValue(manualNotes, "Bitte vegetarisch");
      findButtonByText("Spezifikation anlegen").click();
      await flush(6);
    });

    expect(document.body.textContent ?? "").toContain("Ursprüngliche Intake-Anfrage");
    expect(document.body.textContent ?? "").toContain("requestId: usage-manual-1");
    expect(document.body.textContent ?? "").toContain("channel: manual_form");
    expect(document.body.textContent ?? "").toContain("Eventtyp: conference");
    expect(document.body.textContent ?? "").toContain("Datum: 2026-07-12");
    expect(document.body.textContent ?? "").toContain("Teilnehmer: 24");
    expect(document.body.textContent ?? "").toContain("Serviceform: buffet");
    expect(document.body.textContent ?? "").toContain("Notizen: Bitte vegetarisch");
    expect(document.body.textContent ?? "").toContain("Status: vollständig");

    await act(async () => {
      findButtonByText("Antworten bearbeiten").click();
      await flush(2);
    });

    const selects = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
    const categorySelect = selects.find((select) => Array.from(select.options).some((option) => option.value === "vegetarian"));
    const productionModeSelect = selects.find((select) =>
      Array.from(select.options).some((option) => option.value === "scratch")
    );
    const recipeSelect = selects.find((select) =>
      Array.from(select.options).some((option) => option.value === fixture.recipe.recipeId)
    );

    if (!categorySelect || !productionModeSelect || !recipeSelect) {
      throw new Error("Required component controls were not rendered");
    }

    await act(async () => {
      setNativeValue(categorySelect, "vegetarian");
      setNativeValue(productionModeSelect, "scratch");
      setNativeValue(recipeSelect, fixture.recipe.recipeId);
      findButtonByText("Speichern und Berechnung starten").click();
      await flush(8);
    });

    expect(document.body.textContent ?? "").toContain("Produktionsplan wurde erzeugt.");
    expect(document.body.textContent ?? "").toContain("Status: vollständig");
    expect(document.body.textContent ?? "").toContain("Offene Punkte: keine");
    expect(document.body.textContent ?? "").toContain("Arbeitsblätter: 1");
    expect(document.body.textContent ?? "").toContain("Rezeptblätter: 1");
    expect(document.body.textContent ?? "").toContain("Rezeptauswahl: 1");
    expect(document.body.textContent ?? "").toContain("Vegetarische Tomatensuppe");
    expect(document.body.textContent ?? "").toContain("Küche, Beschaffung und Klärungen");
    expect(document.body.textContent ?? "").not.toContain("Status: unzureichend");
    expect(document.body.textContent ?? "").not.toContain("fallback");
    expect(document.body.textContent ?? "").not.toContain("blockiert");

    rmSync(fixture.dataRoot, { recursive: true, force: true });
  });
});
