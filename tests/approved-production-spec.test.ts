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
import { productionDecisionRepositoryFor } from "../production-service/src/repositories/production-store.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import {
  createApprovedProductionSpec,
  createApprovalRequestRecord,
  createEventRequestFromText,
  AuditLogStore,
  llmReadinessContractVersion,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
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
  const repository = new InMemoryRecipeRepository();
  const artifacts = await buildProductionArtifacts(
    eventSpec,
    new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }),
    { context }
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
  llmAdapter?: LlmReadinessProviderAdapter;
} = {}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "approved-production-spec-"));
  roots.push(rootDir);
  const store = new ProductionStore({ rootDir });
  const repository = new InMemoryRecipeRepository({ rootDir });
  const intakeStore = new InMemoryIntakeRecordsPort();
  const auditLog = new AuditLogStore({ rootDir });
  const app = buildProductionApp({
    dataRoot: rootDir,
    store,
    repository,
    intakeRecords: intakeStore,
    auditLog,
    llmAdapter: options.llmAdapter,
    trustedActorSecret: TRUSTED_SECRET,
    productionApplyFaultInjector: options.applyFaultInjector,
    productionDecisionFaultInjector: options.decisionFaultInjector,
    env: {}
  });
  return { app, auditLog, intakeStore, repository, store };
}

function revisionAdapter(): LlmReadinessProviderAdapter {
  return {
    adapterId: "task-4-revision-adapter",
    adapterMode: "synthetic_live",
    run: async (request: LlmReadinessProviderAdapterRequest) => ({
      ok: true,
      errors: [],
      adapterId: "task-4-revision-adapter",
      adapterMode: "synthetic_live",
      providerId: "task-4-test-provider",
      providerRequestId: "task-4-revision-request",
      promptSchemaId: request.promptSchemaId,
      outputCandidate: {
        contractVersion: llmReadinessContractVersion,
        outputId: "task-4-revision-output",
        kind: "production_draft_extraction",
        sourceRefs: request.input.sourceRefs,
        humanApprovalRequired: true,
        writesProductObject: false,
        text: JSON.stringify({
          eventType: "meeting",
          serviceForm: "buffet",
          eventDate: "2026-09-18",
          attendeeCount: 20,
          customerName: null,
          venueName: null,
          components: [{
            label: "Synthetisches Buffet fuer 20 Personen am 18.09.2026.",
            course: "main",
            category: "classic",
            categoryEvidence: null,
            note: "Operator-Änderung eingearbeitet."
          }],
          openQuestions: []
        })
      }
    })
  };
}

function reviseReadyDraft(draft: ProductionDraft): ProductionDraft {
  return {
    ...draft,
    reviewCards: draft.reviewCards.map((card, index) => index === 0
      ? {
        ...card,
        kind: "event_data",
        decision: "change_requested",
        operatorComment: "Veranstaltungsdaten fachlich überarbeiten.",
        decidedBy: "Produktions-Mitarbeiter",
        decidedAt: "2026-08-10T12:06:00.000Z"
      }
      : card)
  };
}

function reviseReadyAndApprovalEligibleDraft(draft: ProductionDraft): ProductionDraft {
  const revised = reviseReadyDraft(draft);
  return {
    ...revised,
    reviewCards: revised.reviewCards.map((card, index) => {
      if (index !== 0) return card;
      const { riskLevel: _riskLevel, ...approvalEligible } = card;
      return { ...approvalEligible, requiredApproval: false };
    })
  };
}

