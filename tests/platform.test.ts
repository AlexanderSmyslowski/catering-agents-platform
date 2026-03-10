import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import {
  SCHEMA_VERSION,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type EventRequest,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";
import { IntakeStore, buildIntakeApp } from "@catering/intake-service";
import { OfferStore, buildOfferApp } from "@catering/offer-service";
import {
  InMemoryRecipeRepository,
  ProductionStore,
  RecipeDiscoveryService,
  buildProductionApp
} from "@catering/production-service";
import type { WebRecipeSearchProvider } from "@catering/production-service";

class FakeWebProvider implements WebRecipeSearchProvider {
  constructor(private readonly candidates: WebRecipeCandidate[]) {}

  async searchRecipes(_query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    return this.candidates;
  }
}

function baseEventRequest(text: string): EventRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: "request-1",
    source: {
      channel: "text",
      receivedAt: "2026-03-10T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: text
      }
    ]
  };
}

function specWithComponent(label: string): AcceptedEventSpec {
  return normalizeEventRequestToSpec(
    baseEventRequest(`Konferenz am 2026-05-12 fuer 60 Teilnehmer. Buffet mit ${label}.`)
  );
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-"));
}

describe("catering agents platform", () => {
  it("normalizes manual text into the canonical AcceptedEventSpec", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/normalize",
      payload: {
        text: "Konferenz am 2026-05-12 fuer 120 Teilnehmer. Lunchbuffet mit Caesar Salad und Wasserstation."
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.acceptedEventSpec.servicePlan.eventType).toBe("conference");
    expect(body.acceptedEventSpec.attendees.expected).toBe(120);
    expect(body.acceptedEventSpec.readiness.status).toBe("complete");
    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("creates an offer draft and promotes a structured variant", async () => {
    const dataRoot = createDataRoot();
    const app = buildOfferApp(new OfferStore({ rootDir: dataRoot }));
    const request = baseEventRequest(
      "Meeting am 2026-06-03 fuer 35 Teilnehmer mit Kaffeepause und Croissants."
    );

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      payload: request
    });

    expect(createResponse.statusCode).toBe(201);
    const draft = createResponse.json();
    expect(draft.variantSet).toHaveLength(3);
    expect(draft.customerFacingText).toContain("Vielen Dank");

    const promoteResponse = await app.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/promote`,
      payload: {
        variantId: draft.variantSet[1].variantId
      }
    });

    expect(promoteResponse.statusCode).toBe(201);
    const spec = promoteResponse.json();
    expect(spec.sourceLineage[0].sourceType).toBe("offer_service");
    expect(spec.servicePlan.modules.length).toBeGreaterThan(0);
    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("builds a production plan from the independent intake path using internal recipes", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot });
    const spec = specWithComponent("Filterkaffee Station");

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: spec
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.productionPlan.recipeSelections[0].sourceTier).toBe("internal_verified");
    expect(body.purchaseList.items.length).toBeGreaterThan(0);
    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("falls back to internet recipes and auto-uses high confidence results", async () => {
    const dataRoot = createDataRoot();
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    const provider = new FakeWebProvider([
      {
        url: "https://example.com/tomato-soup",
        title: "Tomatensuppe Rezept",
        recipe: {
          schemaVersion: SCHEMA_VERSION,
          recipeId: "",
          name: "Tomatensuppe Rezept",
          baseYield: {
            servings: 10,
            unit: "servings"
          },
          ingredients: [
            {
              ingredientId: "tomatoes",
              name: "Tomatoes",
              quantity: {
                amount: 2,
                unit: "kg"
              },
              group: "produce",
              purchaseUnit: "kg",
              normalizedUnit: "kg"
            },
            {
              ingredientId: "stock",
              name: "Vegetable Stock",
              quantity: {
                amount: 1.5,
                unit: "l"
              },
              group: "dry_goods",
              purchaseUnit: "l",
              normalizedUnit: "l"
            }
          ],
          steps: [
            {
              index: 1,
              instruction: "Cook tomatoes with stock."
            },
            {
              index: 2,
              instruction: "Blend and season."
            }
          ],
          scalingRules: {
            defaultLossFactor: 1.05,
            batchSize: 10
          },
          allergens: [],
          dietTags: ["vegan"]
        },
        qualitySignals: {
          structuredData: true,
          hasYield: true,
          ingredientCount: 12,
          stepCount: 6,
          mappedIngredientRatio: 0.95
        }
      }
    ]);
    const discovery = new RecipeDiscoveryService(repository, provider);
    const app = buildProductionApp({
      repository,
      discoveryService: discovery,
      dataRoot
    });
    const spec = specWithComponent("Tomatensuppe");

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: spec
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.productionPlan.recipeSelections[0].sourceTier).toBe("internet_fallback");
    expect(body.productionPlan.recipeSelections[0].autoUsedInternetRecipe).toBe(true);
    expect(body.productionPlan.unresolvedItems).toHaveLength(0);
    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("marks low confidence internet recipes as partial and review-required", async () => {
    const dataRoot = createDataRoot();
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    const provider = new FakeWebProvider([
      {
        url: "https://example.com/weak-recipe",
        title: "Fancy Bowl",
        recipe: {
          schemaVersion: SCHEMA_VERSION,
          recipeId: "",
          name: "Fancy Bowl",
          baseYield: {
            servings: 8,
            unit: "servings"
          },
          ingredients: [
            {
              ingredientId: "ingredient-1",
              name: "Ingredient 1",
              quantity: {
                amount: 500,
                unit: "g"
              },
              group: "misc",
              purchaseUnit: "kg",
              normalizedUnit: "g"
            }
          ],
          steps: [
            {
              index: 1,
              instruction: "Mix ingredients."
            }
          ],
          scalingRules: {
            defaultLossFactor: 1.05,
            batchSize: 8
          },
          allergens: [],
          dietTags: []
        },
        qualitySignals: {
          structuredData: false,
          hasYield: false,
          ingredientCount: 2,
          stepCount: 1,
          mappedIngredientRatio: 0.2
        }
      }
    ]);
    const discovery = new RecipeDiscoveryService(repository, provider);
    const app = buildProductionApp({
      repository,
      discoveryService: discovery,
      dataRoot
    });
    const spec = specWithComponent("Mystery Bowl");

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: spec
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.productionPlan.recipeSelections[0].autoUsedInternetRecipe).toBe(false);
    expect(body.productionPlan.readiness.status).toBe("partial");
    expect(body.productionPlan.unresolvedItems[0]).toContain("requires manual review");
    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("persists intake specs and requests across app restarts", async () => {
    const dataRoot = createDataRoot();
    const firstApp = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));

    const createResponse = await firstApp.inject({
      method: "POST",
      url: "/v1/intake/normalize",
      payload: {
        text: "Konferenz am 2026-05-12 fuer 45 Teilnehmer mit Tomatensuppe und Buffet."
      }
    });

    const body = createResponse.json();
    await firstApp.close();

    const restartedApp = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));
    const listSpecsResponse = await restartedApp.inject({
      method: "GET",
      url: "/v1/intake/specs"
    });
    const listRequestsResponse = await restartedApp.inject({
      method: "GET",
      url: "/v1/intake/requests"
    });
    const detailResponse = await restartedApp.inject({
      method: "GET",
      url: `/v1/intake/specs/${body.acceptedEventSpec.specId}`
    });

    expect(listSpecsResponse.json().items).toHaveLength(1);
    expect(listRequestsResponse.json().items).toHaveLength(1);
    expect(detailResponse.json().specId).toBe(body.acceptedEventSpec.specId);
    await restartedApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("persists offer drafts across app restarts and exposes list endpoints", async () => {
    const dataRoot = createDataRoot();
    const firstApp = buildOfferApp(new OfferStore({ rootDir: dataRoot }));

    const createResponse = await firstApp.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      payload: baseEventRequest(
        "Lunch am 2026-06-10 fuer 70 Teilnehmer mit Buffet und Dessert."
      )
    });

    const draft = createResponse.json();
    await firstApp.close();

    const restartedApp = buildOfferApp(new OfferStore({ rootDir: dataRoot }));
    const listResponse = await restartedApp.inject({
      method: "GET",
      url: "/v1/offers/drafts"
    });
    const detailResponse = await restartedApp.inject({
      method: "GET",
      url: `/v1/offers/drafts/${draft.draftId}`
    });

    expect(listResponse.json().items).toHaveLength(1);
    expect(detailResponse.json().draftId).toBe(draft.draftId);
    await restartedApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("persists production plans, purchase lists, and discovered recipes across restarts", async () => {
    const dataRoot = createDataRoot();
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const provider = new FakeWebProvider([
      {
        url: "https://example.com/lentil-stew",
        title: "Linseneintopf Rezept",
        recipe: {
          schemaVersion: SCHEMA_VERSION,
          recipeId: "",
          name: "Linseneintopf Rezept",
          baseYield: {
            servings: 12,
            unit: "servings"
          },
          ingredients: [
            {
              ingredientId: "lentils",
              name: "Lentils",
              quantity: {
                amount: 1.5,
                unit: "kg"
              },
              group: "dry_goods",
              purchaseUnit: "kg",
              normalizedUnit: "kg"
            }
          ],
          steps: [
            {
              index: 1,
              instruction: "Cook lentils gently until tender."
            },
            {
              index: 2,
              instruction: "Season and hold warm for service."
            }
          ],
          scalingRules: {
            defaultLossFactor: 1.05,
            batchSize: 12
          },
          allergens: [],
          dietTags: ["vegan"]
        },
        qualitySignals: {
          structuredData: true,
          hasYield: true,
          ingredientCount: 10,
          stepCount: 5,
          mappedIngredientRatio: 0.95
        }
      }
    ]);
    const discovery = new RecipeDiscoveryService(repository, provider);
    const firstApp = buildProductionApp({
      repository,
      discoveryService: discovery,
      store,
      dataRoot
    });

    const createResponse = await firstApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: specWithComponent("Linseneintopf")
      }
    });

    const created = createResponse.json();
    await firstApp.close();

    const restartedApp = buildProductionApp({
      dataRoot
    });
    const plansResponse = await restartedApp.inject({
      method: "GET",
      url: "/v1/production/plans"
    });
    const purchaseListsResponse = await restartedApp.inject({
      method: "GET",
      url: "/v1/production/purchase-lists"
    });
    const recipesResponse = await restartedApp.inject({
      method: "GET",
      url: "/v1/production/recipes"
    });
    const detailResponse = await restartedApp.inject({
      method: "GET",
      url: `/v1/production/plans/${created.productionPlan.planId}`
    });

    expect(plansResponse.json().items).toHaveLength(1);
    expect(purchaseListsResponse.json().items).toHaveLength(1);
    expect(
      recipesResponse
        .json()
        .items.some((item: { source: { tier: string } }) => item.source.tier === "internet_fallback")
    ).toBe(true);
    expect(detailResponse.json().planId).toBe(created.productionPlan.planId);
    await restartedApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("supports PostgreSQL-backed persistence across services", async () => {
    const db = newDb();
    const { Pool } = db.adapters.createPg();
    const pool = new Pool();

    const intakeApp = buildIntakeApp(new IntakeStore({ pgPool: pool }));
    const intakeResponse = await intakeApp.inject({
      method: "POST",
      url: "/v1/intake/normalize",
      payload: {
        text: "Universitaetskonferenz am 2026-07-01 fuer 80 Teilnehmer mit Linseneintopf und Kaffee."
      }
    });
    const acceptedEventSpec = intakeResponse.json().acceptedEventSpec;
    await intakeApp.close();

    const offerApp = buildOfferApp(new OfferStore({ pgPool: pool }));
    await offerApp.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      payload: {
        text: "Empfang am 2026-07-04 fuer 50 Teilnehmer mit Flying Bites und Aperitif."
      }
    });
    const offerListResponse = await offerApp.inject({
      method: "GET",
      url: "/v1/offers/drafts"
    });
    expect(offerListResponse.json().items).toHaveLength(1);
    await offerApp.close();

    const provider = new FakeWebProvider([
      {
        url: "https://example.com/lentil-stew-pg",
        title: "Linseneintopf Rezept",
        recipe: {
          schemaVersion: SCHEMA_VERSION,
          recipeId: "",
          name: "Linseneintopf Rezept",
          baseYield: {
            servings: 12,
            unit: "servings"
          },
          ingredients: [
            {
              ingredientId: "lentils",
              name: "Lentils",
              quantity: {
                amount: 1.5,
                unit: "kg"
              },
              group: "dry_goods",
              purchaseUnit: "kg",
              normalizedUnit: "kg"
            }
          ],
          steps: [
            {
              index: 1,
              instruction: "Cook lentils slowly."
            }
          ],
          scalingRules: {
            defaultLossFactor: 1.05,
            batchSize: 12
          },
          allergens: [],
          dietTags: ["vegan"]
        },
        qualitySignals: {
          structuredData: true,
          hasYield: true,
          ingredientCount: 9,
          stepCount: 5,
          mappedIngredientRatio: 0.95
        }
      }
    ]);
    const repository = new InMemoryRecipeRepository([], { pgPool: pool });
    const productionApp = buildProductionApp({
      repository,
      store: new ProductionStore({ pgPool: pool }),
      discoveryService: new RecipeDiscoveryService(repository, provider),
      pgPool: pool
    });
    const productionResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: acceptedEventSpec
      }
    });
    expect(productionResponse.statusCode).toBe(201);
    await productionApp.close();

    const restartedIntakeApp = buildIntakeApp(new IntakeStore({ pgPool: pool }));
    const restartedOfferApp = buildOfferApp(new OfferStore({ pgPool: pool }));
    const restartedProductionApp = buildProductionApp({
      pgPool: pool
    });

    expect(
      (await restartedIntakeApp.inject({ method: "GET", url: "/v1/intake/specs" })).json().items
    ).toHaveLength(1);
    expect(
      (await restartedOfferApp.inject({ method: "GET", url: "/v1/offers/drafts" })).json().items
    ).toHaveLength(1);
    expect(
      (await restartedProductionApp.inject({ method: "GET", url: "/v1/production/plans" })).json().items
    ).toHaveLength(1);
    expect(
      (
        await restartedProductionApp.inject({
          method: "GET",
          url: "/v1/production/recipes"
        })
      )
        .json()
        .items.some((item: { source: { tier: string } }) => item.source.tier === "internet_fallback")
    ).toBe(true);

    await restartedIntakeApp.close();
    await restartedOfferApp.close();
    await restartedProductionApp.close();
    await pool.end();
  });
});
