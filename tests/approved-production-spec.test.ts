import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProductionApp,
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  ProductionStore,
  RecipeDiscoveryService,
  type ProductionApplyFaultPhase,
  type ProductionDecisionFaultPhase
} from "@catering/production-service";
import { IntakeStore } from "@catering/intake-service";
import {
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type ProductionDraft,
  type Recipe
} from "@catering/shared-core";

const TRUSTED_SECRET = "approved-production-spec-secret";
const context = { businessId: "local" } as const;
const headers = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function approvedRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-approved-production-spec",
    name: "Synthetisches Testrezept",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "fixture:approved-production-spec",
      retrievedAt: "2026-08-10T12:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: { servings: 20, unit: "Portionen" },
    ingredients: [{
      ingredientId: "ingredient-approved-production-spec",
      name: "Testzutat",
      quantity: { amount: 1, unit: "kg" },
      group: "trockenware"
    }],
    steps: [{ index: 1, instruction: "Testrezept kontrolliert bereitstellen." }],
    scalingRules: { defaultLossFactor: 1 },
    allergens: [],
    dietTags: []
  };
}

async function completeDraft(
  draftId: string,
  status: ProductionDraft["status"] = "pending_review",
  reviewDecision: ProductionDraft["reviewCards"][number]["decision"] = "fits"
): Promise<ProductionDraft> {
  const eventSpec = normalizeEventRequestToSpec(createEventRequestFromText({
    requestId: `request-${draftId}`,
    channel: "text",
    rawText: "Synthetisches Buffet fuer 20 Personen am 18.09.2026."
  }));
  const repository = new InMemoryRecipeRepository([]);
  const artifacts = await buildProductionArtifacts(
    eventSpec,
    new RecipeDiscoveryService(repository, { searchRecipes: async () => [] })
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    businessId: "local",
    draftId,
    revision: 1,
    status,
    createdAt: "2026-08-10T12:00:00.000Z",
    source: {
      kind: "manual_import",
      receivedAt: "2026-08-10T12:00:00.000Z",
      sourceRef: "fixture:approved-production-spec"
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
        title: "Eventdaten",
        summary: "Vollstaendigen Snapshot pruefen.",
        decision: reviewDecision,
        targetPath: "$.draftArtifacts.eventSpec",
        targetId: eventSpec.specId,
        requiredApproval: true,
        riskLevel: "blocking",
        ...(reviewDecision === "fits"
          ? { decidedBy: "Produktions-Mitarbeiter", decidedAt: "2026-08-10T12:05:00.000Z" }
          : {})
      },
      {
        cardId: "card-plan",
        kind: "timeline",
        title: "Produktionsplan",
        summary: "Plan pruefen.",
        decision: reviewDecision,
        targetPath: "$.draftArtifacts.productionPlan",
        targetId: artifacts.productionPlan.planId,
        requiredApproval: true,
        ...(reviewDecision === "fits"
          ? { decidedBy: "Produktions-Mitarbeiter", decidedAt: "2026-08-10T12:05:00.000Z" }
          : {})
      },
      {
        cardId: "card-purchase-list",
        kind: "purchase_item",
        title: "Einkaufsliste",
        summary: "Einkauf pruefen.",
        decision: reviewDecision,
        targetPath: "$.draftArtifacts.purchaseList",
        targetId: artifacts.purchaseList.purchaseListId,
        requiredApproval: true,
        ...(reviewDecision === "fits"
          ? { decidedBy: "Produktions-Mitarbeiter", decidedAt: "2026-08-10T12:05:00.000Z" }
          : {})
      },
      {
        cardId: "card-recipe",
        kind: "recipe",
        title: "Rezept",
        summary: "Rezept pruefen.",
        decision: reviewDecision,
        targetPath: "$.draftArtifacts.recipes[0]",
        targetId: approvedRecipe().recipeId,
        requiredApproval: true,
        ...(reviewDecision === "fits"
          ? { decidedBy: "Produktions-Mitarbeiter", decidedAt: "2026-08-10T12:05:00.000Z" }
          : {})
      }
    ],
    draftArtifacts: {
      eventSpec,
      productionPlan: artifacts.productionPlan,
      purchaseList: artifacts.purchaseList,
      recipes: [approvedRecipe()]
    }
  };
}

function buildHarness(options: {
  applyFaultInjector?: (phase: ProductionApplyFaultPhase) => void;
  decisionFaultInjector?: (phase: ProductionDecisionFaultPhase) => void;
} = {}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "approved-production-spec-"));
  roots.push(rootDir);
  const store = new ProductionStore({ rootDir });
  const repository = new InMemoryRecipeRepository([], { rootDir });
  const intakeStore = new IntakeStore({ rootDir });
  const app = buildProductionApp({
    dataRoot: rootDir,
    store,
    repository,
    intakeStore,
    trustedActorSecret: TRUSTED_SECRET,
    productionApplyFaultInjector: options.applyFaultInjector,
    productionDecisionFaultInjector: options.decisionFaultInjector,
    env: {}
  });
  return { app, intakeStore, repository, store };
}

