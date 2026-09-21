import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  approvalRequestIdForTarget,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  validateApprovalRequestRecord,
  type ApprovalRequestRecord,
  type ProductionDraft,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";
import { buildProductionApp } from "../production-service/src/app.js";
import { QuantityOverrideStore } from "../production-service/src/quantity-workflow/override-store.js";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";

const TRUSTED_SECRET = "gate-b-read-only-secret";
const localBusiness = { businessId: "local" } as const;

const headersFor = (actorName: string) => ({
  "x-catering-trusted-secret": TRUSTED_SECRET,
  "x-catering-actor-name": actorName,
  "x-catering-business-id": "local"
});

const readOnlyHeaders = headersFor("Read-only-Mitarbeiter");
const productionHeaders = headersFor("Produktions-Mitarbeiter");
const adminHeaders = headersFor("Administrator");

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-gate-b-read-only-"));
}

function expectStatus(response: { statusCode: number; body: string }, expected: number): void {
  expect(response.statusCode, response.body).toBe(expected);
}

function commercialKeyPaths(value: unknown, prefix = "$"): string[] {
  const commercialKeys = new Set([
    "pricing",
    "pricingsnapshot",
    "pricingsummary",
    "targetbudget",
    "estimatedprice",
    "price",
    "unitprice",
    "salesprice",
    "purchaseprice",
    "cost",
    "costs",
    "margin"
  ]);
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => commercialKeyPaths(entry, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    commercialKeys.has(key.toLowerCase())
      ? [`${prefix}.${key}`]
      : commercialKeyPaths(nested, `${prefix}.${key}`)
  );
}

function expectCommercialsAbsent(value: unknown): void {
  expect(commercialKeyPaths(value)).toEqual([]);
  expect(JSON.stringify(value)).not.toContain("COMMERCIAL_SENTINEL");
  expect(JSON.stringify(value)).not.toContain("9876.54");
}

function productionPlanWithCommercialSentinels(): ProductionPlan {
  return {
    schemaVersion: SCHEMA_VERSION,
    planId: "plan-read-only-1",
    eventSpecId: "spec-read-only-1",
    readiness: { status: "complete", reasons: [] },
    productionBatches: [
      {
        batchId: "batch-roastbeef",
        componentId: "component-roastbeef",
        recipeId: "recipe-roastbeef",
        scaledYield: { amount: 45, unit: "servings" },
        batchCount: 1,
        lossFactor: 1.1,
        gnPlan: [{ container: "GN 1/1 65 mm", count: 2 }],
        station: "Warme Küche",
        prepWindow: "Vortag 14:00",
        ingredients: [
          {
            ingredientId: "roastbeef",
            name: "Roastbeef",
            quantity: { amount: 3100, unit: "g" },
            group: "Fleisch",
            purchaseUnit: "kg",
            normalizedUnit: "g",
            purchasePrice: 9876.54
          } as never
        ],
        steps: [
          {
            index: 1,
            instruction: "Bei 230 °C garen und bei 54 °C Kerntemperatur zehn Minuten ruhen lassen.",
            durationMinutes: 35
          }
        ],
        recipeSource: {
          recipeId: "recipe-roastbeef",
          recipeName: "Roastbeef",
          sourceTier: "internal_verified",
          originType: "internal_db",
          approvalState: "approved_internal",
          reference: "THE ONE Rezeptbasis"
        },
        unitCost: 9876.54
      } as never
    ],
    timeline: [{ label: "Roastbeef in den Ofen", at: "2026-09-18T09:00:00.000Z" }],
    kitchenSheets: [
      {
        title: "Roastbeef",
        instructions: ["Mise en Place prüfen.", "Kerntemperatur dokumentieren."],
        componentId: "component-roastbeef",
        productionQty: { amount: 45, unit: "servings" },
        station: "Warme Küche",
        prepWindow: "Vortag 14:00",
        ingredients: [
          {
            ingredientId: "roastbeef",
            name: "Roastbeef",
            quantity: { amount: 3100, unit: "g" },
            group: "Fleisch"
          }
        ],
        steps: [
          {
            index: 1,
            instruction: "Bei 230 °C garen und bei 54 °C Kerntemperatur zehn Minuten ruhen lassen.",
            durationMinutes: 35
          }
        ],
        recipeId: "recipe-roastbeef",
        allergens: ["egg", "mustard"],
        dietTags: [],
        procurementNotes: ["Roastbeef am Vortag anliefern."],
        blockingNotes: [],
        gnPlan: [{ container: "GN 1/1 65 mm", count: 2 }],
        pricing: { internalNote: "COMMERCIAL_SENTINEL" }
      } as never
    ],
    recipeSelections: [
      {
        componentId: "component-roastbeef",
        recipeId: "recipe-roastbeef",
        selectionReason: "Menschlich bestätigte THE-ONE-Rezeptbasis.",
        autoUsedInternetRecipe: false,
        sourceTier: "internal_verified",
        qualityScore: 1,
        fitScore: 1
      }
    ],
    componentReadiness: [
      {
        componentId: "component-roastbeef",
        label: "Roastbeef",
        status: "operational",
        reason: "Mengen und Rezept sind bestätigt.",
        hasProductionBatch: true,
        hasKitchenSheet: true,
        includedInPurchaseList: true,
        blocksProduction: false
      }
    ],
    unresolvedItems: [],
    warnings: [],
    blockingIssues: [],
    pricingSnapshot: { internalNote: "COMMERCIAL_SENTINEL" },
    targetBudget: { amount: 9876.54, currency: "EUR" },
    margin: 9876.54
  } as never;
}

