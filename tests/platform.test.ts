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
import { buildPrintExportApp } from "@catering/print-export";
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

function lunchOfferPdfText(): string {
  return `THE ONE
Hallo Ihr Lieben,
bitte findet anbei das Angebot für Euer Lunch am 04.03.2026 ab 12.00 Uhr (?) bei Euch im Haus.

ORGANISATION | ABLAUFPLANUNG | 04.03.2026
04.03.2026
09.00 Uhr - 12.00 Uhr Anlieferungen, Umbau & Aufbau
12.00 Uhr - 13.00 Uhr Buffetbetreuung, Rücklauf

QUICK LUNCH |
TRADITIONELL | 80%
KALBSBULETTEN | SCHMORZWIEBELN
KARTOFFELSALAT | DE LUX
NUDELSALAT | FRISCHGEDÖNS
KRAUT-KAROTTENSALAT | NUSS-TOPPING
VEGAN | 20%
MANDEL-CURRY | BASMATIREIS & KORIANDER-TOPPING
ZUCCHINI | PILZE | ZUCKERSCHOTEN | BABY-PAK-CHOI
& WILDKRÄUTERSALAT | PETERSILIEN-VINAIGRETTE
BROT & BAGUETTE |
DESSERT |
SCHOKOLADENKUCHEN | vegan

KOSTENÜBERSICHT | DETAILS |
7 Catering Get Together |
22,50 € | 120 x
8 Gesamtkosten: 4.191,25 €`;
}

function specWithComponent(label: string): AcceptedEventSpec {
  const spec = normalizeEventRequestToSpec(
    baseEventRequest(`Konferenz am 2026-05-12 fuer 60 Teilnehmer. Buffet mit ${label}.`)
  );

  return {
    ...spec,
    menuPlan: spec.menuPlan.map((item) => ({
      ...item,
      menuCategory: item.menuCategory ?? "classic",
      productionDecision: {
        mode: "scratch"
      }
    }))
  };
}