async function importDraft(app: ReturnType<typeof buildProductionApp>, draft: ProductionDraft) {
  return app.inject({ method: "POST", url: "/v1/production/drafts", headers, payload: draft });
}

async function decide(
  app: ReturnType<typeof buildProductionApp>,
  draftId: string,
  decision: "approved" | "rejected"
) {
  return app.inject({
    method: "POST",
    url: `/v1/production/drafts/${draftId}/decision`,
    headers,
    payload: { decision }
  });
}

describe("ApprovedProductionSpec decision boundary", () => {
  it.each(["rejected", "superseded"] as const)(
    "does not create ApprovedProductionSpec from %s",
    async (status) => {
      const { app, store } = buildHarness();
      const draft = await completeDraft(`draft-${status}`, status);
      try {
        await store.saveProductionDraft(context, draft);
        expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(409);
        expect(await store.listApprovedProductionSpecs(context)).toHaveLength(0);
      } finally {
        await app.close();
      }
    }
  );

  it("returns 422 when a pending draft still has open required cards", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-open-card", "pending_review", "pending");
    try {
      const imported = await importDraft(app, draft);
      expect(imported.statusCode, imported.body).toBe(201);
      expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(422);
      expect(await store.listApprovedProductionSpecs(context)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("creates one immutable snapshot and resumes an identical approved decision", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-approved");
    try {
      const imported = await importDraft(app, draft);
      expect(imported.statusCode, imported.body).toBe(201);
      const first = await decide(app, draft.draftId, "approved");
      const retry = await decide(app, draft.draftId, "approved");
      expect(first.statusCode).toBe(201);
      expect(retry.statusCode).toBe(201);
      expect(first.json().approvedProductionSpec.approvedProductionSpecId).toBe(
        retry.json().approvedProductionSpec.approvedProductionSpecId
      );
      expect(await store.listApprovedProductionSpecs(context)).toHaveLength(1);
      expect((await decide(app, draft.draftId, "rejected")).statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it("resumes after approval evidence was inserted but snapshot publication was interrupted", async () => {
    let failOnce = true;
    const { app, store } = buildHarness({
      decisionFaultInjector(phase) {
        if (failOnce && phase === "after_approval_insert") {
          failOnce = false;
          throw new Error("injected approval publication failure");
        }
      }
    });
    const draft = await completeDraft("draft-approval-retry");
    try {
      expect((await importDraft(app, draft)).statusCode).toBe(201);
      expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(500);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toHaveLength(1);
      expect(await store.listApprovedProductionSpecs(context)).toHaveLength(0);

      expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(201);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toHaveLength(1);
      expect(await store.listApprovedProductionSpecs(context)).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it.each([
    "after_event_spec_write",
    "after_plan_write",
    "after_purchase_list_write",
    "after_recipe_write",
    "before_manifest_publish"
  ] as const)("resumes Apply after an injected %s interruption without duplicates", async (faultPhase) => {
    let failOnce = true;
    const { app, intakeStore, repository, store } = buildHarness({
      applyFaultInjector(phase) {
        if (failOnce && phase === faultPhase) {
          failOnce = false;
          throw new Error(`injected ${phase} failure`);
        }
      }
    });
    const draft = await completeDraft(`draft-apply-retry-${faultPhase}`);
    try {
      expect((await importDraft(app, draft)).statusCode).toBe(201);
      const decision = await decide(app, draft.draftId, "approved");
      expect(decision.statusCode, decision.body).toBe(201);
      const approvedProductionSpecId = decision.json().approvedProductionSpec.approvedProductionSpecId;
      const applyUrl = `/v1/production/approved-specs/${approvedProductionSpecId}/apply`;

      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(500);
      expect(await store.getApplyManifest(context, approvedProductionSpecId)).toBeUndefined();
      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(200);
      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(200);

      expect(await intakeStore.listSpecs()).toHaveLength(1);
      expect(await store.listPlans(context)).toHaveLength(1);
      expect(await store.listPurchaseLists(context)).toHaveLength(1);
      expect(await repository.list(context)).toHaveLength(1);
      expect(await store.getApplyManifest(context, approvedProductionSpecId)).toMatchObject({
        approvedProductionSpecId,
        businessId: context.businessId
      });
    } finally {
      await app.close();
    }
  });

  it("applies only the immutable approved snapshot and removes draft apply", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-immutable");
    try {
      const imported = await importDraft(app, draft);
      expect(imported.statusCode, imported.body).toBe(201);
      const approvedResponse = await decide(app, draft.draftId, "approved");
      expect(approvedResponse.statusCode).toBe(201);
      const approved = approvedResponse.json().approvedProductionSpec;

      await store.saveProductionDraft(context, {
        ...draft,
        draftArtifacts: {
          ...draft.draftArtifacts,
          productionPlan: {
            ...draft.draftArtifacts.productionPlan!,
            eventSpecId: "mutated-after-approval"
          }
        }
      });

      const applied = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approved.approvedProductionSpecId}/apply`,
        headers,
        payload: {}
      });
      expect(applied.statusCode).toBe(200);
      expect(applied.json().plan.eventSpecId).toBe(approved.artifacts.eventSpec.specId);
      expect((await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/apply`,
        headers
      })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
