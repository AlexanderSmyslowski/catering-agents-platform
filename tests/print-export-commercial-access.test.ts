import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IntakeStore } from "@catering/intake-service";
import { buildPrintExportApp } from "@catering/print-export";
import { ProductionStore } from "@catering/production-service";
import {
  RecipeLibrary,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "@catering/shared-core";
import { buildOfferApp } from "../offer-service/src/app.js";

const TRUSTED_SECRET = "gate-b-export-commercial-secret";
const localBusiness = { businessId: "local" } as const;

const headersFor = (actorName: string) => ({
  "x-catering-trusted-secret": TRUSTED_SECRET,
  "x-catering-actor-name": actorName,
  "x-catering-business-id": "local"
});

const adminHeaders = headersFor("Administrator");
const offerHeaders = headersFor("Angebots-Mitarbeiter");
const productionHeaders = headersFor("Produktions-Mitarbeiter");
const readOnlyHeaders = headersFor("Read-only-Mitarbeiter");
const auditHeaders = headersFor("Betriebs-/Audit-Operator");

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-gate-b-print-export-commercial-"));
}

function commercialSpec(): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-export-commercial-1",
    lifecycle: { commercialState: "accepted" },
    readiness: { status: "complete", reasons: [] },
    sourceLineage: [{ sourceType: "manual_input", reference: "export-commercial-fixture" }],
    customer: { name: "Pseudonymisierte Organisation" },
    event: { date: "2026-09-18", serviceForm: "buffet" },
    attendees: { expected: 45 },
    venue: { name: "Testsaal", address: "Teststraße 1" },
    servicePlan: {
      eventType: "conference",
      serviceForm: "buffet",
      modules: [
        {
          moduleId: "module-commercial-sentinel",
          label: "Service ohne Preisrecht",
          category: "service",
          pricing: { amount: 5555.55, currency: "EUR" }
        }
      ]
    },
    menuPlan: [
      {
        componentId: "component-operational-sentinel",
        label: "Operatives Kontrollgericht",
        servings: 45,
        menuCategory: "classic"
      }
    ],
    budgetContext: {
      targetBudget: { amount: 8192.44, currency: "EUR" },
      pricingSummary: {
        perPerson: { amount: 913.57, currency: "EUR" },
        subtotal: { amount: 7314.29, currency: "EUR" },
        notes: ["COMMERCIAL_SENTINEL"]
      }
    },
    assumptions: [
      { code: "operational", message: "Operative Kücheninformation bleibt sichtbar.", applied: true }
    ]
  };
}

function operationalRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-operational-sentinel",
    name: "Operatives Kontrollgericht",
    source: {
      tier: "internal_approved",
      originType: "approved_import",
      reference: "internal:operational-sentinel",
      retrievedAt: "2026-09-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: { servings: 45, unit: "servings" },
    ingredients: [
      {
        ingredientId: "ingredient-operational-sentinel",
        name: "Operative Zutat",
        quantity: { amount: 3.1, unit: "kg" },
        group: "fleisch"
      }
    ],
    steps: [{ index: 1, instruction: "Operativen Kontrollschritt ausführen." }],
    scalingRules: { defaultLossFactor: 1.1, batchSize: 45 },
    allergens: ["egg"],
    dietTags: []
  };
}

function operationalPlan(spec: AcceptedEventSpec, recipe: Recipe): ProductionPlan {
  return {
    schemaVersion: SCHEMA_VERSION,
    planId: "plan-export-commercial-1",
    eventSpecId: spec.specId,
    readiness: { status: "complete", reasons: [] },
    productionBatches: [
      {
        batchId: "batch-operational-sentinel",
        componentId: "component-operational-sentinel",
        recipeId: recipe.recipeId,
        scaledYield: { amount: 45, unit: "servings" },
        batchCount: 1,
        lossFactor: 1.1,
        gnPlan: [{ container: "GN 1/1 65 mm", count: 2 }],
        station: "Warme Küche",
        prepWindow: "2026-09-18T09:00:00.000Z",
        ingredients: recipe.ingredients,
        steps: recipe.steps
      }
    ],
    timeline: [{ label: "Mise en Place", at: "2026-09-18T09:00:00.000Z" }],
    kitchenSheets: [
      {
        title: "Operatives Kontrollgericht",
        instructions: ["Operativen Kontrollschritt ausführen."],
        componentId: "component-operational-sentinel",
        recipeId: recipe.recipeId,
        productionQty: { amount: 45, unit: "servings" },
        station: "Warme Küche",
        prepWindow: "2026-09-18T09:00:00.000Z",
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        allergens: ["egg"]
      }
    ],
    recipeSelections: [
      {
        componentId: "component-operational-sentinel",
        recipeId: recipe.recipeId,
        selectionReason: "Operative Rezeptkarte.",
        autoUsedInternetRecipe: false
      }
    ],
    unresolvedItems: []
  };
}

function operationalPurchaseList(spec: AcceptedEventSpec, recipe: Recipe): PurchaseList {
  return {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: "purchase-export-commercial-1",
    eventSpecId: spec.specId,
    groupingMode: "group",
    items: [
      {
        ingredientId: "ingredient-operational-sentinel",
        displayName: "Operative Zutat",
        normalizedQty: 3.1,
        normalizedUnit: "kg",
        purchaseQty: 3.1,
        purchaseUnit: "kg",
        group: "fleisch",
        supplierHint: "Operativer Lieferhinweis",
        sourceRecipes: [recipe.recipeId],
        mappingConfidence: 1
      }
    ],
    totals: { itemCount: 1, groups: ["fleisch"] }
  };
}