async function importDraft(store: ProductionStore, draft: ProductionDraft) {
  await store.saveProductionDraft(context, draft);
  return { statusCode: 201, body: "" };
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
  it("rejects direct snapshot publication without persisted approved evidence", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-forged-snapshot");
    const actor = {
      businessId: "local",
      name: "Produktions-Mitarbeiter",
      source: "trusted-proxy:x-catering-actor-name" as const,
      trusted: true as const
    };
    const approval = createApprovalRequestRecord({
      actor,
      role: "production_operator",
      target: {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      },
      decision: "approved"
    });
    const forged = createApprovedProductionSpec({ draft, approval });

    try {
      await expect(store.insertApprovedProductionSpec(context, forged)).rejects.toThrow(
        "persistierte, freigegebene ApprovalRequestRecord"
      );
      expect(await store.listApprovedProductionSpecs(context)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      label: "deterministische Snapshot-ID",
      alter: (spec: ReturnType<typeof createApprovedProductionSpec>) => ({
        ...spec,
        approvedProductionSpecId: `approved-production-spec-${"0".repeat(64)}`
      })
    },
    {
      label: "Freigabezeitpunkt",
      alter: (spec: ReturnType<typeof createApprovedProductionSpec>) => ({
        ...spec,
        approvedAt: "2020-01-01T00:00:00.000Z"
      })
    }
  ])("rejects a snapshot with forged $label", async ({ alter }) => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-forged-approval-metadata");
    const actor = {
      businessId: "local",
      name: "Produktions-Mitarbeiter",
      source: "trusted-proxy:x-catering-actor-name" as const,
      trusted: true as const
    };
    const approval = createApprovalRequestRecord({
      actor,
      role: "production_operator",
      target: { kind: "production_draft", artifactId: draft.draftId, revision: draft.revision },
      decision: "approved"
    });
    const forged = alter(createApprovedProductionSpec({ draft, approval }));
    await store.insertApproval(context, approval);

    try {
      await expect(store.insertApprovedProductionSpec(context, forged)).rejects.toThrow(
        "stimmt nicht exakt mit der persistierten Freigabe überein"
      );
      expect(await store.listApprovedProductionSpecs(context)).toEqual([]);
    } finally {
      await app.close();
    }
  });

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
      const imported = await importDraft(store, draft);
      expect(imported.statusCode, imported.body).toBe(201);
      expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(422);
      expect(await store.listApprovedProductionSpecs(context)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("creates one immutable snapshot and resumes an identical approved decision", async () => {
    const { app, auditLog, store } = buildHarness();
    const draft = await completeDraft("draft-approved");
    try {
      const imported = await importDraft(store, draft);
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
      expect((await auditLog.listRecentFor(context, 20)).filter(
        (entry) => entry.action === "production.production_spec_approved"
      )).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("does not replace a decided draft with a later revision under the same draft ID", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-fixed-revision");
    const sameIdRevisionTwo = { ...draft, revision: 2 };
    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(201);

      await expect(store.saveProductionDraft(context, sameIdRevisionTwo)).rejects.toThrow(
        "ProductionDraft-ID und Revision"
      );
      await expect(store.getProductionDraft(context, draft.draftId)).resolves.toMatchObject({
        revision: 1,
        status: "approved"
      });
    } finally {
      await app.close();
    }
  });

  it("serializes a same-ID revision replacement behind the persisted decided revision", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-fixed-revision-race");
    const sameIdRevisionTwo = { ...draft, revision: 2 };
    expect((await importDraft(store, draft)).statusCode).toBe(201);

    const repository = productionDecisionRepositoryFor(store);
    const originalCriticalSection = repository.withTargetCriticalSection.bind(repository);
    let entered!: () => void;
    let release!: () => void;
    const aggregateEntered = new Promise<void>((resolve) => { entered = resolve; });
    const continueDecision = new Promise<void>((resolve) => { release = resolve; });
    repository.withTargetCriticalSection = (businessContext, target, operation) =>
      originalCriticalSection(businessContext, target, (scope) => operation({
        ...scope,
        insertDecisionAggregate: async (aggregate) => {
          entered();
          await continueDecision;
          return scope.insertDecisionAggregate(aggregate);
        }
      }));

    try {
      const decision = decide(app, draft.draftId, "approved");
      await aggregateEntered;
      const replacement = store.saveProductionDraft(context, sameIdRevisionTwo);
      release();

      expect((await decision).statusCode).toBe(201);
      await expect(replacement).rejects.toThrow("ProductionDraft-ID und Revision");
      await expect(store.getProductionDraft(context, draft.draftId)).resolves.toMatchObject({
        revision: 1,
        status: "approved"
      });
    } finally {
      release();
      await app.close();
    }
  });

  it("allows only one of two concurrent first saves with the same draft ID and different revisions", async () => {
    const { app, store } = buildHarness();
    const revisionOne = await completeDraft("draft-concurrent-first-save");
    const revisionTwo = { ...revisionOne, revision: 2 };
    try {
      const results = await Promise.allSettled([
        store.saveProductionDraft(context, revisionOne),
        store.saveProductionDraft(context, revisionTwo)
      ]);

      expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
      const winningRevision = results[0]?.status === "fulfilled" ? 1 : 2;
      await expect(store.getProductionDraft(context, revisionOne.draftId)).resolves.toMatchObject({
        revision: winningRevision
      });
    } finally {
      await app.close();
    }
  });

  it("resumes after approval evidence was inserted but snapshot publication was interrupted", async () => {
    let failOnce = true;
    const { app, store } = buildHarness({
      llmAdapter: revisionAdapter(),
      decisionFaultInjector(phase) {
        if (failOnce && phase === "after_approval_insert") {
          failOnce = false;
          throw new Error("injected approval publication failure");
        }
      }
    });
    const draft = reviseReadyAndApprovalEligibleDraft(await completeDraft("draft-approval-retry"));
    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(500);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toHaveLength(1);
      expect(await store.listApprovedProductionSpecs(context)).toHaveLength(0);

      const blockedMutations = await Promise.all([
        app.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${draft.draftId}/review-cards/${draft.reviewCards[0]!.cardId}`,
          headers,
          payload: { decision: "blocked", operatorComment: "Darf den Snapshot nicht verändern" }
        }),
        app.inject({ method: "POST", url: `/v1/production/drafts/${draft.draftId}/prepare`, headers }),
        app.inject({ method: "POST", url: `/v1/production/drafts/${draft.draftId}/revise`, headers })
      ]);
      expect(blockedMutations.map((response) => response.statusCode)).toEqual([409, 409, 409]);

      const originalGetProductionDraft = store.getProductionDraft.bind(store);
      store.getProductionDraft = async () => {
        throw new Error("Retry darf den veränderlichen Draft nicht erneut lesen.");
      };

      expect((await decide(app, draft.draftId, "approved")).statusCode).toBe(201);
      store.getProductionDraft = originalGetProductionDraft;
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
    {
      name: "Review",
      decision: "approved" as const,
      transform: undefined,
      request: (app: ReturnType<typeof buildProductionApp>, draft: ProductionDraft) => app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${draft.reviewCards[0]!.cardId}`,
        headers,
        payload: { decision: "blocked", operatorComment: "Paralleländerung" }
      })
    },
    {
      name: "Prepare",
      decision: "approved" as const,
      transform: undefined,
      request: (app: ReturnType<typeof buildProductionApp>, draft: ProductionDraft) => app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers
      })
    },
    {
      name: "Revise",
      decision: "rejected" as const,
      transform: reviseReadyDraft,
      request: (app: ReturnType<typeof buildProductionApp>, draft: ProductionDraft) => app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers
      })
    }
  ])("serializes Decision against concurrent $name", async ({ decision: requestedDecision, request, transform }) => {
    const { app, store } = buildHarness({ llmAdapter: revisionAdapter() });
    const source = await completeDraft("draft-decision-mutation-race");
    const draft = transform ? transform(source) : source;
    expect((await importDraft(store, draft)).statusCode).toBe(201);

    const repository = productionDecisionRepositoryFor(store);
    const originalCriticalSection = repository.withTargetCriticalSection.bind(repository);
    let entered!: () => void;
    let release!: () => void;
    const aggregateEntered = new Promise<void>((resolve) => { entered = resolve; });
    const continueDecision = new Promise<void>((resolve) => { release = resolve; });
    repository.withTargetCriticalSection = (context, target, operation) =>
      originalCriticalSection(context, target, (scope) => operation({
        ...scope,
        insertDecisionAggregate: async (aggregate) => {
          entered();
          await continueDecision;
          return scope.insertDecisionAggregate(aggregate);
        }
      }));

    try {
      const decision = decide(app, draft.draftId, requestedDecision);
      await aggregateEntered;
      const mutation = request(app, draft);
      release();

      expect((await decision).statusCode).toBe(201);
      expect((await mutation).statusCode).toBe(409);
      expect(await store.getProductionDraft(context, draft.draftId)).toMatchObject({
        status: requestedDecision === "approved" ? "approved" : "rejected",
        approvalRequestId: expect.stringMatching(/^approval-/)
      });
    } finally {
      release();
      await app.close();
    }
  });

  it.each([
    {
      name: "Review",
      expectedDecisionStatus: 422,
      transform: undefined,
      request: (app: ReturnType<typeof buildProductionApp>, draft: ProductionDraft) => app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${draft.reviewCards[0]!.cardId}`,
        headers,
        payload: { decision: "blocked", operatorComment: "Mutation gewinnt zuerst" }
      })
    },
    {
      name: "Prepare",
      expectedDecisionStatus: 409,
      transform: undefined,
      request: (app: ReturnType<typeof buildProductionApp>, draft: ProductionDraft) => app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers
      })
    },
    {
      name: "Revise",
      expectedDecisionStatus: 409,
      transform: reviseReadyDraft,
      request: (app: ReturnType<typeof buildProductionApp>, draft: ProductionDraft) => app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers
      })
    }
  ])("makes Decision observe concurrent $name that committed first", async ({
    expectedDecisionStatus,
    request,
    transform
  }) => {
    const { app, store } = buildHarness({ llmAdapter: revisionAdapter() });
    const source = await completeDraft("draft-mutation-decision-race");
    const draft = transform ? transform(source) : source;
    expect((await importDraft(store, draft)).statusCode).toBe(201);

    const repository = productionDecisionRepositoryFor(store);
    const originalCriticalSection = repository.withTargetCriticalSection.bind(repository);
    let entered!: () => void;
    let release!: () => void;
    let pauseOnce = true;
    const mutationEntered = new Promise<void>((resolve) => { entered = resolve; });
    const continueMutation = new Promise<void>((resolve) => { release = resolve; });
    repository.withTargetCriticalSection = (businessContext, target, operation) =>
      originalCriticalSection(businessContext, target, (scope) => operation({
        ...scope,
        setDraft: async (value) => {
          if (pauseOnce) {
            pauseOnce = false;
            entered();
            await continueMutation;
          }
          return scope.setDraft(value);
        }
      }));

    try {
      const mutation = request(app, draft);
      await mutationEntered;
      const decision = decide(app, draft.draftId, "approved");
      release();

      expect((await mutation).statusCode).toBeGreaterThanOrEqual(200);
      expect((await mutation).statusCode).toBeLessThan(300);
      expect((await decision).statusCode).toBe(expectedDecisionStatus);
      expect(await store.listApprovedProductionSpecs(context)).toEqual([]);
    } finally {
      release();
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
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      const decision = await decide(app, draft.draftId, "approved");
      expect(decision.statusCode, decision.body).toBe(201);
      const approvedProductionSpecId = decision.json().approvedProductionSpec.approvedProductionSpecId;
      const applyUrl = `/v1/production/approved-specs/${approvedProductionSpecId}/apply`;

      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(500);
      expect(await store.getApplyManifest(context, approvedProductionSpecId)).toBeUndefined();
      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(200);
      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(200);

      expect(await intakeStore.listSpecs(context)).toHaveLength(1);
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

  it("keeps the manifest actor authoritative when Apply audit retries under another actor", async () => {
    const { app, auditLog, store } = buildHarness();
    const firstActorHeaders = {
      "x-catering-actor-name": "PRODUKTIONS-MITARBEITER",
      "x-catering-trusted-secret": TRUSTED_SECRET
    };
    const retryActorHeaders = headers;
    const draft = await completeDraft("draft-apply-audit-first-actor");

    try {
      await store.saveProductionDraft(context, draft);
      const decision = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/decision`,
        headers: firstActorHeaders,
        payload: { decision: "approved" }
      });
      expect(decision.statusCode, decision.body).toBe(201);
      const approvedProductionSpecId = decision.json().approvedProductionSpec.approvedProductionSpecId;
      const applyUrl = `/v1/production/approved-specs/${approvedProductionSpecId}/apply`;

      const logFor = auditLog.logFor.bind(auditLog);
      let failApplyAudit = true;
      auditLog.logFor = async (...args) => {
        if (failApplyAudit && args[1].action === "production.approved_spec_applied") {
          failApplyAudit = false;
          throw new Error("injected after apply manifest publication");
        }
        return logFor(...args);
      };

      expect((await app.inject({ method: "POST", url: applyUrl, headers: firstActorHeaders })).statusCode).toBe(500);
      const manifest = await store.getApplyManifest(context, approvedProductionSpecId);
      expect(manifest).toBeDefined();

      expect((await app.inject({ method: "POST", url: applyUrl, headers: retryActorHeaders })).statusCode).toBe(200);
      const applyAudits = (await auditLog.listRecentFor(context, 100))
        .filter((entry) => entry.action === "production.approved_spec_applied");

      expect(manifest?.appliedBy).toEqual({
        name: "PRODUKTIONS-MITARBEITER",
        source: "trusted-proxy:x-catering-actor-name"
      });
      expect(applyAudits).toHaveLength(1);
      expect(applyAudits[0].actor).toEqual(manifest?.appliedBy);
      expect(applyAudits[0].at).toBe(manifest?.appliedAt);
    } finally {
      await app.close();
    }
  });

  it("applies only the immutable approved snapshot and removes draft apply", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-immutable");
    try {
      const imported = await importDraft(store, draft);
      expect(imported.statusCode, imported.body).toBe(201);
      const approvedResponse = await decide(app, draft.draftId, "approved");
      expect(approvedResponse.statusCode).toBe(201);
      const approved = approvedResponse.json().approvedProductionSpec;

      await expect(store.saveProductionDraft(context, {
        ...draft,
        draftArtifacts: {
          ...draft.draftArtifacts,
          productionPlan: {
            ...draft.draftArtifacts.productionPlan!,
            eventSpecId: "mutated-after-approval"
          }
        }
      })).rejects.toThrow("unveränderlich");

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