function purchaseListWithCommercialSentinels(): PurchaseList {
  return {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: "purchase-read-only-1",
    eventSpecId: "spec-read-only-1",
    items: [
      {
        ingredientId: "roastbeef",
        displayName: "Roastbeef",
        normalizedQty: 3.1,
        normalizedUnit: "kg",
        purchaseQty: 3.1,
        purchaseUnit: "kg",
        group: "Fleisch",
        supplierHint: "Metzger",
        sourceRecipes: ["Roastbeef"],
        sourceRecipeMetadata: [
          {
            recipeId: "recipe-roastbeef",
            recipeName: "Roastbeef",
            sourceTier: "internal_verified",
            originType: "internal_db",
            approvalState: "approved_internal",
            reference: "THE ONE Rezeptbasis"
          }
        ],
        mappingConfidence: 1,
        purchasePrice: 9876.54,
        cost: "COMMERCIAL_SENTINEL"
      } as never
    ],
    groupingMode: "group",
    totals: { itemCount: 1, groups: ["Fleisch"] },
    pricingSummary: { internalNote: "COMMERCIAL_SENTINEL" },
    margin: 9876.54
  } as never;
}

function productionDraft(): ProductionDraft {
  const eventSpec = normalizeEventRequestToSpec(
    createEventRequestFromText({
      requestId: "read-only-production-request",
      channel: "text",
      rawText: "Business Lunch am 2026-09-18 für 45 Personen mit Roastbeef."
    })
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    businessId: "local",
    draftId: "draft-read-only-side-effect",
    revision: 1,
    status: "pending_review",
    createdAt: "2026-08-27T10:00:00.000Z",
    source: {
      kind: "manual_import",
      receivedAt: "2026-08-27T10:00:00.000Z",
      sourceRef: "read-only-side-effect-test"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [
      {
        cardId: "card-read-only-side-effect",
        kind: "event_data",
        title: "Auftragsdaten prüfen",
        summary: "Read-only darf diese Karte nicht entscheiden.",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: eventSpec.specId,
        requiredApproval: true
      }
    ],
    draftArtifacts: { eventSpec }
  };
}

const productionMutations = [
  ["POST", "/v1/production/approved-specs/approved-read-only/apply", {}],
  ["POST", "/v1/production/cases", {}],
  ["POST", "/v1/production/cases/case-read-only/copies", {}],
  ["POST", "/v1/production/cases/case-read-only/messages", { text: "Mutation verboten." }],
  ["POST", "/v1/production/cases/case-read-only/quantity-workflow/component-read-only/confirm", { previewId: "preview-read-only", edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }],
  ["POST", "/v1/production/cases/case-read-only/quantity-workflow/component-read-only/preview", { edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }],
  ["POST", "/v1/production/cases/from-handoff/handoff-read-only", {}],
  ["POST", "/v1/production/clarification-drafts/clarification-read-only/decision", { approve: false }],
  ["POST", "/v1/production/drafts", productionDraft()],
  ["POST", "/v1/production/drafts/draft-read-only-side-effect/decision", { decision: "rejected" }],
  ["POST", "/v1/production/drafts/draft-read-only-side-effect/prepare", {}],
  ["PATCH", "/v1/production/drafts/draft-read-only-side-effect/review-cards/card-read-only-side-effect", { decision: "fits" }],
  ["POST", "/v1/production/drafts/draft-read-only-side-effect/revise", {}],
  ["POST", "/v1/production/drafts/from-document", { caseId: "case-read-only", documentId: "document-read-only" }],
  ["POST", "/v1/production/drafts/from-handoff/handoff-read-only", { caseId: "case-read-only" }],
  ["POST", "/v1/production/feedback-drafts", { feedback: { summary: "Mutation", observations: [], changeRequests: [] } }],
  ["POST", "/v1/production/feedback-drafts/feedback-read-only/decision", { approve: false }],
  ["PATCH", "/v1/production/recipes/recipe-read-only/review", { decision: "verify" }],
  ["POST", "/v1/production/recipes/import-text", { recipeName: "Read-only", text: "Zutaten\n1 kg Wasser" }],
  ["POST", "/v1/production/recipes/upload", undefined],
  ["POST", "/v1/production/seed-demo", {}],
  ["POST", "/v1/production/specs/spec-read-only/clarification-drafts", undefined]
] as const;

const forbiddenProductionReads = [
  "/v1/production/audit/events",
  "/v1/production/cases",
  "/v1/production/cases/case-read-only",
  "/v1/production/cases/case-read-only/quantity-workflow",
  "/v1/production/drafts",
  "/v1/production/knowledge/production-feedback",
  "/v1/production/recipes",
  "/v1/production/recipes/recipe-read-only",
  "/v1/production/specs/spec-read-only/clarification-drafts"
] as const;

describe("Gate B read-only Production API", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [dataRoot], { stdio: "ignore" });
      } catch {
        // Testdaten liegen außerhalb des Repositorys; fehlendes Trash darf den Vertragsnachweis nicht maskieren.
      }
    }
  });

  it("reports the canonical Production capability on the plan list and denies missing or unknown roles", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildProductionApp({ dataRoot, trustedActorSecret: TRUSTED_SECRET, env: { CATERING_DEV_AUTH: "1" } });

    try {
      const readOnlyResponse = await app.inject({
        method: "GET",
        url: "/v1/production/plans",
        headers: readOnlyHeaders
      });
      expectStatus(readOnlyResponse, 200);
      expect(readOnlyResponse.json()).toMatchObject({
        access: { canOperateProduction: false }
      });

      for (const headers of [productionHeaders, adminHeaders]) {
        const operatorResponse = await app.inject({
          method: "GET",
          url: "/v1/production/plans",
          headers
        });
        expectStatus(operatorResponse, 200);
        expect(operatorResponse.json()).toMatchObject({
          access: { canOperateProduction: true }
        });
      }

      for (const headers of [headersFor("Unbekannte Rolle"), undefined]) {
        const forbiddenResponse = await app.inject({
          method: "GET",
          url: "/v1/production/plans",
          ...(headers ? { headers } : {})
        });
        expectStatus(forbiddenResponse, 403);
        expect(forbiddenResponse.json()).not.toHaveProperty("access");
      }
    } finally {
      await app.close();
    }
  });

  it("allows exactly the four operational artifact reads and projects commercial data away server-side", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    await store.savePlan(localBusiness, productionPlanWithCommercialSentinels());
    await store.savePurchaseList(localBusiness, purchaseListWithCommercialSentinels());
    const app = buildProductionApp({ dataRoot, store, trustedActorSecret: TRUSTED_SECRET, env: { CATERING_DEV_AUTH: "1" } });

    try {
      const readOnlyResponses = await Promise.all([
        app.inject({ method: "GET", url: "/v1/production/plans", headers: readOnlyHeaders }),
        app.inject({ method: "GET", url: "/v1/production/plans/plan-read-only-1", headers: readOnlyHeaders }),
        app.inject({ method: "GET", url: "/v1/production/purchase-lists", headers: readOnlyHeaders }),
        app.inject({ method: "GET", url: "/v1/production/purchase-lists/purchase-read-only-1", headers: readOnlyHeaders })
      ]);
      for (const response of readOnlyResponses) {
        expectStatus(response, 200);
        expectCommercialsAbsent(response.json());
      }

      const plan = readOnlyResponses[1].json<ProductionPlan>();
      expect(plan).toMatchObject({
        planId: "plan-read-only-1",
        productionBatches: [{ scaledYield: { amount: 45, unit: "servings" }, ingredients: [{ quantity: { amount: 3100, unit: "g" } }], steps: [{ durationMinutes: 35 }] }],
        kitchenSheets: [{ productionQty: { amount: 45, unit: "servings" }, allergens: ["egg", "mustard"], gnPlan: [{ container: "GN 1/1 65 mm", count: 2 }] }],
        timeline: [{ at: "2026-09-18T09:00:00.000Z" }]
      });
      expect(JSON.stringify(plan)).toContain("230 °C");
      expect(JSON.stringify(plan)).toContain("54 °C");

      const purchaseList = readOnlyResponses[3].json<PurchaseList>();
      expect(purchaseList).toMatchObject({
        purchaseListId: "purchase-read-only-1",
        items: [{ displayName: "Roastbeef", purchaseQty: 3.1, purchaseUnit: "kg", supplierHint: "Metzger" }]
      });

      const productionPlan = await app.inject({
        method: "GET",
        url: "/v1/production/plans/plan-read-only-1",
        headers: productionHeaders
      });
      expectStatus(productionPlan, 200);
      expectCommercialsAbsent(productionPlan.json());
      expect(productionPlan.json()).toMatchObject({ planId: "plan-read-only-1" });

      const adminPlan = await app.inject({
        method: "GET",
        url: "/v1/production/plans/plan-read-only-1",
        headers: adminHeaders
      });
      expectStatus(adminPlan, 200);
      expect(adminPlan.json()).toMatchObject({
        pricingSnapshot: { internalNote: "COMMERCIAL_SENTINEL" },
        targetBudget: { amount: 9876.54, currency: "EUR" },
        margin: 9876.54
      });
    } finally {
      await app.close();
    }
  });

  it.each(forbiddenProductionReads)("keeps non-artifact GET %s forbidden for Read-only", async (url) => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildProductionApp({ dataRoot, trustedActorSecret: TRUSTED_SECRET, env: { CATERING_DEV_AUTH: "1" } });
    try {
      const response = await app.inject({ method: "GET", url, headers: readOnlyHeaders });
      expectStatus(response, 403);
    } finally {
      await app.close();
    }
  });

  it("keeps the Read-only mutation matrix complete at all 22 Production routes", () => {
    expect(productionMutations.map(([method, url]) => `${method} ${url}`)).toHaveLength(22);
  });

  it.each(productionMutations)("rejects Read-only mutation %s %s", async (method, url, payload) => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildProductionApp({ dataRoot, trustedActorSecret: TRUSTED_SECRET, env: { CATERING_DEV_AUTH: "1" } });
    try {
      const response = await app.inject({
        method,
        url,
        headers: readOnlyHeaders,
        ...(payload === undefined ? {} : { payload })
      });
      expectStatus(response, 403);
    } finally {
      await app.close();
    }
  });

  it("leaves approvals, apply artifacts, review decisions and quantity overrides unchanged", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const quantityOverrideStore = new QuantityOverrideStore({ rootDir: dataRoot });
    const draft = productionDraft();
    await store.saveProductionDraft(localBusiness, draft);
    const app = buildProductionApp({
      dataRoot,
      store,
      quantityOverrideStore,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });

    try {
      const reviewed = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${draft.reviewCards[0].cardId}`,
        headers: readOnlyHeaders,
        payload: { decision: "fits" }
      });
      expectStatus(reviewed, 403);

      const decided = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/decision`,
        headers: readOnlyHeaders,
        payload: { decision: "rejected" }
      });
      expectStatus(decided, 403);

      const applied = await app.inject({
        method: "POST",
        url: "/v1/production/approved-specs/approved-read-only/apply",
        headers: readOnlyHeaders,
        payload: {}
      });
      expectStatus(applied, 403);

      for (const suffix of ["preview", "confirm"] as const) {
        const quantity = await app.inject({
          method: "POST",
          url: `/v1/production/cases/case-read-only/quantity-workflow/component-read-only/${suffix}`,
          headers: readOnlyHeaders,
          payload: suffix === "preview"
            ? { edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }
            : { previewId: "preview-read-only", edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }
        });
        expectStatus(quantity, 403);
      }

      await expect(store.getProductionDraft(localBusiness, draft.draftId)).resolves.toEqual(draft);
      await expect(store.listApprovalsForTarget(localBusiness, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).resolves.toEqual([]);
      await expect(store.listApplyManifests(localBusiness)).resolves.toEqual([]);
      await expect(store.listPlans(localBusiness)).resolves.toEqual([]);
      await expect(store.listPurchaseLists(localBusiness)).resolves.toEqual([]);
      await expect(quantityOverrideStore.latestFor(localBusiness, "spec-read-only", "component-read-only"))
        .resolves.toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("keeps Read-only outside the canonical ApprovalRequest role contract", () => {
    const target = {
      kind: "production_draft" as const,
      artifactId: "draft-read-only-approval",
      revision: 1
    };
    const record = {
      schemaVersion: "1.0",
      approvalRequestId: approvalRequestIdForTarget({ businessId: "local", target }),
      businessId: "local",
      target,
      decision: "approved",
      requestedAt: "2026-08-27T10:00:00.000Z",
      decidedAt: "2026-08-27T10:01:00.000Z",
      decidedBy: {
        name: "Read-only-Mitarbeiter",
        role: "read_only_operator",
        source: "trusted-proxy:x-catering-actor-name"
      }
    } as ApprovalRequestRecord;

    expect(() => validateApprovalRequestRecord(record)).toThrow();
  });
});
