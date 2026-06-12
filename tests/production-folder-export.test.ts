import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IntakeStore } from "@catering/intake-service";
import { buildPrintExportApp, renderProductionFolderHtml } from "@catering/print-export";
import { ProductionStore } from "@catering/production-service";
import {
  RecipeLibrary,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type ProductionClarificationAnswer,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "@catering/shared-core";

const TRUSTED_SECRET = "production-folder-secret";

const trustedHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-folder-"));
}

function fixture() {
  const spec: AcceptedEventSpec = {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-production-folder-1",
    lifecycle: {
      commercialState: "accepted"
    },
    readiness: {
      status: "complete",
      reasons: []
    },
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: "request-production-folder-1"
      }
    ],
    customer: {
      name: "Köpff Testkunde"
    },
    event: {
      date: "2026-06-14",
      serviceForm: "buffet"
    },
    attendees: {
      expected: 45
    },
    venue: {
      name: "Köpff Saal",
      address: "Teststraße 1"
    },
    servicePlan: {
      eventType: "conference",
      serviceForm: "buffet",
      modules: []
    },
    menuPlan: [
      {
        componentId: "component-vitello",
        label: "Vitello Tonnato",
        servings: 45,
        menuCategory: "classic"
      }
    ],
    budgetContext: {
      targetBudget: {
        amount: 1800,
        currency: "EUR"
      },
      pricingSummary: {
        subtotal: {
          amount: 1800,
          currency: "EUR"
        },
        perPerson: {
          amount: 40,
          currency: "EUR"
        }
      }
    },
    assumptions: [
      {
        code: "service",
        message: "Buffetaufbau im Saal.",
        applied: true
      }
    ],
    uncertainties: [
      {
        field: "setup",
        message: "Aufbauzeit noch offen.",
        severity: "medium",
        suggestedQuestion: "Wann beginnt der Aufbau?"
      }
    ]
  };
  const recipe: Recipe = {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-vitello",
    name: "Vitello Tonnato",
    source: {
      tier: "internal_approved",
      originType: "approved_import",
      reference: "Produktionsmappe Köpff 2026-06-14",
      retrievedAt: "2026-06-14T00:00:00.000Z",
      approvalState: "review_required",
      qualityScore: 0.95,
      fitScore: 0.9,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 45,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "veal",
        name: "Kalbsnuss",
        quantity: {
          amount: 3.2,
          unit: "kg"
        },
        group: "fleisch"
      },
      {
        ingredientId: "lemon",
        name: "Zitrone",
        quantity: {
          amount: 2,
          unit: "Stück"
        },
        group: "obst_gemuese"
      },
      {
        ingredientId: "parmesan",
        name: "Parmesan",
        quantity: {
          amount: 225,
          unit: "g"
        },
        group: "kaese"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Kalb garen."
      },
      {
        index: 2,
        instruction: "Sauce herstellen."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.2,
      batchSize: 45
    },
    allergens: [],
    dietTags: []
  };
  const plan: ProductionPlan = {
    schemaVersion: SCHEMA_VERSION,
    planId: "plan-production-folder-1",
    eventSpecId: spec.specId,
    readiness: {
      status: "complete",
      reasons: []
    },
    productionBatches: [
      {
        batchId: "batch-vitello",
        componentId: "component-vitello",
        recipeId: recipe.recipeId,
        scaledYield: {
          amount: 54,
          unit: "Portionen"
        },
        batchCount: 1,
        lossFactor: 1.2,
        gnPlan: [
          {
            container: "GN 1/1",
            count: 3
          }
        ],
        station: "cold-kitchen",
        prepWindow: "2026-06-14 T-1",
        ingredients: recipe.ingredients,
        steps: recipe.steps
      }
    ],
    timeline: [
      {
        label: "Vitello vorbereiten",
        at: "2026-06-14 T-1"
      }
    ],
    kitchenSheets: [
      {
        title: "Vitello Tonnato - Vitello Tonnato",
        componentId: "component-vitello",
        recipeId: recipe.recipeId,
        productionQty: {
          amount: 54,
          unit: "Portionen"
        },
        station: "cold-kitchen",
        prepWindow: "2026-06-14 T-1",
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        instructions: ["1. Kalb garen.", "2. Sauce herstellen."]
      }
    ],
    recipeSelections: [
      {
        componentId: "component-vitello",
        recipeId: recipe.recipeId,
        selectionReason: "Köpff-Rezept verknüpft.",
        autoUsedInternetRecipe: false
      }
    ],
    unresolvedItems: [],
    warnings: ["Kühlkette vor Ausgabe prüfen."]
  };
  const purchaseList: PurchaseList = {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: "purchase-spec-production-folder-1",
    eventSpecId: spec.specId,
    groupingMode: "group",
    items: [
      {
        ingredientId: "veal",
        displayName: "Kalbsnuss",
        normalizedQty: 3.2,
        normalizedUnit: "kg",
        purchaseQty: 3.2,
        purchaseUnit: "kg",
        group: "fleisch",
        supplierHint: "Metro Fresh",
        sourceRecipes: [recipe.recipeId],
        mappingConfidence: 0.95
      },
      {
        ingredientId: "parmesan",
        displayName: "Parmesan",
        normalizedQty: 225,
        normalizedUnit: "g",
        purchaseQty: 0.23,
        purchaseUnit: "kg",
        group: "kaese",
        supplierHint: "Metro Fresh",
        sourceRecipes: [recipe.recipeId],
        mappingConfidence: 0.95
      },
      {
        ingredientId: "lemon",
        displayName: "Zitrone",
        normalizedQty: 2,
        normalizedUnit: "Stück",
        purchaseQty: 2,
        purchaseUnit: "Stück",
        group: "obst_gemuese",
        supplierHint: "Metro Fresh",
        sourceRecipes: [recipe.recipeId],
        mappingConfidence: 0.95
      }
    ],
    totals: {
      itemCount: 3,
      groups: ["fleisch", "kaese", "obst_gemuese"]
    }
  };
  const clarificationAnswer: ProductionClarificationAnswer = {
    answerId: "answer-production-folder-1",
    context: {
      specId: spec.specId,
      productionSessionId: `production-session-${spec.specId}`
    },
    questionId: "manual-question-production-folder-1",
    questionKey: {
      reason: "readiness.reasons",
      reasonCode: "setup"
    },
    answerType: "shortText",
    status: "submitted",
    answerText: {
      kind: "shortText",
      value: "Aufbau ab 10 Uhr."
    }
  };

  return { spec, recipe, plan, purchaseList, clarificationAnswer };
}

