import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProductionApp,
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  ProductionStore,
  RecipeDiscoveryService
} from "@catering/production-service";
import {
  AuditLogStore,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type ProductionDraft,
  type Recipe
} from "@catering/shared-core";

const TRUSTED_SECRET = "production-draft-apply-secret";
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-draft-apply-"));
}

function eventSpec(): AcceptedEventSpec {
  return normalizeEventRequestToSpec(
    createEventRequestFromText({
      requestId: "production-draft-apply-request-1",
      channel: "text",
      rawText: "Buffet am 2026-09-18 für 45 Personen mit vegetarischer Tomatensuppe."
    })
  );
}

async function buildDraft(draftId = "production-draft-apply-1"): Promise<ProductionDraft> {
  const spec = eventSpec();
  const discoveryService = new RecipeDiscoveryService(
    new InMemoryRecipeRepository(),
    {
      searchRecipes: async () => []
    }
  );
  const artifacts = await buildProductionArtifacts(spec, discoveryService, { context: { businessId: "local" } });

  return {
    schemaVersion: SCHEMA_VERSION,
    businessId: "local",
    draftId,
    revision: 1,
    status: "pending_review",
    createdAt: "2026-07-01T12:00:00.000Z",
    source: {
      kind: "agent_cli",
      receivedAt: "2026-07-01T12:00:00.000Z",
      sourceRef: "upload:angebot-koepff.pdf",
      providerId: "local-codex-cli",
      modelId: "operator-selected-model",
      inputHash: "sha256:input-redacted",
      outputHash: "sha256:output-structured",
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
        cardId: "card-event",
        kind: "event_data",
        title: "SECRET_REVIEW_TITLE",
        summary: "SECRET_REVIEW_SUMMARY",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: spec.specId,
        requiredApproval: true
      },
      {
        cardId: "card-production-plan",
        kind: "timeline",
        title: "SECRET_PLAN_REVIEW_TITLE",
        summary: "SECRET_PLAN_REVIEW_SUMMARY",
        decision: "pending",
        targetPath: "$.draftArtifacts.productionPlan",
        targetId: artifacts.productionPlan.planId,
        requiredApproval: true
      },
      {
        cardId: "card-purchase-list",
        kind: "purchase_item",
        title: "SECRET_PURCHASE_REVIEW_TITLE",
        summary: "SECRET_PURCHASE_REVIEW_SUMMARY",
        decision: "pending",
        targetPath: "$.draftArtifacts.purchaseList",
        targetId: artifacts.purchaseList.purchaseListId,
        requiredApproval: true
      },
      {
        cardId: "card-recipe",
        kind: "recipe",
        title: "SECRET_RECIPE_REVIEW_TITLE",
        summary: "SECRET_RECIPE_REVIEW_SUMMARY",
        decision: "pending",
        targetPath: "$.draftArtifacts.recipes[0]",
        targetId: "recipe-draft-vitello",
        requiredApproval: true
      }
    ],
    draftArtifacts: {
      eventSpec: spec,
      productionPlan: artifacts.productionPlan,
      purchaseList: artifacts.purchaseList,
      recipes: [recipeCandidate()],
      notes: ["SECRET_DRAFT_NOTE"]
    }
  };
}

function recipeCandidate(recipeId = "recipe-draft-vitello"): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId,
    name: "SECRET_RECIPE_NAME",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "KI-Entwurf aus Upload, noch nicht produktionsgeprüft",
      retrievedAt: "2026-07-01T12:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.92,
      fitScore: 0.88,
      extractionCompleteness: 0.9
    },
    baseYield: {
      servings: 45,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "ingredient-kalbsnuss",
        name: "Kalbsnuss, roh",
        quantity: {
          amount: 3200,
          unit: "g"
        },
        group: "fleisch"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Kalbsnuss garen, auskühlen lassen und dünn aufschneiden."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.29
    },
    allergens: ["fisch", "ei"],
    dietTags: []
  };
}