async function seedProductionExportArtifacts(rootDir: string) {
  const spec = commercialSpec();
  const recipe = operationalRecipe();
  const plan = operationalPlan(spec, recipe);
  const purchaseList = operationalPurchaseList(spec, recipe);
  const intakeStore = new IntakeStore({ rootDir });
  const productionStore = new ProductionStore({ rootDir });
  const recipeLibrary = new RecipeLibrary({ rootDir });

  await intakeStore.saveSpec(localBusiness, spec);
  await productionStore.savePlan(localBusiness, plan);
  await productionStore.savePurchaseList(localBusiness, purchaseList);
  await recipeLibrary.save(localBusiness, recipe);

  return { plan, purchaseList };
}

async function seedOfferDraft(rootDir: string): Promise<string> {
  const offerApp = buildOfferApp({ rootDir, trustedActorSecret: TRUSTED_SECRET, env: {} });
  try {
    const seeded = await offerApp.inject({
      method: "POST",
      url: "/v1/offers/seed-demo",
      headers: auditHeaders
    });
    expect(seeded.statusCode, seeded.body).toBe(201);
    return seeded.json<{ seeded: Array<{ draftId: string }> }>().seeded[0]!.draftId;
  } finally {
    await offerApp.close();
  }
}

describe("Gate B print-export commercial confidentiality", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [dataRoot], { stdio: "ignore" });
      } catch {
        // Test data is outside the repository; a denied Trash operation must not mask the route contract.
      }
    }
  });

  it("redacts persisted commercial spec values for production exports while preserving the admin folder", async () => {
    const rootDir = createDataRoot();
    dataRoots.push(rootDir);
    const { plan } = await seedProductionExportArtifacts(rootDir);
    const app = buildPrintExportApp({ rootDir, trustedActorSecret: TRUSTED_SECRET, env: {} });

    try {
      const [productionPlan, productionFolder, adminFolder] = await Promise.all([
        app.inject({
          method: "GET",
          url: `/v1/exports/production-plans/${plan.planId}/html`,
          headers: productionHeaders
        }),
        app.inject({
          method: "GET",
          url: `/v1/exports/production-folders/${plan.planId}/html`,
          headers: productionHeaders
        }),
        app.inject({
          method: "GET",
          url: `/v1/exports/production-folders/${plan.planId}/html`,
          headers: adminHeaders
        })
      ]);

      expect(productionPlan.statusCode, productionPlan.body).toBe(200);
      expect(productionPlan.body).toContain("Operatives Kontrollgericht");
      expect(productionPlan.body).toContain("Operativen Kontrollschritt ausführen.");
      expect(productionFolder.statusCode, productionFolder.body).toBe(200);
      expect(productionFolder.body).toContain("Operative Zutat");
      expect(productionFolder.body).toContain("Operativen Kontrollschritt ausführen.");

      for (const body of [productionPlan.body, productionFolder.body]) {
        expect(body).not.toContain("Preisrahmen");
        expect(body).not.toContain("Speisenpreis pro Person");
        expect(body).not.toContain("Speisenpreis gesamt");
        expect(body).not.toContain("Zielbudget");
        expect(body).not.toContain("8.192,44 EUR");
        expect(body).not.toContain("913,57 EUR");
        expect(body).not.toContain("7.314,29 EUR");
        expect(body).not.toContain("5.555,55 EUR");
        expect(body).not.toContain("COMMERCIAL_SENTINEL");
      }

      expect(adminFolder.statusCode, adminFolder.body).toBe(200);
      expect(adminFolder.body).toContain("Preisrahmen");
      expect(adminFolder.body).toContain("Speisenpreis pro Person");
      expect(adminFolder.body).toContain("Speisenpreis gesamt");
      expect(adminFolder.body).toContain("Zielbudget");
      expect(adminFolder.body).toContain("8.192,44 EUR");
      expect(adminFolder.body).toContain("913,57 EUR");
      expect(adminFolder.body).toContain("7.314,29 EUR");
    } finally {
      await app.close();
    }
  });

  it("keeps offer, production and read-only export roles constrained", async () => {
    const rootDir = createDataRoot();
    dataRoots.push(rootDir);
    const { plan, purchaseList } = await seedProductionExportArtifacts(rootDir);
    const offerDraftId = await seedOfferDraft(rootDir);
    const app = buildPrintExportApp({ rootDir, trustedActorSecret: TRUSTED_SECRET, env: {} });

    try {
      for (const headers of [offerHeaders, adminHeaders]) {
        const response = await app.inject({
          method: "GET",
          url: `/v1/exports/offers/${offerDraftId}/html`,
          headers
        });
        expect(response.statusCode, response.body).toBe(200);
      }

      for (const headers of [productionHeaders, readOnlyHeaders]) {
        const response = await app.inject({
          method: "GET",
          url: `/v1/exports/offers/${offerDraftId}/html`,
          headers
        });
        expect(response.statusCode, response.body).toBe(403);
      }

      for (const route of [
        `/v1/exports/production-plans/${plan.planId}/html`,
        `/v1/exports/production-folders/${plan.planId}/html`,
        `/v1/exports/purchase-lists/${purchaseList.purchaseListId}/csv`
      ]) {
        for (const headers of [productionHeaders, adminHeaders]) {
          const response = await app.inject({ method: "GET", url: route, headers });
          expect(response.statusCode, response.body).toBe(200);
        }
        const readOnlyResponse = await app.inject({ method: "GET", url: route, headers: readOnlyHeaders });
        expect(readOnlyResponse.statusCode, readOnlyResponse.body).toBe(403);
      }
    } finally {
      await app.close();
    }
  });
});