function withProductionDecision(
  spec: AcceptedEventSpec,
  category: "classic" | "vegetarian" | "vegan" = "classic"
): AcceptedEventSpec {
  return {
    ...spec,
    menuPlan: spec.menuPlan.map((item) => ({
      ...item,
      menuCategory: item.menuCategory ?? category,
      productionDecision: item.productionDecision ?? {
        mode: "scratch"
      }
    }))
  };
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

  it("normalizes uploaded intake documents into the canonical AcceptedEventSpec", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp({
      rootDir: dataRoot
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        channel: "text",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from(
              "Meeting am 2026-05-14 fuer 24 Teilnehmer mit Kaffeepause und Croissants.",
              "utf8"
            ).toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.eventRequest.rawInputs[0].kind).toBe("text");
    expect(body.eventRequest.rawInputs[0].mimeType).toBe("text/plain");
    expect(body.acceptedEventSpec.attendees.expected).toBe(24);
    expect(body.acceptedEventSpec.readiness.status).toBe("complete");
    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("extracts attendees and the full lunch menu from structured offer text", () => {
    const spec = normalizeEventRequestToSpec({
      schemaVersion: SCHEMA_VERSION,
      requestId: "request-lunch-pdf",
      source: {
        channel: "pdf_upload",
        receivedAt: "2026-03-11T10:00:00.000Z"
      },
      rawInputs: [
        {
          kind: "pdf",
          content: lunchOfferPdfText(),
          mimeType: "application/pdf",
          documentId: "document-1"
        }
      ]
    });

    const labels = spec.menuPlan.map((item) => item.label);

    expect(spec.event.type).toBe("lunch");
    expect(spec.event.date).toBe("2026-03-04");
    expect(spec.attendees.expected).toBe(120);
    expect(labels).toContain("KALBSBULETTEN | SCHMORZWIEBELN");
    expect(labels).toContain("BROT & BAGUETTE");
    expect(labels).toContain("SCHOKOLADENKUCHEN | vegan");
    expect(labels.some((label) => /Buffetbetreuung/i.test(label))).toBe(false);
    expect(spec.menuPlan.find((item) => item.label.includes("KALBSBULETTEN"))?.menuCategory).toBe("classic");
    expect(spec.menuPlan.find((item) => item.label.includes("MANDEL-CURRY"))?.menuCategory).toBe("vegan");
    expect(spec.menuPlan.find((item) => item.label.includes("SCHOKOLADENKUCHEN"))?.dietaryTags).toContain("vegan");
  });

  it("accepts larger uploaded intake documents without failing on body size limits", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp({
      rootDir: dataRoot
    });
    const repeatedText = `${"Lunch am 2026-05-14 fuer 120 Teilnehmer mit Buffet und Dessert. ".repeat(120000)}Ende.`;

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        channel: "text",
        documents: [
          {
            filename: "grosses-angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from(repeatedText, "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().acceptedEventSpec.attendees.expected).toBe(120);

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("accepts multipart document uploads for the browser-driven intake path", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp({
      rootDir: dataRoot
    });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const formData = new FormData();
    formData.append("channel", "pdf_upload");
    formData.append(
      "file",
      new Blob(
        [
          "Lunch am 2026-05-14 fuer 120 Teilnehmer mit Buffet, Dessert und Kaffeestation."
        ],
        { type: "text/plain" }
      ),
      "angebot.txt"
    );

    const response = await fetch(`${address}/v1/intake/documents/upload`, {
      method: "POST",
      body: formData
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      acceptedEventSpec: AcceptedEventSpec;
      eventRequest: EventRequest;
    };
    expect(body.eventRequest.rawInputs[0].kind).toBe("text");
    expect(body.acceptedEventSpec.attendees.expected).toBe(120);

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("allows manual enrichment of AcceptedEventSpec data through the intake service", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp({
      rootDir: dataRoot
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/intake/normalize",
      payload: {
        text: "Event ohne Datum fuer unklare Teilnehmerzahl."
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const createdSpec = createResponse.json().acceptedEventSpec;
    expect(createdSpec.readiness.status).toBe("insufficient");

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/v1/intake/specs/${createdSpec.specId}`,
      payload: {
        eventType: "conference",
        eventDate: "2026-09-03",
        attendeeCount: 48,
        serviceForm: "buffet",
        menuItems: ["Tomatensuppe", "Lunchbuffet"]
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().acceptedEventSpec.readiness.status).toBe("complete");
    expect(updateResponse.json().acceptedEventSpec.attendees.expected).toBe(48);
    expect(updateResponse.json().acceptedEventSpec.menuPlan).toHaveLength(2);

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("stores per-component category and sourcing decisions on AcceptedEventSpec", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp({
      rootDir: dataRoot
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/intake/specs/manual",
      payload: {
        eventType: "lunch",
        eventDate: "2026-10-10",
        attendeeCount: 40,
        serviceForm: "buffet",
        menuItems: ["Quiche"]
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const createdSpec = createResponse.json().acceptedEventSpec;
    const componentId = createdSpec.menuPlan[0].componentId;

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/v1/intake/specs/${createdSpec.specId}`,
      payload: {
        componentUpdates: [
          {
            componentId,
            menuCategory: "vegetarian",
            productionMode: "hybrid",
            purchasedElements: ["Teig"]
          }
        ]
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    const updatedComponent = updateResponse.json().acceptedEventSpec.menuPlan[0];
    expect(updatedComponent.menuCategory).toBe("vegetarian");
    expect(updatedComponent.dietaryTags).toContain("vegetarian");
    expect(updatedComponent.productionDecision.mode).toBe("hybrid");
    expect(updatedComponent.productionDecision.purchasedElements).toContain("Teig");

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("creates an AcceptedEventSpec directly from a structured manual form", async () => {
    const dataRoot = createDataRoot();
    const app = buildIntakeApp({
      rootDir: dataRoot
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/specs/manual",
      payload: {
        eventType: "conference",
        eventDate: "2026-10-10",
        attendeeCount: 75,
        serviceForm: "buffet",
        menuItems: ["Tomatensuppe", "Lunchbuffet", "Kaffeestation"],
        customerName: "Universitaet Heidelberg",
        venueName: "Heidelberg Campus",
        notes: "Vegetarische Option vorsehen."
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.eventRequest.source.channel).toBe("manual_form");
    expect(body.eventRequest.rawInputs[0].kind).toBe("form");
    expect(body.acceptedEventSpec.readiness.status).toBe("complete");
    expect(body.acceptedEventSpec.attendees.expected).toBe(75);
    expect(body.acceptedEventSpec.menuPlan).toHaveLength(3);
    expect(body.acceptedEventSpec.customer.name).toBe("Universitaet Heidelberg");

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

  it("adds hybrid and convenience purchases to the purchase list", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({ dataRoot });
    const baseSpec = normalizeEventRequestToSpec(
      baseEventRequest(
        "Konferenz am 2026-05-12 fuer 60 Teilnehmer. Buffet mit Filterkaffee Station und Brot & Baguette."
      )
    );

    const spec: AcceptedEventSpec = {
      ...baseSpec,
      menuPlan: [
        {
          componentId: "filterkaffee-station-1",
          label: "Filterkaffee Station",
          course: "main",
          menuCategory: "classic",
          serviceStyle: "buffet",
          desiredRecipeTags: ["conference"],
          servings: 60,
          dietaryTags: [],
          productionDecision: {
            mode: "hybrid",
            purchasedElements: ["Kaffeefilter"]
          }
        },
        {
          componentId: "brot-baguette-2",
          label: "BROT & BAGUETTE",
          course: "main",
          menuCategory: "classic",
          serviceStyle: "buffet",
          desiredRecipeTags: ["conference"],
          servings: 60,
          dietaryTags: [],
          productionDecision: {
            mode: "convenience_purchase",
            purchasedElements: ["Baguette", "Brot"]
          }
        }
      ]
    };

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: spec
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.productionPlan.readiness.status).toBe("complete");
    expect(body.productionPlan.productionBatches.length).toBeGreaterThan(0);
    expect(
      body.productionPlan.recipeSelections.find(
        (entry: { componentId: string }) => entry.componentId === "brot-baguette-2"
      ).selectionReason
    ).toContain("Einkaufsliste");
    expect(
      body.purchaseList.items.some((item: { displayName: string }) =>
        item.displayName.includes("Kaffeefilter")
      )
    ).toBe(true);
    expect(
      body.purchaseList.items.some((item: { displayName: string }) => item.displayName.includes("Baguette"))
    ).toBe(true);

    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("requires category and sourcing decisions before recipe resolution starts", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({
      dataRoot,
      discoveryService: new RecipeDiscoveryService(
        new InMemoryRecipeRepository(undefined, { rootDir: dataRoot }),
        new FakeWebProvider([
          {
            url: "https://example.com/quiche",
            title: "Quiche Rezept",
            recipe: {
              schemaVersion: SCHEMA_VERSION,
              recipeId: "",
              name: "Quiche Rezept",
              source: undefined,
              baseYield: {
                servings: 8,
                unit: "servings"
              },
              ingredients: [
                {
                  ingredientId: "eggs-1",
                  name: "Eier",
                  quantity: { amount: 6, unit: "pcs" },
                  group: "protein",
                  purchaseUnit: "pcs",
                  normalizedUnit: "pcs"
                }
              ],
              steps: [{ index: 1, instruction: "Backen." }],
              scalingRules: { defaultLossFactor: 1.08, batchSize: 8 },
              allergens: [],
              dietTags: []
            },
            qualitySignals: {
              structuredData: true,
              hasYield: true,
              ingredientCount: 1,
              stepCount: 1,
              mappedIngredientRatio: 1
            }
          }
        ])
      )
    });

    const spec = normalizeEventRequestToSpec(
      baseEventRequest("Konferenz am 2026-05-12 fuer 60 Teilnehmer. Buffet mit Quiche.")
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: spec
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.productionPlan.recipeSelections[0].selectionReason).toContain("Gerichtsklassifikation fehlt");
    expect(body.productionPlan.productionBatches).toHaveLength(0);

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
    expect(body.productionPlan.unresolvedItems[0]).toContain("manuell geprueft");
    await app.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("promotes reviewed internet recipes into the approved shared library", async () => {
    const dataRoot = createDataRoot();
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    const provider = new FakeWebProvider([
      {
        url: "https://example.com/review-me",
        title: "Harissa Bowl",
        recipe: {
          schemaVersion: SCHEMA_VERSION,
          recipeId: "",
          name: "Harissa Bowl",
          baseYield: {
            servings: 8,
            unit: "servings"
          },
          ingredients: [
            {
              ingredientId: "chickpeas",
              name: "Chickpeas",
              quantity: {
                amount: 800,
                unit: "g"
              },
              group: "dry_goods",
              purchaseUnit: "kg",
              normalizedUnit: "g"
            }
          ],
          steps: [
            {
              index: 1,
              instruction: "Mix and season."
            }
          ],
          scalingRules: {
            defaultLossFactor: 1.05,
            batchSize: 8
          },
          allergens: [],
          dietTags: ["vegan"]
        },
        qualitySignals: {
          structuredData: false,
          hasYield: true,
          ingredientCount: 3,
          stepCount: 1,
          mappedIngredientRatio: 0.45
        }
      }
    ]);
    const discovery = new RecipeDiscoveryService(repository, provider);
    const productionApp = buildProductionApp({
      repository,
      discoveryService: discovery,
      dataRoot
    });

    const firstPlanResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: specWithComponent("Harissa Bowl")
      }
    });

    expect(firstPlanResponse.json().productionPlan.readiness.status).toBe("partial");

    const reviewedRecipeId = firstPlanResponse.json().productionPlan.recipeSelections[0].recipeId;
    const offerApp = buildOfferApp({
      rootDir: dataRoot
    });
    const reviewResponse = await offerApp.inject({
      method: "PATCH",
      url: `/v1/offers/recipes/${reviewedRecipeId}/review`,
      payload: {
        decision: "approve"
      }
    });

    expect(reviewResponse.statusCode).toBe(200);
    expect(reviewResponse.json().recipe.source.approvalState).toBe("approved_internal");
    expect(reviewResponse.json().recipe.source.tier).toBe("internal_approved");
    await offerApp.close();

    const secondPlanResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: specWithComponent("Harissa Bowl")
      }
    });

    expect(secondPlanResponse.json().productionPlan.recipeSelections[0].recipeId).toBe(
      reviewedRecipeId
    );
    expect(secondPlanResponse.json().productionPlan.recipeSelections[0].sourceTier).toBe(
      "internal_approved"
    );
    expect(secondPlanResponse.json().productionPlan.unresolvedItems).toHaveLength(0);

    await productionApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("excludes rejected recipes from future planning", async () => {
    const dataRoot = createDataRoot();
    const offerApp = buildOfferApp({
      rootDir: dataRoot
    });

    const uploadResponse = await offerApp.inject({
      method: "POST",
      url: "/v1/offers/recipes/import-text",
      payload: {
        recipeName: "Smoked Pepper Dip",
        text: [
          "Smoked Pepper Dip",
          "Ingredients",
          "500 g Paprika",
          "200 ml Olive Oil",
          "Instructions",
          "1. Blend ingredients.",
          "2. Chill before service."
        ].join("\n")
      }
    });

    const recipeId = uploadResponse.json().recipe.recipeId;
    await offerApp.close();

    const productionApp = buildProductionApp({
      dataRoot,
      discoveryService: new RecipeDiscoveryService(
        new InMemoryRecipeRepository(undefined, { rootDir: dataRoot }),
        new FakeWebProvider([])
      )
    });

    const rejectResponse = await productionApp.inject({
      method: "PATCH",
      url: `/v1/production/recipes/${recipeId}/review`,
      payload: {
        decision: "reject"
      }
    });

    expect(rejectResponse.statusCode).toBe(200);
    expect(rejectResponse.json().recipe.source.approvalState).toBe("rejected");

    const planResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: specWithComponent("Smoked Pepper Dip")
      }
    });

    expect(planResponse.json().productionPlan.recipeSelections[0].recipeId).toBeUndefined();
    expect(planResponse.json().productionPlan.unresolvedItems[0]).toContain(
      "Kein Rezeptkandidat"
    );

    await productionApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("exposes health endpoints and idempotent demo seeding across services", async () => {
    const dataRoot = createDataRoot();
    const intakeApp = buildIntakeApp(new IntakeStore({ rootDir: dataRoot }));
    const offerApp = buildOfferApp({
      rootDir: dataRoot
    });
    const productionApp = buildProductionApp({
      dataRoot,
      discoveryService: new RecipeDiscoveryService(
        new InMemoryRecipeRepository(undefined, { rootDir: dataRoot }),
        new FakeWebProvider([])
      )
    });
    const exportApp = buildPrintExportApp({
      rootDir: dataRoot
    });

    const initialIntakeHealth = await intakeApp.inject({
      method: "GET",
      url: "/health"
    });
    const initialOfferHealth = await offerApp.inject({
      method: "GET",
      url: "/health"
    });
    const initialProductionHealth = await productionApp.inject({
      method: "GET",
      url: "/health"
    });
    const initialExportHealth = await exportApp.inject({
      method: "GET",
      url: "/health"
    });

    expect(initialIntakeHealth.statusCode).toBe(200);
    expect(initialOfferHealth.statusCode).toBe(200);
    expect(initialProductionHealth.statusCode).toBe(200);
    expect(initialExportHealth.statusCode).toBe(200);

    const seedResponses = await Promise.all([
      intakeApp.inject({
        method: "POST",
        url: "/v1/intake/seed-demo"
      }),
      offerApp.inject({
        method: "POST",
        url: "/v1/offers/seed-demo"
      }),
      productionApp.inject({
        method: "POST",
        url: "/v1/production/seed-demo"
      })
    ]);

    seedResponses.forEach((response) => {
      expect(response.statusCode).toBe(201);
    });

    const repeatedSeedResponses = await Promise.all([
      intakeApp.inject({
        method: "POST",
        url: "/v1/intake/seed-demo"
      }),
      offerApp.inject({
        method: "POST",
        url: "/v1/offers/seed-demo"
      }),
      productionApp.inject({
        method: "POST",
        url: "/v1/production/seed-demo"
      })
    ]);

    expect(repeatedSeedResponses[0].json().counts.requests).toBe(seedResponses[0].json().counts.requests);
    expect(repeatedSeedResponses[1].json().counts.offerDrafts).toBe(seedResponses[1].json().counts.offerDrafts);
    expect(repeatedSeedResponses[2].json().counts.productionPlans).toBe(seedResponses[2].json().counts.productionPlans);

    const finalExportHealth = await exportApp.inject({
      method: "GET",
      url: "/health"
    });

    expect(finalExportHealth.json().counts.offerDrafts).toBeGreaterThan(0);
    expect(finalExportHealth.json().counts.productionPlans).toBeGreaterThan(0);

    await intakeApp.close();
    await offerApp.close();
    await productionApp.close();
    await exportApp.close();
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

  it("imports human-uploaded recipe text through the offer agent into the shared library", async () => {
    const dataRoot = createDataRoot();
    const offerApp = buildOfferApp({
      rootDir: dataRoot
    });

    const uploadResponse = await offerApp.inject({
      method: "POST",
      url: "/v1/offers/recipes/import-text",
      payload: {
        recipeName: "Humus Bowl",
        text: [
          "Humus Bowl",
          "Zutaten",
          "500 g Kichererbsen",
          "150 ml Olivenoel",
          "2 pcs Zitronen",
          "Zubereitung",
          "1. Kichererbsen mixen.",
          "2. Olivenoel und Zitronensaft zugeben.",
          "3. Abschmecken und kalt stellen."
        ].join("\n")
      }
    });

    expect(uploadResponse.statusCode).toBe(201);
    const uploadedRecipe = uploadResponse.json().recipe;
    expect(uploadedRecipe.name).toBe("Humus Bowl");
    expect(uploadedRecipe.source.tier).toBe("internal_approved");
    await offerApp.close();

    const productionApp = buildProductionApp({
      dataRoot
    });
    const recipesResponse = await productionApp.inject({
      method: "GET",
      url: "/v1/production/recipes"
    });
    const planResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: specWithComponent("Humus Bowl")
      }
    });

    expect(
      recipesResponse
        .json()
        .items.some((item: { recipeId: string }) => item.recipeId === uploadedRecipe.recipeId)
    ).toBe(true);
    expect(planResponse.json().productionPlan.recipeSelections[0].recipeId).toBe(
      uploadedRecipe.recipeId
    );
    expect(planResponse.json().productionPlan.recipeSelections[0].sourceTier).toBe(
      "internal_approved"
    );
    await productionApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("imports human-uploaded recipe text through the production agent into the shared library", async () => {
    const dataRoot = createDataRoot();
    const productionApp = buildProductionApp({
      dataRoot
    });

    const uploadResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/recipes/import-text",
      payload: {
        recipeName: "Tomatensalsa",
        text: [
          "Tomatensalsa",
          "Ingredients",
          "1 kg Tomatoes",
          "200 g Onion",
          "100 ml Olive Oil",
          "Instructions",
          "1. Dice tomatoes and onion.",
          "2. Mix with olive oil.",
          "3. Chill before service."
        ].join("\n")
      }
    });

    expect(uploadResponse.statusCode).toBe(201);
    const uploadedRecipe = uploadResponse.json().recipe;
    expect(uploadedRecipe.ingredients.length).toBeGreaterThan(0);
    expect(uploadedRecipe.steps.length).toBeGreaterThan(0);
    await productionApp.close();

    const offerApp = buildOfferApp({
      rootDir: dataRoot
    });
    const recipesResponse = await offerApp.inject({
      method: "GET",
      url: "/v1/offers/recipes"
    });

    expect(
      recipesResponse
        .json()
        .items.some((item: { recipeId: string }) => item.recipeId === uploadedRecipe.recipeId)
    ).toBe(true);
    await offerApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("serves offer, production, and purchase list exports from persisted records", async () => {
    const dataRoot = createDataRoot();
    const offerApp = buildOfferApp(new OfferStore({ rootDir: dataRoot }));
    const offerResponse = await offerApp.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      payload: {
        text: "Lunch am 2026-08-14 fuer 55 Teilnehmer mit Buffet und Filterkaffee."
      }
    });
    const draft = offerResponse.json();
    await offerApp.close();

    const productionApp = buildProductionApp({ dataRoot });
    const productionResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      payload: {
        eventSpec: specWithComponent("Filterkaffee Station")
      }
    });
    const productionPayload = productionResponse.json();
    await productionApp.close();

    const exportApp = buildPrintExportApp({ rootDir: dataRoot });
    const offerExportResponse = await exportApp.inject({
      method: "GET",
      url: `/v1/exports/offers/${draft.draftId}/html`
    });
    const planExportResponse = await exportApp.inject({
      method: "GET",
      url: `/v1/exports/production-plans/${productionPayload.productionPlan.planId}/html`
    });
    const purchaseExportResponse = await exportApp.inject({
      method: "GET",
      url: `/v1/exports/purchase-lists/${productionPayload.purchaseList.purchaseListId}/csv`
    });

    expect(offerExportResponse.statusCode).toBe(200);
    expect(offerExportResponse.headers["content-type"]).toContain("text/html");
    expect(offerExportResponse.body).toContain(String(draft.draftId));
    expect(offerExportResponse.body).toContain("Vielen Dank");

    expect(planExportResponse.statusCode).toBe(200);
    expect(planExportResponse.headers["content-type"]).toContain("text/html");
    expect(planExportResponse.body).toContain(String(productionPayload.productionPlan.planId));
    expect(planExportResponse.body).toContain("Produktionsplan");

    expect(purchaseExportResponse.statusCode).toBe(200);
    expect(purchaseExportResponse.headers["content-type"]).toContain("text/csv");
    expect(purchaseExportResponse.body).toContain(
      '"group","item","normalizedQty","normalizedUnit","purchaseQty","purchaseUnit","supplierHint"'
    );

    await exportApp.close();
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
    const acceptedEventSpec = withProductionDecision(
      intakeResponse.json().acceptedEventSpec,
      "vegan"
    );
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

  it("records a shared audit trail with operator attribution across services", async () => {
    const dataRoot = createDataRoot();
    const intakeApp = buildIntakeApp({
      rootDir: dataRoot
    });
    const offerApp = buildOfferApp({
      rootDir: dataRoot
    });
    const productionApp = buildProductionApp({
      dataRoot,
      discoveryService: new RecipeDiscoveryService(
        new InMemoryRecipeRepository(undefined, { rootDir: dataRoot }),
        new FakeWebProvider([])
      )
    });

    const offerResponse = await offerApp.inject({
      method: "POST",
      url: "/v1/offers/from-text",
      headers: {
        "x-actor-name": "Angebot Team"
      },
      payload: {
        text: "Sommerempfang am 2026-07-01 fuer 45 Teilnehmer mit Fingerfood und Getraenken."
      }
    });
    expect(offerResponse.statusCode).toBe(201);

    const intakeResponse = await intakeApp.inject({
      method: "POST",
      url: "/v1/intake/normalize",
      headers: {
        "x-actor-name": "Kuechenplanung"
      },
      payload: {
        text: "Konferenz am 2026-08-04 fuer 60 Teilnehmer mit Lunchbuffet und Tomatensuppe."
      }
    });
    expect(intakeResponse.statusCode).toBe(201);

    const productionResponse = await productionApp.inject({
      method: "POST",
      url: "/v1/production/plans",
      headers: {
        "x-actor-name": "Operations"
      },
      payload: {
        eventSpec: withProductionDecision(intakeResponse.json().acceptedEventSpec)
      }
    });
    expect(productionResponse.statusCode).toBe(201);

    const auditResponse = await productionApp.inject({
      method: "GET",
      url: "/v1/production/audit/events?limit=10"
    });
    expect(auditResponse.statusCode).toBe(200);

    const auditEvents = auditResponse.json().items as Array<{
      action: string;
      actor: { name: string };
      entityType: string;
    }>;

    expect(
      auditEvents.some(
        (entry) =>
          entry.action === "offer.draft_created_from_text" &&
          entry.actor.name === "Angebot Team"
      )
    ).toBe(true);
    expect(
      auditEvents.some(
        (entry) =>
          entry.action === "intake.normalized" &&
          entry.actor.name === "Kuechenplanung"
      )
    ).toBe(true);
    expect(
      auditEvents.some(
        (entry) =>
          entry.action === "production.plan_created" &&
          entry.actor.name === "Operations"
      )
    ).toBe(true);
    expect(auditEvents.some((entry) => entry.entityType === "ProductionPlan")).toBe(true);

    await intakeApp.close();
    await offerApp.close();
    await productionApp.close();
    rmSync(dataRoot, { recursive: true, force: true });
  });
});
