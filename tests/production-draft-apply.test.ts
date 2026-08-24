import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
  approvalRequestIdForTarget,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type ProductionDraft,
  type ProductionHandoff,
  type Recipe
} from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import type { IntakeRecordsPort } from "../production-service/src/ports/intake-records-port.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";

const TRUSTED_SECRET = "production-draft-apply-secret";
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};
const OFFER_TRUSTED_SECRET = "production-draft-apply-offer-secret";
const trustedOfferHeaders = {
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-trusted-secret": OFFER_TRUSTED_SECRET,
  "x-catering-business-id": "local"
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

async function buildDraft(
  draftId = "production-draft-apply-1",
  specOverride?: AcceptedEventSpec
): Promise<ProductionDraft> {
  const spec = specOverride ?? eventSpec();
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

async function approveDraft(
  app: ReturnType<typeof buildProductionApp>,
  store: ProductionStore,
  draft: ProductionDraft,
  intakeRecords: IntakeRecordsPort,
  intakeSpec = draft.draftArtifacts.eventSpec!
) {
  await store.saveProductionDraft({ businessId: "local" }, draft);
  await intakeRecords.insertSpec({ businessId: "local" }, intakeSpec);

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

  return approvedProductionSpecId;
}

async function importApproveAndApply(
  app: ReturnType<typeof buildProductionApp>,
  store: ProductionStore,
  draft: ProductionDraft,
  intakeRecords: IntakeRecordsPort,
  intakeSpec = draft.draftArtifacts.eventSpec!
) {
  const approvedProductionSpecId = await approveDraft(app, store, draft, intakeRecords, intakeSpec);
  return app.inject({
    method: "POST",
    url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
    headers: trustedProductionHeaders
  });
}

class DriftOnApplyIntakeRecordsPort implements IntakeRecordsPort {
  private current?: AcceptedEventSpec;
  private drifted = false;

  async getRequest() { return undefined; }

  async getSpec(_context: { businessId: string }, specId: string) {
    return this.current?.specId === specId ? structuredClone(this.current) : undefined;
  }

  async insertSpec(_context: { businessId: string }, spec: AcceptedEventSpec): Promise<"created" | "same_content"> {
    this.current = structuredClone(spec);
    return "created";
  }

  async replaceSpec(
    _context: { businessId: string },
    expected: AcceptedEventSpec,
    replacement: AcceptedEventSpec
  ): Promise<"updated" | "same_content"> {
    if (!this.current || JSON.stringify(this.current) !== JSON.stringify(expected)) {
      throw new Error("AcceptedEventSpec wurde zwischenzeitlich geändert.");
    }
    this.current = structuredClone(replacement);
    return "same_content";
  }

  drift(): void {
    if (this.drifted || !this.current) return;
    this.drifted = true;
    this.current = structuredClone({
      ...this.current,
      attendees: { ...this.current.attendees, expected: (this.current.attendees.expected ?? 0) + 1 }
    });
  }
}

class RaceRecipeRepository extends InMemoryRecipeRepository {
  private pendingConflict?: Recipe;

  armRecipeConflict(recipe: Recipe): void {
    this.pendingConflict = structuredClone(recipe);
  }

  override async get(context: { businessId: string }, recipeId: string): Promise<Recipe | undefined> {
    if (this.pendingConflict?.recipeId === recipeId) {
      const conflict = this.pendingConflict;
      this.pendingConflict = undefined;
      await super.save(context, conflict);
    }
    return super.get(context, recipeId);
  }
}

function offerHandoffFor(spec: AcceptedEventSpec, sourceDraftId: string): ProductionHandoff {
  const pricingSummary = spec.budgetContext?.pricingSummary ?? {
    subtotal: { amount: 100, currency: "EUR" },
    perPerson: { amount: 2.22, currency: "EUR" }
  };
  const approvalRequestId = approvalRequestIdForTarget({
    businessId: "local",
    target: { kind: "production_draft", artifactId: sourceDraftId, revision: 1 }
  });
  const approvedOfferId = `approved-offer-${createHash("sha256").update(JSON.stringify({
    businessId: "local",
    approvalRequestId
  })).digest("hex")}`;
  const handoffId = `handoff-${createHash("sha256").update(JSON.stringify({
    businessId: "local",
    approvedOfferId
  })).digest("hex")}`;
  const eventSpecSnapshot = structuredClone({
    ...spec,
    lifecycle: { commercialState: "accepted" as const },
    budgetContext: { ...(spec.budgetContext ?? {}), pricingSummary }
  });
  return {
    schemaVersion: "1.0",
    businessId: "local",
    handoffId,
    approvedOfferId,
    approvalRequestId,
    createdAt: "2026-07-01T12:00:00.000Z",
    eventSpecSnapshot,
    pricingSnapshot: structuredClone(pricingSummary),
    source: { draftId: sourceDraftId, revision: 1, selectedVariantId: "variant-apply-p1" }
  };
}

async function createPersistedOfferHandoff(rootDir: string): Promise<{
  store: OfferStore;
  app: ReturnType<typeof buildOfferApp>;
  handoff: ProductionHandoff;
}> {
  const store = new OfferStore({ rootDir });
  const app = buildOfferApp({ rootDir, store, trustedActorSecret: OFFER_TRUSTED_SECRET });
  const caseResponse = await app.inject({
    method: "POST",
    url: "/v1/offers/cases",
    headers: trustedOfferHeaders,
    payload: { eventTypeLabel: "Business Lunch", attendeeCount: 45 }
  });
  expect(caseResponse.statusCode).toBe(201);
  const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
  const draftResponse = await app.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers: trustedOfferHeaders,
    payload: { caseId, text: "Business Lunch fuer 45 Personen." }
  });
  expect(draftResponse.statusCode).toBe(201);
  const offerDraft = draftResponse.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
  const approvalResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/drafts/${offerDraft.draftId}/decision`,
    headers: trustedOfferHeaders,
    payload: { decision: "approved", revision: 1, variantId: offerDraft.variantSet[0]?.variantId }
  });
  expect(approvalResponse.statusCode).toBe(201);
  const approvedOfferId = approvalResponse.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
  const handoffResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
    headers: trustedOfferHeaders,
    payload: {}
  });
  expect(handoffResponse.statusCode).toBe(201);
  return {
    store,
    app,
    handoff: handoffResponse.json<{ handoff: ProductionHandoff }>().handoff
  };
}

async function linkProductionCaseToDraft(
  app: ReturnType<typeof buildProductionApp>,
  store: ProductionStore,
  draft: ProductionDraft,
  handoffId: string
): Promise<void> {
  const caseResponse = await app.inject({
    method: "POST",
    url: `/v1/production/cases/from-handoff/${handoffId}`,
    headers: trustedProductionHeaders,
    payload: {}
  });
  expect(caseResponse.statusCode).toBe(201);
  const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
  await store.appendEvent({ businessId: "local" }, caseId, {
    at: draft.createdAt,
    role: "system",
    kind: "draft_created",
    text: "Synthetische Produktionsakte angelegt.",
    artifactId: draft.draftId
  });
}

async function buildCanonicalApplyFixture(rootDir: string, draftId: string): Promise<{
  draft: ProductionDraft;
  persistedOffer: Awaited<ReturnType<typeof createPersistedOfferHandoff>>;
}> {
  const persistedOffer = await createPersistedOfferHandoff(rootDir);
  const baseDraft = await buildDraft(draftId, persistedOffer.handoff.eventSpecSnapshot);
  return {
    persistedOffer,
    draft: {
      ...baseDraft,
      source: {
        ...baseDraft.source,
        kind: "manual_import",
        sourceRef: `offer-handoff:${persistedOffer.handoff.handoffId}`
      }
    }
  };
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
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const persistedOffer = await createPersistedOfferHandoff(dataRoot);
    const baseDraft = await buildDraft("production-draft-apply-1", persistedOffer.handoff.eventSpecSnapshot);
    const draft: ProductionDraft = {
      ...baseDraft,
      source: { ...baseDraft.source, kind: "manual_import", sourceRef: `offer-handoff:${persistedOffer.handoff.handoffId}` },
      draftArtifacts: baseDraft.draftArtifacts
    };
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      auditLog,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    await linkProductionCaseToDraft(app, store, draft, persistedOffer.handoff.handoffId);

    try {
      const response = await importApproveAndApply(app, store, draft, intakeRecords, persistedOffer.handoff.eventSpecSnapshot);
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
      await persistedOffer.app.close();
    }
  });

  it("rejects Apply when no persisted Offer approval and Handoff evidence is linked", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      intakeRecords,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft("production-draft-apply-no-handoff-evidence");

    try {
      const response = await importApproveAndApply(app, store, draft, intakeRecords);

      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain(
        "Freigegebener Produktionssnapshot besitzt keine gültige Offer-/Handoff-Evidenz."
      );
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await repository.get({ businessId: "local" }, "recipe-draft-vitello")).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("rejects an approved spec after a real ProductionDraft continuation reopens its case", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const { draft, persistedOffer } = await buildCanonicalApplyFixture(
      dataRoot,
      "production-draft-apply-reopened-case"
    );
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      intakeRecords,
      handoffReader: { get: (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await linkProductionCaseToDraft(app, store, draft, persistedOffer.handoff.handoffId);
      const approvedProductionSpecId = await approveDraft(
        app,
        store,
        draft,
        intakeRecords,
        persistedOffer.handoff.eventSpecSnapshot
      );
      const caseId = await store.findCaseIdForArtifact({ businessId: "local" }, draft.draftId);
      expect(caseId).toBeDefined();

      const continuation = {
        ...draft,
        draftId: `${draft.draftId}-continuation`,
        revision: draft.revision + 1,
        status: "pending_review" as const,
        createdAt: "2026-07-01T12:01:00.000Z",
        supersedesDraftId: draft.draftId,
        approvalRequestId: undefined,
        approvedBy: undefined,
        approvedAt: undefined
      };
      expect(await store.insertProductionDraft({ businessId: "local" }, continuation)).toBe("created");
      await store.appendEvent({ businessId: "local" }, caseId!, {
        at: continuation.createdAt,
        role: "assistant",
        kind: "revision_created",
        text: "Neue Produktionsrevision zur Prüfung erstellt.",
        artifactId: continuation.draftId,
        revisionRef: {
          artifactType: "ProductionDraft",
          artifactId: continuation.draftId,
          revision: continuation.revision,
          createdAt: continuation.createdAt,
          supersedesArtifactId: draft.draftId
        }
      }, `revision:${continuation.draftId}`);
      expect(await store.reopenCaseForDraftContinuation(
        { businessId: "local" },
        caseId!,
        continuation.draftId
      )).toBe("reopened");
      const reopenedCase = await store.getCase({ businessId: "local" }, caseId!);
      expect(reopenedCase?.status).toBe("open");
      expect(reopenedCase?.approvedProductionSpecId).toBeUndefined();
      expect(reopenedCase?.currentPlanId).toBeUndefined();
      expect(reopenedCase?.currentPurchaseListId).toBeUndefined();

      const response = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain(
        "ApprovedProductionSpec gehört nicht mehr zum aktuellen freigegebenen Produktionsauftrag."
      );
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await repository.get({ businessId: "local" }, "recipe-draft-vitello")).toBeUndefined();
    } finally {
      await app.close();
      await persistedOffer.app.close();
    }
  });

  it("keeps the retired draft Apply route unavailable", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft("production-draft-apply-pending");

    try {
      await store.saveProductionDraft({ businessId: "local" }, draft);
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/apply`,
        headers: trustedProductionHeaders
      });

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
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    const draft = await buildDraft("production-draft-apply-conflict");
    await store.savePlan({ businessId: "local" }, {
      ...draft.draftArtifacts.productionPlan!,
      warnings: ["abweichender bestehender Plan"]
    });

    try {
      const response = await importApproveAndApply(app, store, draft, intakeRecords);

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
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const { draft, persistedOffer } = await buildCanonicalApplyFixture(
      dataRoot,
      "production-draft-apply-recipe-conflict"
    );
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    await repository.save({ businessId: "local" }, {
      ...recipeCandidate(),
      name: "Bestehendes abweichendes Rezept"
    });

    try {
      await linkProductionCaseToDraft(app, store, draft, persistedOffer.handoff.handoffId);
      const response = await importApproveAndApply(app, store, draft, intakeRecords, persistedOffer.handoff.eventSpecSnapshot);

      expect(response.statusCode).toBe(409);
      expect(response.body).toContain("Recipe recipe-draft-vitello existiert bereits");
      expect(await store.getPlan({ businessId: "local" }, draft.draftArtifacts.productionPlan?.planId ?? ""))
        .toBeUndefined();
      expect(await store.getPurchaseList({ businessId: "local" }, draft.draftArtifacts.purchaseList?.purchaseListId ?? ""))
        .toBeUndefined();
    } finally {
      await app.close();
      await persistedOffer.app.close();
    }
  });

  it("rejects an approved snapshot whose event variant differs from the persisted handoff", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const originalDraft = await buildDraft("production-draft-apply-variant-binding");
    const originalSpec = originalDraft.draftArtifacts.eventSpec!;
    const handoff = offerHandoffFor(originalSpec, originalDraft.draftId);
    const tamperedDraft: ProductionDraft = {
      ...originalDraft,
      source: { ...originalDraft.source, sourceRef: `offer-handoff:${handoff.handoffId}` },
      draftArtifacts: {
        ...originalDraft.draftArtifacts,
        eventSpec: {
          ...handoff.eventSpecSnapshot,
          attendees: {
            ...handoff.eventSpecSnapshot.attendees,
            expected: (handoff.eventSpecSnapshot.attendees.expected ?? 0) + 1
          }
        }
      }
    };
    await intakeRecords.insertSpec({ businessId: "local" }, handoff.eventSpecSnapshot);
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      handoffReader: { get: async () => handoff },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const response = await importApproveAndApply(
        app,
        store,
        tamperedDraft,
        intakeRecords,
        handoff.eventSpecSnapshot
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain(
        "Freigegebener Produktionssnapshot besitzt keine gültige Offer-/Handoff-Evidenz."
      );
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects a persisted post-approval draft whose sourceRef no longer identifies its handoff", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const originalDraft = await buildDraft("production-draft-apply-source-ref-binding");
    const originalSpec = originalDraft.draftArtifacts.eventSpec!;
    const handoff = offerHandoffFor(originalSpec, originalDraft.draftId);
    const draft: ProductionDraft = {
      ...originalDraft,
      source: { ...originalDraft.source, kind: "manual_import", sourceRef: `offer-handoff:${handoff.handoffId}` },
      draftArtifacts: {
        ...originalDraft.draftArtifacts,
        eventSpec: handoff.eventSpecSnapshot
      }
    };
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      handoffReader: { get: async () => handoff },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const caseResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/from-handoff/${handoff.handoffId}`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      expect(caseResponse.statusCode).toBe(201);
      const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
      await store.appendEvent({ businessId: "local" }, caseId, {
        at: draft.createdAt,
        role: "system",
        kind: "draft_created",
        text: "Synthetische Produktionsakte angelegt.",
        artifactId: draft.draftId
      });
      const approvedProductionSpecId = await approveDraft(app, store, draft, intakeRecords, handoff.eventSpecSnapshot);
      const draftPath = path.join(
        dataRoot,
        "businesses",
        "local",
        "production",
        "drafts",
        `${encodeURIComponent(draft.draftId)}.json`
      );
      const persisted = JSON.parse(readFileSync(draftPath, "utf8")) as ProductionDraft;
      writeFileSync(draftPath, JSON.stringify({
        ...persisted,
        source: { ...persisted.source, sourceRef: "tampered-after-approval" }
      }, null, 2));

      const response = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain(
        "Freigegebener Produktionssnapshot besitzt keine gültige Offer-/Handoff-Evidenz."
      );
      expect(await store.getPlan({ businessId: "local" }, draft.draftArtifacts.productionPlan?.planId ?? ""))
        .toBeUndefined();
      expect(await store.getPurchaseList({ businessId: "local" }, draft.draftArtifacts.purchaseList?.purchaseListId ?? ""))
        .toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("rejects a handoff whose selected variant identity is not the persisted approved variant", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const baseDraft = await buildDraft("production-draft-apply-variant-id-binding");
    const originalSpec = baseDraft.draftArtifacts.eventSpec!;
    const handoff = offerHandoffFor(originalSpec, baseDraft.draftId);
    const draft: ProductionDraft = {
      ...baseDraft,
      source: { ...baseDraft.source, kind: "manual_import", sourceRef: `offer-handoff:${handoff.handoffId}` },
      draftArtifacts: {
        ...baseDraft.draftArtifacts,
        eventSpec: handoff.eventSpecSnapshot
      }
    };
    const invalidHandoff = {
      ...handoff,
      source: { ...handoff.source, selectedVariantId: "variant-not-approved" }
    };
    const caseApp = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      handoffReader: { get: async () => handoff },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });
    let invalidApp: ReturnType<typeof buildProductionApp> | undefined;

    try {
      const caseResponse = await caseApp.inject({
        method: "POST",
        url: `/v1/production/cases/from-handoff/${handoff.handoffId}`,
        headers: trustedProductionHeaders,
        payload: {}
      });
      expect(caseResponse.statusCode).toBe(201);
      const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
      await store.appendEvent({ businessId: "local" }, caseId, {
        at: draft.createdAt,
        role: "system",
        kind: "draft_created",
        text: "Synthetische Produktionsakte angelegt.",
        artifactId: draft.draftId
      });
      await caseApp.close();
      invalidApp = buildProductionApp({
        dataRoot,
        store,
        intakeRecords,
        // The production boundary must treat a reader that rejects a tampered
        // selectedVariantId as missing immutable Offer evidence.
        handoffReader: { get: async () => { throw new Error(`invalid selected variant ${invalidHandoff.source.selectedVariantId}`); } },
        trustedActorSecret: TRUSTED_SECRET,
        env: {}
      });
      const response = await importApproveAndApply(invalidApp, store, draft, intakeRecords, handoff.eventSpecSnapshot);

      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain(
        "Freigegebener Produktionssnapshot konnte nicht gegen den persistierten Offer-/Handoff-Snapshot geprüft werden."
      );
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
    } finally {
      await caseApp.close();
      await invalidApp?.close();
    }
  });

  it("leaves no Apply artifacts after a recipe conflict races the publication", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new RaceRecipeRepository({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const conflictingRecipe = {
      ...recipeCandidate(),
      name: "Concurrent recipe write"
    };
    const { draft, persistedOffer } = await buildCanonicalApplyFixture(
      dataRoot,
      "production-draft-apply-racing-recipe"
    );
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      productionApplyFaultInjector: (phase) => {
        if (phase === "after_purchase_list_write") repository.armRecipeConflict(conflictingRecipe);
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await linkProductionCaseToDraft(app, store, draft, persistedOffer.handoff.handoffId);
      const response = await importApproveAndApply(app, store, draft, intakeRecords, persistedOffer.handoff.eventSpecSnapshot);

      expect(response.statusCode).toBe(409);
      expect(response.body).toContain("Recipe recipe-draft-vitello existiert bereits");
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await repository.get({ businessId: "local" }, conflictingRecipe.recipeId)).toEqual(conflictingRecipe);
    } finally {
      await app.close();
      await persistedOffer.app.close();
    }
  });

  it("rejects AcceptedEventSpec drift between the canonical read and first Apply write", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new DriftOnApplyIntakeRecordsPort();
    const { draft, persistedOffer } = await buildCanonicalApplyFixture(
      dataRoot,
      "production-draft-apply-spec-drift"
    );
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      productionApplyFaultInjector: (phase) => {
        if (phase === "after_event_spec_write") intakeRecords.drift();
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await linkProductionCaseToDraft(app, store, draft, persistedOffer.handoff.handoffId);
      const response = await importApproveAndApply(app, store, draft, intakeRecords, persistedOffer.handoff.eventSpecSnapshot);

      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain(
        "AcceptedEventSpec wurde zwischenzeitlich geändert."
      );
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
    } finally {
      await app.close();
      await persistedOffer.app.close();
    }
  });
});