async function importApproveAndApply(
  app: ReturnType<typeof buildProductionApp>,
  draft: ProductionDraft
) {
  const imported = await app.inject({
    method: "POST",
    url: "/v1/production/drafts",
    headers: trustedProductionHeaders,
    payload: draft
  });
  expect(imported.statusCode).toBe(201);

  for (const card of draft.reviewCards) {
    const reviewed = await app.inject({
      method: "PATCH",
      url: `/v1/production/drafts/${draft.draftId}/review-cards/${card.cardId}`,
      headers: trustedProductionHeaders,
      payload: {
        decision: "fits",
        operatorComment: "SECRET_OPERATOR_COMMENT"
      }
    });
    expect(reviewed.statusCode).toBe(200);
  }

  const approved = await app.inject({
    method: "POST",
    url: `/v1/production/drafts/${draft.draftId}/decision`,
    headers: trustedProductionHeaders,
    payload: { decision: "approved" }
  });
  expect(approved.statusCode).toBe(201);
  const approvedProductionSpecId = approved.json<{
    approvedProductionSpec: { approvedProductionSpecId: string };
  }>().approvedProductionSpec.approvedProductionSpecId;

  return app.inject({
    method: "POST",
    url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
    headers: trustedProductionHeaders
  });
}

describe("ProductionDraft apply", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("materializes approved draft artifacts without leaking review text into audit details", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft();

    try {
      const response = await importApproveAndApply(app, draft);
      const body = response.json<{
        eventSpec: AcceptedEventSpec;
        plan: ProductionDraft["draftArtifacts"]["productionPlan"];
        purchaseList: ProductionDraft["draftArtifacts"]["purchaseList"];
        recipes: Recipe[];
      }>();
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 20));

      expect(response.statusCode).toBe(200);
      expect(body.eventSpec.specId).toBe(draft.draftArtifacts.eventSpec?.specId);
      expect(body.plan?.planId).toBe(draft.draftArtifacts.productionPlan?.planId);
      expect(body.purchaseList?.purchaseListId).toBe(draft.draftArtifacts.purchaseList?.purchaseListId);
      expect(body.recipes.map((recipe) => recipe.recipeId)).toEqual(["recipe-draft-vitello"]);
      expect(await store.getPlan({ businessId: "local" }, draft.draftArtifacts.productionPlan?.planId ?? "")).toEqual(
        draft.draftArtifacts.productionPlan
      );
      expect(await store.getPurchaseList(
        { businessId: "local" },
        draft.draftArtifacts.purchaseList?.purchaseListId ?? ""
      )).toEqual(
        draft.draftArtifacts.purchaseList
      );
      expect((await repository.get({ businessId: "local" }, "recipe-draft-vitello"))?.source.approvalState)
        .toBe("approved_internal");
      expect(auditJson).toContain("production.approved_spec_applied");
      expect(auditJson).toContain('"writesProductObject":true');
      expect(auditJson).toContain('"recipeCandidateCount":1');
      expect(auditJson).not.toContain("SECRET_REVIEW_TITLE");
      expect(auditJson).not.toContain("SECRET_REVIEW_SUMMARY");
      expect(auditJson).not.toContain("SECRET_RECIPE_NAME");
      expect(auditJson).not.toContain("SECRET_OPERATOR_COMMENT");
      expect(auditJson).not.toContain("SECRET_DRAFT_NOTE");
    } finally {
      await app.close();
    }
  });

  it("keeps the retired draft Apply route unavailable", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft("production-draft-apply-pending");

    try {
      const imported = await app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: draft
      });
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(imported.statusCode).toBe(201);
      expect(response.statusCode).toBe(404);
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("blocks takeover when an existing target artifact differs", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft("production-draft-apply-conflict");
    await store.savePlan({ businessId: "local" }, {
      ...draft.draftArtifacts.productionPlan!,
      warnings: ["abweichender bestehender Plan"]
    });

    try {
      const response = await importApproveAndApply(app, draft);

      expect(response.statusCode).toBe(409);
      expect(response.body).toContain("würde bestehende Produktobjekte überschreiben");
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("blocks recipe candidate overwrite when the existing recipe differs", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      repository,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft("production-draft-apply-recipe-conflict");
    await repository.save({ businessId: "local" }, {
      ...recipeCandidate(),
      name: "Bestehendes abweichendes Rezept"
    });

    try {
      const response = await importApproveAndApply(app, draft);

      expect(response.statusCode).toBe(409);
      expect(response.body).toContain("Recipe recipe-draft-vitello existiert bereits");
    } finally {
      await app.close();
    }
  });
});
