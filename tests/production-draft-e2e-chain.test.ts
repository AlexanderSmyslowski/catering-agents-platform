import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "@catering/intake-service";
import { buildPrintExportApp } from "@catering/print-export";
import {
  buildProductionApp,
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  ProductionStore,
  RecipeDiscoveryService
} from "@catering/production-service";
import {
  createEventRequestFromManualForm,
  MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type ProductionDraft,
  type ProductionDraftStatus,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "@catering/shared-core";

const TRUSTED_SECRET = "production-draft-e2e-chain-secret";

function trustedHeaders(role: keyof typeof MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES) {
  return {
    "x-catering-trusted-secret": TRUSTED_SECRET,
    "x-catering-actor-name": MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES[role]
  };
}

function createDataRoot(prefix = "catering-agents-production-draft-e2e-"): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function expectJsonResponse<T>(response: { statusCode: number; body: string; json: () => unknown }): T {
  expect(response.statusCode, response.body).toBeGreaterThanOrEqual(200);
  expect(response.statusCode, response.body).toBeLessThan(300);
  return response.json() as T;
}

function recipeCandidate(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-draft-tomato-soup",
    name: "Vegetarische Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "fixture/production-draft-e2e-tomato-soup",
      retrievedAt: "2026-07-01T12:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.96,
      fitScore: 0.94,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "ingredient-tomatoes",
        name: "Tomaten",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "obst_gemuese",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten garen, passieren und bis zur Ausgabe heißhalten."
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

function eventSpec(draftId: string): AcceptedEventSpec {
  const request = createEventRequestFromManualForm({
    requestId: `${draftId}-request`,
    customerName: "Synthetic Draft Chain Account",
    eventType: "Buffet",
    eventDate: "2026-09-18",
    attendeeCount: 45,
    serviceForm: "Buffet",
    menuItems: ["Vegetarische Tomatensuppe"],
    notes: "Synthetischer Fixture-Fall ohne echte Kundendaten."
  });
  const spec = normalizeEventRequestToSpec(request, {
    sourceType: "manual_input",
    reference: request.requestId,
    commercialState: "manual"
  });

  return {
    ...spec,
    menuPlan: spec.menuPlan.map((component) => ({
      ...component,
      productionDecision: {
        mode: "scratch",
        notes: "Fixture-Draft nutzt eine interne Rezeptkarte."
      }
    }))
  };
}

async function buildDraft(draftId = "production-draft-e2e-chain-1"): Promise<ProductionDraft> {
  const spec = eventSpec(draftId);
  const fixtureRoot = createDataRoot("catering-agents-production-draft-fixture-");
  const repository = new InMemoryRecipeRepository([], { rootDir: fixtureRoot });

  try {
    await repository.save(recipeCandidate());
    const discoveryService = new RecipeDiscoveryService(repository, {
      searchRecipes: async () => []
    });
    const artifacts = await buildProductionArtifacts(spec, discoveryService);

    return {
      schemaVersion: SCHEMA_VERSION,
      draftId,
      status: "pending_review",
      createdAt: "2026-07-01T12:00:00.000Z",
      source: {
        kind: "agent_cli",
        receivedAt: "2026-07-01T12:00:00.000Z",
        sourceRef: "fixture:production-draft-e2e",
        providerId: "local-fixture",
        modelId: "operator-selected-model",
        inputHash: `sha256:input-${draftId}`,
        outputHash: `sha256:output-${draftId}`,
        runId: `run-${draftId}`
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
          cardId: "card-event-spec",
          kind: "event_data",
          title: "Eventdaten prüfen",
          summary: "Eventdaten aus dem Fixture-Draft prüfen.",
          decision: "pending",
          targetPath: "$.draftArtifacts.eventSpec",
          targetId: spec.specId,
          requiredApproval: true
        },
        {
          cardId: "card-production-plan",
          kind: "timeline",
          title: "Produktionsplan prüfen",
          summary: "Zeitplan und Mengen aus dem Fixture-Draft prüfen.",
          decision: "pending",
          targetPath: "$.draftArtifacts.productionPlan",
          targetId: artifacts.productionPlan.planId,
          requiredApproval: true
        },
        {
          cardId: "card-purchase-list",
          kind: "purchase_item",
          title: "Einkaufsliste prüfen",
          summary: "Einkaufsliste aus dem Fixture-Draft prüfen.",
          decision: "pending",
          targetPath: "$.draftArtifacts.purchaseList",
          targetId: artifacts.purchaseList.purchaseListId,
          requiredApproval: true
        },
        {
          cardId: "card-recipe",
          kind: "recipe",
          title: "Rezeptkarte prüfen",
          summary: "Rezeptkarte aus dem Fixture-Draft prüfen.",
          decision: "pending",
          targetPath: "$.draftArtifacts.recipes[0]",
          targetId: "recipe-draft-tomato-soup",
          requiredApproval: true
        }
      ],
      draftArtifacts: {
        eventSpec: spec,
        productionPlan: artifacts.productionPlan,
        purchaseList: artifacts.purchaseList,
        recipes: [recipeCandidate()],
        notes: ["Fixture-Draft wartet auf Review und Apply."]
      }
    };
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

async function productCounts(
  intakeApp: ReturnType<typeof buildIntakeApp>,
  productionApp: ReturnType<typeof buildProductionApp>
): Promise<{ specs: number; plans: number; purchaseLists: number }> {
  const specs = expectJsonResponse<{ items: AcceptedEventSpec[] }>(await intakeApp.inject({
    method: "GET",
    url: "/v1/intake/specs",
    headers: trustedHeaders("intake_operator")
  }));
  const plans = expectJsonResponse<{ items: ProductionPlan[] }>(await productionApp.inject({
    method: "GET",
    url: "/v1/production/plans",
    headers: trustedHeaders("production_operator")
  }));
  const purchaseLists = expectJsonResponse<{ items: PurchaseList[] }>(await productionApp.inject({
    method: "GET",
    url: "/v1/production/purchase-lists",
    headers: trustedHeaders("production_operator")
  }));

  return {
    specs: specs.items.length,
    plans: plans.items.length,
    purchaseLists: purchaseLists.items.length
  };
}

async function importDraft(
  productionApp: ReturnType<typeof buildProductionApp>,
  draft: ProductionDraft
): Promise<ProductionDraft> {
  const response = await productionApp.inject({
    method: "POST",
    url: "/v1/production/drafts",
    headers: trustedHeaders("production_operator"),
    payload: draft
  });

  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ draft: ProductionDraft }>().draft;
}

async function decideAllReviewCards(
  productionApp: ReturnType<typeof buildProductionApp>,
  draft: ProductionDraft
): Promise<void> {
  for (const card of draft.reviewCards) {
    const response = await productionApp.inject({
      method: "PATCH",
      url: `/v1/production/drafts/${draft.draftId}/review-cards/${card.cardId}`,
      headers: trustedHeaders("production_operator"),
      payload: {
        decision: "fits",
        operatorComment: "Fixture-Review passt."
      }
    });

    expect(response.statusCode, response.body).toBe(200);
  }
}

describe("ProductionDraft E2E chain", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("keeps imported drafts draft-only until approved apply materializes the production folder chain", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new InMemoryRecipeRepository([], { rootDir: dataRoot });
    const productionApp = buildProductionApp({
      dataRoot,
      repository,
      trustedActorSecret: TRUSTED_SECRET,
      env: {
        CATERING_ENABLE_WEB_RECIPE_SEARCH: "0"
      }
    });
    const intakeApp = buildIntakeApp({
      rootDir: dataRoot,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const exportApp = buildPrintExportApp({
      rootDir: dataRoot,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft();

    try {
      await expect(productCounts(intakeApp, productionApp)).resolves.toEqual({
        specs: 0,
        plans: 0,
        purchaseLists: 0
      });

      const importedDraft = await importDraft(productionApp, draft);
      expect(importedDraft.status).toBe("pending_review");
      await expect(repository.get("recipe-draft-tomato-soup")).resolves.toBeUndefined();
      await expect(productCounts(intakeApp, productionApp)).resolves.toEqual({
        specs: 0,
        plans: 0,
        purchaseLists: 0
      });

      await decideAllReviewCards(productionApp, draft);
      const approval = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/decision`,
        headers: trustedHeaders("production_operator"),
        payload: { approve: true }
      });
      expect(approval.statusCode, approval.body).toBe(200);
      expect(approval.json<{ draft: ProductionDraft }>().draft.status).toBe("approved");
      await expect(productCounts(intakeApp, productionApp)).resolves.toEqual({
        specs: 0,
        plans: 0,
        purchaseLists: 0
      });

      const apply = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/apply`,
        headers: trustedHeaders("production_operator")
      });
      const applied = expectJsonResponse<{
        draft: ProductionDraft;
        applied: { specId?: string; planId?: string; purchaseListId?: string; recipeIds?: string[] };
      }>(apply);

      expect(applied.applied).toMatchObject({
        specId: draft.draftArtifacts.eventSpec?.specId,
        planId: draft.draftArtifacts.productionPlan?.planId,
        purchaseListId: draft.draftArtifacts.purchaseList?.purchaseListId,
        recipeIds: ["recipe-draft-tomato-soup"]
      });
      await expect(productCounts(intakeApp, productionApp)).resolves.toEqual({
        specs: 1,
        plans: 1,
        purchaseLists: 1
      });

      const folderExport = await exportApp.inject({
        method: "GET",
        url: `/v1/exports/production-folders/${applied.applied.planId}/html`,
        headers: trustedHeaders("production_operator")
      });
      expect(folderExport.statusCode, folderExport.body).toBe(200);
      expect(folderExport.headers["content-type"]).toContain("text/html");
      expect(folderExport.body).toContain("Produktionsmappe");
      expect(folderExport.body).toContain(
        '<article class="recipe-card"><h3>Vegetarische Tomatensuppe Bankett</h3>'
      );
      expect(folderExport.body).toContain("<td>Tomaten</td>");
      expect(folderExport.body).toContain(
        "<li>Tomaten garen, passieren und bis zur Ausgabe heißhalten.</li>"
      );
      expect(folderExport.body).toContain("Status: Prüfung nötig");
      expect(folderExport.body).not.toContain("keine freigegebenen Rezeptkarten verknüpft");
    } finally {
      await Promise.all([
        productionApp.close(),
        intakeApp.close(),
        exportApp.close()
      ]);
    }
  });

  it("rejects apply for every non-approved draft status without changing product object counts", async () => {
    const cases: Array<{ status: Exclude<ProductionDraftStatus, "approved">; arrange: "route" | "decision" | "store" }> = [
      { status: "pending_review", arrange: "route" },
      { status: "rejected", arrange: "decision" },
      { status: "superseded", arrange: "store" }
    ];

    for (const { status, arrange } of cases) {
      const dataRoot = createDataRoot();
      dataRoots.push(dataRoot);
      const store = new ProductionStore({ rootDir: dataRoot });
      const productionApp = buildProductionApp({
        dataRoot,
        store,
        trustedActorSecret: TRUSTED_SECRET,
        env: {
          CATERING_ENABLE_WEB_RECIPE_SEARCH: "0"
        }
      });
      const intakeApp = buildIntakeApp({
        rootDir: dataRoot,
        trustedActorSecret: TRUSTED_SECRET,
        env: {}
      });
      const draft = await buildDraft(`production-draft-e2e-${status}`);

      try {
        if (arrange === "store") {
          // Superseded is a persisted draft status with no public transition route yet;
          // this setup arranges only the stored state, then exercises the real Apply route.
          await store.saveProductionDraft({
            ...draft,
            status: "superseded",
            supersedesDraftId: `${draft.draftId}-newer`
          });
        } else {
          await importDraft(productionApp, draft);
          if (arrange === "decision") {
            const rejection = await productionApp.inject({
              method: "POST",
              url: `/v1/production/drafts/${draft.draftId}/decision`,
              headers: trustedHeaders("production_operator"),
              payload: { approve: false }
            });
            expect(rejection.statusCode, rejection.body).toBe(200);
            expect(rejection.json<{ draft: ProductionDraft }>().draft.status).toBe(status);
          }
        }

        const before = await productCounts(intakeApp, productionApp);
        const apply = await productionApp.inject({
          method: "POST",
          url: `/v1/production/drafts/${draft.draftId}/apply`,
          headers: trustedHeaders("production_operator")
        });
        const after = await productCounts(intakeApp, productionApp);

        expect(apply.statusCode, apply.body).toBe(409);
        expect(apply.body).toContain("ProductionDraft muss vor der Übernahme freigegeben sein.");
        expect(after).toEqual(before);
      } finally {
        await Promise.all([
          productionApp.close(),
          intakeApp.close()
        ]);
      }
    }
  });
});
