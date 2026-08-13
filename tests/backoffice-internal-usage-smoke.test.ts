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
  type ProductionDraft,
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

function findAnchorByText(text: string): HTMLAnchorElement {
  const anchor = Array.from(document.querySelectorAll("a")).find((el) =>
    (el.textContent ?? "").includes(text)
  );
  if (!anchor) {
    throw new Error(`Link not found: ${text}`);
  }
  return anchor as HTMLAnchorElement;
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
  const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
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
  await repository.save({ businessId: "local" }, createRecipe({
    recipeId: "vegetarische-tomatensuppe-usage",
    name: "Vegetarische Tomatensuppe",
    ingredientName: "Tomaten",
    dietTags: ["vegetarian"]
  }));
  const discovery = new RecipeDiscoveryService(repository, new EmptyWebProvider());
  return buildProductionArtifacts(plannedSpec, discovery, { context: { businessId: "local" } });
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

async function renderProductionRoute() {
  return renderAppRoute("/produktion");
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("backoffice internal usage smoke", () => {
  it("walks one realistic internal catering flow into the reviewed ProductionDraft boundary", async () => {
    const fixture = buildUsageFlowFixture();
    const artifacts = await buildArtifactsForFixture(fixture.plannedSpec, fixture.repository);

    let currentRequestId = fixture.request.requestId;
    let currentRequest: typeof fixture.request | undefined;
    let currentSpec: typeof fixture.spec | undefined;
    let currentPlan = undefined as typeof artifacts.productionPlan | undefined;
    let currentPurchaseList = undefined as typeof artifacts.purchaseList | undefined;
    let activeProductionCaseId: string | undefined;
    let productionDrafts: ProductionDraft[] = [];
    let createdPlanViaPost = false;
    const fetchCalls: Array<{ method: string; url: string; body?: unknown }> = [];

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
        let body: unknown;
        if (typeof init?.body === "string") {
          try {
            body = JSON.parse(init.body);
          } catch {
            body = init.body;
          }
        }
        fetchCalls.push({ method, url, body });

        if (method === "GET" && url.endsWith("/api/production/v1/production/cases")) {
          return new Response(
            JSON.stringify({
              items: activeProductionCaseId && currentSpec
                ? [
                    {
                      caseId: activeProductionCaseId,
                      product: "production",
                      displayName: "Konferenz - 12.07.2026 - 24 Personen",
                      status: "open",
                      createdAt: "2026-04-10T09:34:00.000Z",
                      updatedAt: "2026-04-10T09:34:00.000Z"
                    }
                  ]
                : []
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (
          method === "GET" &&
          activeProductionCaseId &&
          url.endsWith(`/api/production/v1/production/cases/${activeProductionCaseId}`)
        ) {
          return new Response(
            JSON.stringify({
              case: {
                schemaVersion: "1.0",
                businessId: "local",
                caseId: activeProductionCaseId,
                product: "production",
                displayName: "Konferenz - 12.07.2026 - 24 Personen",
                status: "open",
                version: 1,
                createdAt: "2026-04-10T09:34:00.000Z",
                updatedAt: "2026-04-10T09:34:00.000Z",
                sourceSpecId: currentSpec?.specId,
                ...(currentPlan ? { currentPlanId: currentPlan.planId } : {}),
                ...(currentPurchaseList ? { currentPurchaseListId: currentPurchaseList.purchaseListId } : {})
              },
              events: [
                {
                  businessId: "local",
                  eventId: "production-case-usage-source",
                  caseId: activeProductionCaseId,
                  sequence: 1,
                  at: "2026-04-10T09:34:00.000Z",
                  role: "system",
                  kind: "source_added",
                  text: "Quelle verknüpft.",
                  sourceRef: {
                    sourceId: "source-production-usage",
                    requestId: currentRequest?.requestId,
                    dataClass: "synthetic_demo",
                    addedAt: "2026-04-10T09:34:00.000Z"
                  }
                }
              ],
              ...(productionDrafts.at(-1) ? { currentDraft: productionDrafts.at(-1) } : {})
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (method === "GET" && url.endsWith("/api/intake/v1/intake/requests")) {
          return new Response(JSON.stringify({ items: currentRequest ? [currentRequest] : [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "GET" && url.endsWith("/api/intake/v1/intake/specs")) {
          return new Response(JSON.stringify({ items: currentSpec ? [currentSpec] : [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (
          method === "GET" &&
          currentSpec &&
          url.endsWith(`/api/intake/v1/intake/specs/${currentSpec.specId}`)
        ) {
          return new Response(JSON.stringify(currentSpec), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "GET" && url.endsWith("/api/offers/v1/offers/drafts")) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "GET" && url.endsWith("/api/production/v1/production/plans")) {
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

        if (
          method === "GET" &&
          activeProductionCaseId &&
          url === `/api/production/v1/production/drafts?caseId=${activeProductionCaseId}`
        ) {
          return new Response(JSON.stringify({ items: productionDrafts, approvedProductionSpecs: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "GET" && url.endsWith("/api/production/v1/production/purchase-lists")) {
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

        if (method === "GET" && url.endsWith("/api/production/v1/production/recipes")) {
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
          method === "GET" &&
          (url.endsWith("/api/intake/health") ||
            url.endsWith("/api/offers/health") ||
            url.endsWith("/api/production/health") ||
            url.endsWith("/api/exports/health"))
        ) {
          return new Response(
            JSON.stringify({ service: "ok", status: "ok", timestamp: "2026-04-10T09:30:00.000Z", counts: {} }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (method === "POST" && url.endsWith("/api/intake/v1/intake/specs/manual")) {
          currentRequest = fixture.request;
          currentSpec = fixture.spec;
          return new Response(JSON.stringify({ acceptedEventSpec: currentSpec }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "PATCH" && url.endsWith(`/api/intake/v1/intake/specs/${fixture.spec.specId}`)) {
          const patchBody = body as
            | {
                componentUpdates?: Array<{
                  componentId?: string;
                  menuCategory?: "classic" | "vegetarian" | "vegan";
                  productionMode?: "scratch" | "hybrid" | "convenience_purchase" | "external_finished";
                  recipeOverrideId?: string;
                }>;
              }
            | undefined;
          const componentUpdates = new Map(
            (patchBody?.componentUpdates ?? [])
              .filter((update) => typeof update.componentId === "string")
              .map((update) => [String(update.componentId), update])
          );
          currentSpec = {
            ...fixture.plannedSpec,
            menuPlan: fixture.plannedSpec.menuPlan.map((item) => {
              const update = componentUpdates.get(item.componentId);
              if (!update) {
                return item;
              }
              return {
                ...item,
                menuCategory: update.menuCategory ?? item.menuCategory,
                productionDecision: update.productionMode
                  ? { mode: update.productionMode }
                  : item.productionDecision,
                recipeOverrideId: update.recipeOverrideId ?? item.recipeOverrideId
              };
            })
          };
          return new Response(JSON.stringify({ acceptedEventSpec: currentSpec }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "GET" && url.endsWith(`/api/intake/v1/intake/requests/${currentRequestId}`)) {
          return new Response(JSON.stringify(currentRequest ?? fixture.request), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "POST" && url.endsWith("/api/production/v1/production/cases")) {
          activeProductionCaseId = "production-case-usage";
          return new Response(JSON.stringify({ case: { caseId: "production-case-usage" } }), {
            status: 201,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "POST" && url.endsWith("/api/production/v1/production/drafts")) {
          const importedDraft: ProductionDraft = {
            schemaVersion: SCHEMA_VERSION,
            businessId: "local",
            draftId: "production-draft-imported-usage",
            revision: 1,
            status: "pending_review",
            createdAt: "2026-04-10T09:34:00.000Z",
            source: {
              kind: "manual_import",
              receivedAt: "2026-04-10T09:34:00.000Z",
              sourceRef: `spec:${currentSpec?.specId ?? fixture.spec.specId}`
            },
            guardrails: {
              draftOnly: true,
              humanApprovalRequired: true,
              writesProductObjects: false,
              rawProviderPayloadStored: false,
              knowledgeWritePolicy: "reviewed_only"
            },
            reviewCards: [],
            draftArtifacts: {
              eventSpec: currentSpec ?? fixture.plannedSpec
            }
          };
          productionDrafts = [importedDraft];
          return new Response(JSON.stringify({ draft: importedDraft }), {
            status: 201,
            headers: { "content-type": "application/json" }
          });
        }

        if (
          method === "POST" &&
          url.endsWith(`/api/production/v1/production/drafts/${productionDrafts[0]?.draftId}/prepare`)
        ) {
          const sourceDraft = productionDrafts[0]!;
          const preparedDraft: ProductionDraft = {
            ...sourceDraft,
            draftId: "production-draft-prepared-usage",
            revision: sourceDraft.revision! + 1,
            createdAt: "2026-04-10T09:35:00.000Z",
            supersedesDraftId: sourceDraft.draftId,
            reviewCards: [
              {
                cardId: "card-prepared-event-spec",
                kind: "event_data",
                title: "Eventdaten prüfen",
                summary: "Eventdaten des vollständigen Produktions-Snapshots prüfen.",
                decision: "pending",
                requiredApproval: true
              },
              {
                cardId: "card-prepared-plan",
                kind: "timeline",
                title: "Produktionsplan prüfen",
                summary: "Ablauf und Zeiten fachlich bestätigen.",
                decision: "pending",
                requiredApproval: true
              },
              {
                cardId: "card-prepared-purchase-list",
                kind: "purchase_item",
                title: "Einkaufsliste prüfen",
                summary: "Mengen und Warengruppen fachlich bestätigen.",
                decision: "pending",
                requiredApproval: true
              },
              {
                cardId: "card-prepared-recipe",
                kind: "recipe",
                title: "Vegetarische Tomatensuppe prüfen",
                summary: "Rezept und Mengen fachlich bestätigen.",
                decision: "pending",
                requiredApproval: true
              }
            ],
            draftArtifacts: {
              eventSpec: currentSpec ?? fixture.plannedSpec,
              productionPlan: artifacts.productionPlan,
              purchaseList: artifacts.purchaseList,
              recipes: [fixture.recipe]
            }
          };
          productionDrafts = [{ ...sourceDraft, status: "superseded" }, preparedDraft];
          return new Response(JSON.stringify({ draft: preparedDraft }), {
            status: 201,
            headers: { "content-type": "application/json" }
          });
        }

        if (method === "POST" && url.endsWith("/api/production/v1/production/plans")) {
          createdPlanViaPost = true;
          currentPlan = artifacts.productionPlan;
          currentPurchaseList = artifacts.purchaseList;
          return new Response(JSON.stringify({ productionPlan: artifacts.productionPlan }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const homeRoute = await renderAppRoute("/");

    expect(document.body.textContent ?? "").toContain("Neuen Auftrag beginnen");
    expect(document.body.textContent ?? "").toContain("Frühere Aufträge");
    expect(document.body.textContent ?? "").not.toContain("Bestandsdaten im Hintergrund");
    const offerStartLink = findAnchorByText("Neuen Auftrag beginnen");
    expect(offerStartLink.getAttribute("href")).toBe("/angebot");

    await act(async () => {
      homeRoute.root.unmount();
    });
    homeRoute.container.remove();

    const offerRoute = await renderAppRoute(offerStartLink.getAttribute("href") ?? "/angebot");

    expect(document.body.textContent ?? "").toContain("Angebotsagent");
    expect(document.body.textContent ?? "").toContain("Kundenanfrage einfügen und Entwurf prüfen");
    expect(document.body.textContent ?? "").toContain("Produktionsagent");
    const productionHandoffLink = findAnchorByText("Produktionsagent");
    expect(productionHandoffLink.getAttribute("href")).toBe("/produktion");

    await act(async () => {
      offerRoute.root.unmount();
    });
    offerRoute.container.remove();

    const productionRoute = await renderAppRoute(productionHandoffLink.getAttribute("href") ?? "/produktion");

    expect(document.body.textContent ?? "").toContain("Angebot hochladen oder Produktionsauftrag beschreiben");
    expect(document.body.textContent ?? "").not.toContain("Bestandsdaten im Hintergrund");
    expect(document.body.textContent ?? "").toContain("Angebot als KI-Entwurf prüfen");

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
      findButtonByText("Manuellen Auftrag anlegen").click();
      await flush(6);
    });

    expect(document.body.textContent ?? "").toContain("Ursprüngliche Intake-Anfrage");
    expect(document.body.textContent ?? "").toContain("Intake-Ursprung: manuelle Eingabe");
    expect(document.body.textContent ?? "").not.toContain("requestId: usage-manual-1");
    expect(document.body.textContent ?? "").not.toContain("channel: manual_form");
    expect(document.body.textContent ?? "").toContain("Eventtyp: Konferenz");
    expect(document.body.textContent ?? "").toContain("Datum: 2026-07-12");
    expect(document.body.textContent ?? "").toContain("Teilnehmerzahl: 24 · Serviceform: Buffet · Readiness: Prüfung nötig");
    expect(document.body.textContent ?? "").toContain("Status: Prüfung nötig");
    expect(document.body.textContent ?? "").toContain("Rückfragen beantworten");

    await act(async () => {
      findButtonByText("Rückfragen beantworten").click();
      await flush(2);
    });

    expect(document.body.textContent ?? "").toContain("Speichern und Berechnung starten");

    const selects = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
    const categorySelect = selects.find((select) => Array.from(select.options).some((option) => option.value === "vegetarian"));
    const productionModeSelect = selects.find((select) =>
      Array.from(select.options).some((option) => option.value === "scratch")
    );
    const recipeSelect = selects.find((select) =>
      Array.from(select.options).some((option) => option.value === fixture.recipe.recipeId)
    );

    if (!categorySelect || !productionModeSelect) {
      throw new Error("Required component controls were not rendered");
    }

    await act(async () => {
      setNativeValue(categorySelect, "vegetarian");
      setNativeValue(productionModeSelect, "scratch");
      if (recipeSelect) {
        setNativeValue(recipeSelect, fixture.recipe.recipeId);
      }
      findButtonByText("Speichern und Berechnung starten").click();
      await flush(8);
    });

    const saveAnswersCallIndex = fetchCalls.findIndex(
      (call) =>
        call.method === "PATCH" &&
        call.url.endsWith(`/api/intake/v1/intake/specs/${fixture.spec.specId}`)
    );
    const createPlanCallIndex = fetchCalls.findIndex(
      (call) => call.method === "POST" && call.url.endsWith("/api/production/v1/production/plans")
    );
    const importDraftCallIndex = fetchCalls.findIndex(
      (call) => call.method === "POST" && call.url.endsWith("/api/production/v1/production/drafts")
    );
    const createCaseCallIndex = fetchCalls.findIndex(
      (call) => call.method === "POST" && call.url.endsWith("/api/production/v1/production/cases")
    );
    const prepareDraftCallIndex = fetchCalls.findIndex(
      (call) => call.method === "POST" && call.url.endsWith("/prepare")
    );
    expect(createdPlanViaPost).toBe(false);
    expect(saveAnswersCallIndex).toBeGreaterThanOrEqual(0);
    expect(createCaseCallIndex).toBeGreaterThan(saveAnswersCallIndex);
    expect(importDraftCallIndex).toBeGreaterThan(createCaseCallIndex);
    expect(fetchCalls[importDraftCallIndex]?.body).toEqual({
      caseId: "production-case-usage",
      specId: fixture.spec.specId
    });
    expect(prepareDraftCallIndex).toBeGreaterThan(importDraftCallIndex);
    expect(createPlanCallIndex).toBe(-1);
    expect(document.body.textContent ?? "").toContain("Produktionsentwurf wurde vorbereitet und wartet auf Prüfung.");
    expect(document.body.textContent ?? "").toContain("Produktionsplan prüfen");
    expect(document.body.textContent ?? "").toContain("Einkaufsliste prüfen");
    expect(document.body.textContent ?? "").toContain("Entwurf freigeben");

    expect(document.body.textContent ?? "").not.toContain("Produktionsplan wurde erzeugt.");
    expect(document.body.textContent ?? "").toContain("Status: vollständig");
    expect(document.body.textContent ?? "").toContain("noch kein Produktionsplan");
    expect(document.body.textContent ?? "").not.toContain("Produktionsblatt exportieren");
    expect(document.body.textContent ?? "").not.toContain("Einkaufsliste exportieren");
    expect(document.body.textContent ?? "").toContain("Vegetarische Tomatensuppe");
    expect(document.body.textContent ?? "").not.toContain("Status: unzureichend");
    expect(document.body.textContent ?? "").not.toContain("fallback");
    expect(document.body.textContent ?? "").not.toContain("blockiert");

    await act(async () => {
      productionRoute.root.unmount();
    });
    productionRoute.container.remove();
    rmSync(fixture.dataRoot, { recursive: true, force: true });
  }, 15000);
});