describe("production folder export", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("renders all 9 section headings in order", () => {
    const input = fixture();
    const html = renderProductionFolderHtml({
      plan: input.plan,
      spec: input.spec,
      purchaseLists: [input.purchaseList],
      recipes: [input.recipe],
      clarificationAnswers: [input.clarificationAnswer]
    });
    const headings = [
      "1. Eckpunkte",
      "2. Verständnis des Angebots",
      "3. Rückfragen",
      "4. Fachliche Festlegungen",
      "5. Kalkulationsübersicht",
      "6. Mengenkalkulation je Gericht",
      "7. Rezeptkarten",
      "8. Einkaufsliste nach Metro-Logik",
      "9. Mise-en-Place &amp; Abschlussprüfung"
    ];
    let previousIndex = -1;

    for (const heading of headings) {
      const index = html.indexOf(heading);
      expect(index, heading).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
  });

  it("renders Metro group headings in canonical order", () => {
    const input = fixture();
    const html = renderProductionFolderHtml({
      plan: input.plan,
      spec: input.spec,
      purchaseLists: [input.purchaseList],
      recipes: [input.recipe]
    });

    expect(html.indexOf("<h3>Obst / Gemüse</h3>")).toBeLessThan(html.indexOf("<h3>Fleisch</h3>"));
    expect(html.indexOf("<h3>Fleisch</h3>")).toBeLessThan(html.indexOf("<h3>Käse</h3>"));
  });

  it("omits price rows when budgetContext is absent", () => {
    const input = fixture();
    const { budgetContext: _budgetContext, ...specWithoutBudget } = input.spec;
    const html = renderProductionFolderHtml({
      plan: input.plan,
      spec: specWithoutBudget,
      purchaseLists: [input.purchaseList],
      recipes: [input.recipe]
    });

    expect(html).not.toContain("<th>Preisrahmen</th>");
    expect(html).not.toContain("Speisenpreis pro Person");
    expect(html).not.toContain("Speisenpreis gesamt");
    expect(html).not.toContain("<th>Zielbudget</th>");
  });

  it("returns 404 for an unknown production plan", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildPrintExportApp({
      rootDir: dataRoot,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/exports/production-folders/unknown-plan/html",
        headers: trustedHeaders
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        message: "ProductionPlan nicht gefunden."
      });
    } finally {
      await app.close();
    }
  });

  it("serves a persisted production folder route from existing stores", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const input = fixture();
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const productionStore = new ProductionStore({ rootDir: dataRoot });
    const recipeLibrary = new RecipeLibrary([], { rootDir: dataRoot });
    await intakeStore.saveSpec(input.spec);
    await productionStore.savePlan(input.plan);
    await productionStore.savePurchaseList(input.purchaseList);
    await productionStore.saveClarificationAnswer(input.clarificationAnswer);
    await recipeLibrary.save(input.recipe);
    const app = buildPrintExportApp({
      rootDir: dataRoot,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/exports/production-folders/${input.plan.planId}/html`,
        headers: trustedHeaders
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("Produktionsmappe – Rezeptkarten und aufsummierte Einkaufsliste");
      expect(response.body).toContain("Vitello Tonnato");
      expect(response.body).toContain("Aufbau ab 10 Uhr.");
    } finally {
      await app.close();
    }
  });

  it("escapes recipe names instead of rendering raw script tags", () => {
    const input = fixture();
    const maliciousRecipe = {
      ...input.recipe,
      name: `<script>alert("x")</script>`
    };
    const html = renderProductionFolderHtml({
      plan: input.plan,
      spec: input.spec,
      purchaseLists: [input.purchaseList],
      recipes: [maliciousRecipe]
    });

    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
