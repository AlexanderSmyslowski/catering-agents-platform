import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newDb } from "pg-mem";
import {
  buildProductionApp,
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  ProductionStore,
  RecipeDiscoveryService,
  type ProductionApplyFaultPhase
} from "@catering/production-service";
import {
  AuditLogStore,
  auditIdFor,
  approvalRequestIdForTarget,
  createEventRequestFromText,
  evaluateQuantityRecipeProductionBridge,
  evaluateReadiness,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type AcceptedEventSpec,
  type QuantityDecisionInput,
  type ProductionDraft,
  type ProductionHandoff,
  type Recipe,
  type RecipeEventUseReview
} from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import type { IntakeRecordsPort } from "../production-service/src/ports/intake-records-port.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { IntakeStore } from "../intake-service/src/store.js";

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

type PgMemPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  connect: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
    release: () => void;
  }>;
  end: () => Promise<void>;
};

function advisoryCompatiblePgMemPool(): PgMemPool {
  const database = newDb();
  const { Pool } = database.adapters.createPg();
  const base = new Pool();
  const query = (sql: string, params?: unknown[]) => base.query(sql, params) as Promise<{ rows: Array<Record<string, unknown>> }>;
  return {
    query,
    async connect() {
      const client = await base.connect();
      let transactionBackup: ReturnType<typeof database.backup> | undefined;
      return {
        async query(sql: string, params?: unknown[]) {
          if (sql === "BEGIN") transactionBackup = database.backup();
          if (sql === "ROLLBACK") {
            const result = await client.query(sql, params) as { rows: Array<Record<string, unknown>> };
            transactionBackup?.restore();
            transactionBackup = undefined;
            return result;
          }
          if (sql === "COMMIT") transactionBackup = undefined;
          if (sql.includes("pg_advisory_xact_lock") || sql.includes("set_config('lock_timeout'")) {
            return { rows: [] };
          }
          return client.query(sql, params) as Promise<{ rows: Array<Record<string, unknown>> }>;
        },
        release: () => client.release()
      };
    },
    end: () => base.end()
  };
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-draft-apply-"));
}

function acceptedEventSpecLockQueue(rootDir: string, specId: string): string {
  const identity = JSON.stringify({
    businessId: "local",
    kind: "accepted_event_spec",
    artifactId: specId,
    revision: 0
  });
  const lockHash = createHash("sha256").update(identity).digest("hex");
  return path.join(
    rootDir,
    "businesses",
    "local",
    "intake/specs",
    ".decision-target-locks",
    `${lockHash}.lock.queue`
  );
}

function fileLockTicketCount(queuePath: string): number {
  try {
    return readdirSync(queuePath).filter((entry) => /^ticket-\d{12}\.json$/.test(entry)).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function waitForFileLockTicketCount(queuePath: string, minimum: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (fileLockTicketCount(queuePath) >= minimum) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`Expected at least ${minimum} AcceptedEventSpec lock tickets in ${queuePath}.`);
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
  const planningRepository = new InMemoryRecipeRepository();
  const planningRecipe = {
    ...recipeCandidate(),
    // The shared Apply fixture represents a human-reviewed vegetarian recipe
    // rather than relying on an implicit recipe or readiness override.
    dietTags: ["vegetarian"]
  } satisfies Recipe;
  await planningRepository.save({ businessId: "local" }, planningRecipe);
  const explicitPlanningDecisions: Record<string, {
    menuCategory: "classic" | "vegetarian" | "vegan";
    productionDecision: NonNullable<AcceptedEventSpec["menuPlan"][number]["productionDecision"]>;
  }> = {
    "Lunch-Buffet kompakt": { menuCategory: "classic", productionDecision: { mode: "scratch" } },
    "Salate": { menuCategory: "classic", productionDecision: { mode: "scratch" } },
    "vegetarische/vegane Komponente": { menuCategory: "vegetarian", productionDecision: { mode: "scratch" } },
    "Brot/Baguette": {
      menuCategory: "classic",
      productionDecision: { mode: "convenience_purchase", purchasedElements: ["Baguette"] }
    },
    "kleines Dessert optional": { menuCategory: "classic", productionDecision: { mode: "scratch" } },
    "vegetarischer Tomatensuppe": { menuCategory: "vegetarian", productionDecision: { mode: "scratch" } }
  };
  const planningSpecBase: AcceptedEventSpec = {
    ...spec,
    event: {
      ...spec.event,
      date: spec.event.date
    },
    menuPlan: spec.menuPlan.map((component) => {
      const decision = explicitPlanningDecisions[component.label];
      if (!decision) throw new Error(`Apply-Positivfixture benötigt eine explizite Entscheidung für ${component.label}.`);
      return {
        ...component,
        menuCategory: decision.menuCategory,
        productionDecision: decision.productionDecision,
        recipeOverrideId: planningRecipe.recipeId
      };
    })
  };
  const evaluatedPlanningReadiness = evaluateReadiness(planningSpecBase);
  const planningSpec: AcceptedEventSpec = {
    ...planningSpecBase,
    readiness: evaluatedPlanningReadiness.readiness,
    missingFields: evaluatedPlanningReadiness.missingFields
  };
  const quantityRecipeBridges: Record<string, ReturnType<typeof evaluateQuantityRecipeProductionBridge>> = {};
  const recipeEventUseReviews: Record<string, RecipeEventUseReview> = {};
  for (const component of planningSpec.menuPlan) {
    const guestCount = component.servings ?? planningSpec.attendees.expected ?? 0;
    const quantityDecision: QuantityDecisionInput = {
      decisionId: `quantity-review-${draftId}-${component.componentId}`,
      eventSpecId: planningSpec.specId,
      componentId: component.componentId,
      guestCount,
      serviceFormat: component.serviceStyle ?? "buffet",
      dishRole: component.course === "starter" ? "starter" : "other",
      basis: "servings_per_person",
      perUnitAmount: 1,
      perUnitUnit: "servings",
      targetAmount: guestCount,
      targetUnit: "servings",
      rationale: "Menschlich bestätigte Portionsentscheidung für den Apply-Positivpfad.",
      evidence: { kind: "operator_instruction", reference: "apply-positive-fixture-review" },
      reviewStatus: "approved"
    };
    const recipeEventUseReview: RecipeEventUseReview = {
      eventSpecId: planningSpec.specId,
      recipeId: planningRecipe.recipeId,
      reviewedBy: "Produktions-Mitarbeiter",
      reviewedAt: "2026-07-01T12:00:00.000Z",
      decision: "accepted_for_event",
      confirmations: {
        quantitiesAndYield: true,
        methodAndEquipment: true,
        allergensAndDiet: true,
        holdingAndRegeneration: true
      }
    };
    recipeEventUseReviews[component.componentId] = recipeEventUseReview;
    quantityRecipeBridges[component.componentId] = evaluateQuantityRecipeProductionBridge({
      eventSpecId: planningSpec.specId,
      componentId: component.componentId,
      quantityDecision,
      recipe: planningRecipe,
      recipeEventUseReview
    });
  }
  const discoveryService = new RecipeDiscoveryService(
    planningRepository,
    {
      searchRecipes: async () => []
    }
  );
  const artifacts = await buildProductionArtifacts(planningSpec, discoveryService, {
    context: { businessId: "local" },
    quantityRecipeBridges,
    recipeEventUseReviews
  });

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
      recipes: [planningRecipe],
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

class IntakeStoreRecordsPort implements IntakeRecordsPort {
  constructor(readonly store: IntakeStore) {}

  async getRequest(context: { businessId: string }, requestId: string) {
    return this.store.getRequest(context, requestId);
  }

  async getSpec(context: { businessId: string }, specId: string) {
    return this.store.getSpec(context, specId);
  }

  async insertSpec(context: { businessId: string }, spec: AcceptedEventSpec): Promise<"created" | "same_content"> {
    const result = await this.store.insertSpec(context, spec);
    return result === "created" ? "created" : "same_content";
  }

  async replaceSpec(
    context: { businessId: string },
    expected: AcceptedEventSpec,
    replacement: AcceptedEventSpec
  ): Promise<"updated" | "same_content"> {
    const result = await this.store.replaceSpec(context, expected, replacement);
    if (result === "updated" || result === "same_content") return result;
    throw new Error("AcceptedEventSpec wurde zwischenzeitlich geändert.");
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
    payload: { caseId, text: "Business Lunch am 2026-09-18 fuer 45 Personen." }
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
    artifactId: draft.draftId,
    revisionRef: {
      artifactType: "ProductionDraft",
      artifactId: draft.draftId,
      revision: draft.revision,
      createdAt: draft.createdAt
    }
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

function continuationDraftFor(
  draft: ProductionDraft,
  sourceSpecId: string,
  suffix: string
): ProductionDraft {
  const eventSpec = draft.draftArtifacts.eventSpec;
  if (!eventSpec) throw new Error("Die Apply-Fixture benötigt eine EventSpec für die Fortsetzung.");
  return {
    ...structuredClone(draft),
    draftId: `${draft.draftId}-${suffix}`,
    revision: draft.revision + 1,
    status: "pending_review",
    createdAt: "2099-01-01T12:01:00.000Z",
    supersedesDraftId: draft.draftId,
    approvalRequestId: undefined,
    approvedBy: undefined,
    approvedAt: undefined,
    source: {
      ...draft.source,
      runId: `${draft.source.runId}-${suffix}`
    },
    reviewCards: draft.reviewCards.map((card) => ({
      ...card,
      decision: "pending" as const,
      decidedBy: undefined,
      decidedAt: undefined,
      operatorComment: undefined,
      operatorCommentVisibility: undefined
    })),
    draftArtifacts: {
      ...structuredClone(draft.draftArtifacts),
      eventSpec: { ...structuredClone(eventSpec), specId: sourceSpecId }
    }
  };
}

async function commitContinuationWithTimeline(
  store: ProductionStore,
  caseId: string,
  sourceDraft: ProductionDraft,
  continuation: ProductionDraft
): Promise<void> {
  const sourceSpecId = sourceDraft.draftArtifacts.eventSpec?.specId;
  const nextSourceSpecId = continuation.draftArtifacts.eventSpec?.specId;
  if (!sourceSpecId || !nextSourceSpecId) throw new Error("Fortsetzung benötigt beide Spezifikations-IDs.");
  const result = await store.commitDraftForCaseSource({
    businessId: "local"
  }, {
    caseId,
    expectedSourceSpecId: sourceSpecId,
    nextSourceSpecId,
    at: continuation.createdAt,
    draftForCaseEvent: continuation,
    draftTarget: {
      kind: "production_draft",
      artifactId: sourceDraft.draftId,
      revision: sourceDraft.revision
    },
    commitDraft: async (scope) => {
      const inserted = await scope.insertDraft(continuation);
      const persisted = inserted === "created" ? continuation : await scope.getDraft(continuation.draftId);
      return persisted
        ? { status: "committed" as const, value: persisted }
        : { status: "conflict" as const };
    }
  });
  expect(result.status).toBe("committed");
}

async function persistContinuationWithTimelineFailure(
  store: ProductionStore,
  caseId: string,
  sourceDraft: ProductionDraft,
  continuation: ProductionDraft
): Promise<void> {
  const sourceSpecId = sourceDraft.draftArtifacts.eventSpec?.specId;
  const nextSourceSpecId = continuation.draftArtifacts.eventSpec?.specId;
  if (!sourceSpecId || !nextSourceSpecId) throw new Error("Fortsetzung benötigt beide Spezifikations-IDs.");
  const originalAppend = (store as any).appendEventInCollections.bind(store);
  const appendSpy = vi.spyOn(store as any, "appendEventInCollections");
  let failed = false;
  appendSpy.mockImplementation(async (...args: any[]) => {
    const input = args[2] as { kind?: string; artifactId?: string };
    if (
      !failed &&
      input.artifactId === continuation.draftId &&
      (input.kind === "draft_created" || input.kind === "revision_created")
    ) {
      failed = true;
      throw new Error("simulated one-time successor timeline failure");
    }
    return originalAppend(...args);
  });
  try {
    await expect(store.commitDraftForCaseSource({ businessId: "local" }, {
      caseId,
      expectedSourceSpecId: sourceSpecId,
      nextSourceSpecId,
      at: continuation.createdAt,
      draftForCaseEvent: continuation,
      draftTarget: {
        kind: "production_draft",
        artifactId: sourceDraft.draftId,
        revision: sourceDraft.revision
      },
      commitDraft: async (scope) => {
        const inserted = await scope.insertDraft(continuation);
        const persisted = inserted === "created" ? continuation : await scope.getDraft(continuation.draftId);
        return persisted
          ? { status: "committed" as const, value: persisted }
          : { status: "conflict" as const };
      }
    })).rejects.toThrow("simulated one-time successor timeline failure");
  } finally {
    appendSpy.mockRestore();
  }
}

function blockDraftTimelineEvent(store: ProductionStore, draftId: string): {
  hasStarted: () => boolean;
  release: () => void;
} {
  const original = (store as any).appendEventInCollections.bind(store);
  let started = false;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(store as any, "appendEventInCollections").mockImplementation(async (...args: any[]) => {
    const input = args[2] as { kind?: string; artifactId?: string };
    if (
      !started &&
      (input.kind === "draft_created" || input.kind === "revision_created") &&
      input.artifactId === draftId
    ) {
      started = true;
      await blocked;
    }
    return original(...args);
  });
  return { hasStarted: () => started, release };
}

async function yieldUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function snapshotApplyState(
  fixture: {
    store: ProductionStore;
    repository: InMemoryRecipeRepository;
    auditLog: AuditLogStore;
    caseId: string;
  }
) {
  return {
    plans: await fixture.store.listPlans({ businessId: "local" }),
    purchaseLists: await fixture.store.listPurchaseLists({ businessId: "local" }),
    recipes: await fixture.repository.list({ businessId: "local" }),
    manifests: await fixture.store.listApplyManifests({ businessId: "local" }),
    approvedSpecs: await fixture.store.listApprovedProductionSpecs({ businessId: "local" }),
    currentCase: await fixture.store.getCase({ businessId: "local" }, fixture.caseId),
    events: await fixture.store.listEvents({ businessId: "local" }, fixture.caseId),
    audits: await fixture.auditLog.listRecentFor({ businessId: "local" }, 200)
  };
}

async function buildApprovedContinuationFixture(
  rootDir: string,
  draftId: string,
  applyFaultInjector?: (phase: ProductionApplyFaultPhase) => void,
  options: { pgPool?: PgMemPool } = {}
) {
  const repository = new InMemoryRecipeRepository({ rootDir, pgPool: options.pgPool });
  const store = new ProductionStore({ rootDir, pgPool: options.pgPool });
  const auditLog = new AuditLogStore({ rootDir, pgPool: options.pgPool });
  const intakeRecords = new InMemoryIntakeRecordsPort();
  const { draft, persistedOffer } = await buildCanonicalApplyFixture(rootDir, draftId);
  const app = buildProductionApp({
    dataRoot: rootDir,
    repository,
    store,
    auditLog,
    intakeRecords,
    handoffReader: { get: (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
    trustedActorSecret: TRUSTED_SECRET,
    env: { CATERING_DEV_AUTH: "1" },
    productionApplyFaultInjector: applyFaultInjector
  });
  await linkProductionCaseToDraft(app, store, draft, persistedOffer.handoff.handoffId);
  const approvedProductionSpecId = await approveDraft(
    app,
    store,
    draft,
    intakeRecords,
    persistedOffer.handoff.eventSpecSnapshot
  );
  const caseId = await store.findCaseIdForArtifact({ businessId: "local" }, draft.draftId);
  if (!caseId) throw new Error("Apply-Fixture besitzt keinen Produktionsfall.");
  return { app, auditLog, repository, store, intakeRecords, persistedOffer, draft, caseId, approvedProductionSpecId };
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
      env: { CATERING_DEV_AUTH: "1" }
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
      env: { CATERING_DEV_AUTH: "1" }
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
      env: { CATERING_DEV_AUTH: "1" }
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

  it("fails closed when a changed-source successor survives a lost case event", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(dataRoot, "production-draft-apply-unprojected-changed-source");
    const nextSpecId = `${fixture.draft.draftArtifacts.eventSpec!.specId}-successor`;
    const continuation = continuationDraftFor(fixture.draft, nextSpecId, "unprojected-changed-source");

    try {
      await persistContinuationWithTimelineFailure(fixture.store, fixture.caseId, fixture.draft, continuation);
      const successorBeforeApply = await fixture.store.getProductionDraft({ businessId: "local" }, continuation.draftId);
      const caseBeforeApply = await fixture.store.getCase({ businessId: "local" }, fixture.caseId);
      const eventsBeforeApply = await fixture.store.listEvents({ businessId: "local" }, fixture.caseId);
      expect(successorBeforeApply).toEqual(continuation);
      expect(caseBeforeApply).toMatchObject({ sourceSpecId: fixture.draft.draftArtifacts.eventSpec!.specId });
      expect(eventsBeforeApply.some((event) =>
        event.artifactId === continuation.draftId || event.revisionRef?.artifactId === continuation.draftId
      )).toBe(false);

      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(await fixture.store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.repository.list({ businessId: "local" })).toHaveLength(0);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("fails closed when a same-source successor survives a lost case event", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(dataRoot, "production-draft-apply-unprojected-same-source");
    const sourceSpecId = fixture.draft.draftArtifacts.eventSpec!.specId;
    const continuation = continuationDraftFor(fixture.draft, sourceSpecId, "unprojected-same-source");

    try {
      await persistContinuationWithTimelineFailure(fixture.store, fixture.caseId, fixture.draft, continuation);
      const successorBeforeApply = await fixture.store.getProductionDraft({ businessId: "local" }, continuation.draftId);
      const caseBeforeApply = await fixture.store.getCase({ businessId: "local" }, fixture.caseId);
      const eventsBeforeApply = await fixture.store.listEvents({ businessId: "local" }, fixture.caseId);
      expect(successorBeforeApply).toEqual(continuation);
      expect(caseBeforeApply).toMatchObject({ sourceSpecId });
      expect(eventsBeforeApply.some((event) =>
        event.artifactId === continuation.draftId || event.revisionRef?.artifactId === continuation.draftId
      )).toBe(false);

      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(await fixture.store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.repository.list({ businessId: "local" })).toHaveLength(0);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("fails closed when an unprojected sibling follows an approved ancestor", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(dataRoot, "production-draft-apply-unprojected-sibling");
    const sourceSpecId = fixture.draft.draftArtifacts.eventSpec!.specId;
    const orphan = continuationDraftFor(fixture.draft, sourceSpecId, "orphan");
    const sibling = continuationDraftFor(fixture.draft, sourceSpecId, "sibling");

    try {
      await commitContinuationWithTimeline(fixture.store, fixture.caseId, fixture.draft, sibling);
      const siblingApprovedProductionSpecId = await approveDraft(
        fixture.app,
        fixture.store,
        sibling,
        new InMemoryIntakeRecordsPort(),
        sibling.draftArtifacts.eventSpec
      );
      // The approved sibling is the current projected branch.  The orphan is
      // then introduced as a separate, same-ancestor branch whose timeline
      // event is lost; Apply must reject the resulting ambiguous lineage.
      await persistContinuationWithTimelineFailure(fixture.store, fixture.caseId, fixture.draft, orphan);
      expect(await fixture.store.getProductionDraft({ businessId: "local" }, orphan.draftId)).toEqual(orphan);
      expect((await fixture.store.listEvents({ businessId: "local" }, fixture.caseId))
        .some((event) => event.artifactId === orphan.draftId)).toBe(false);

      const caseBeforeApply = await fixture.store.getCase({ businessId: "local" }, fixture.caseId);
      const eventsBeforeApply = await fixture.store.listEvents({ businessId: "local" }, fixture.caseId);
      const auditsBeforeApply = await fixture.auditLog.listRecentFor({ businessId: "local" }, 200);

      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${siblingApprovedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(await fixture.store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.repository.list({ businessId: "local" })).toHaveLength(0);
      await expect(fixture.store.getCase({ businessId: "local" }, fixture.caseId))
        .resolves.toEqual(caseBeforeApply);
      await expect(fixture.store.listEvents({ businessId: "local" }, fixture.caseId))
        .resolves.toEqual(eventsBeforeApply);
      await expect(fixture.auditLog.listRecentFor({ businessId: "local" }, 200))
        .resolves.toEqual(auditsBeforeApply);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("fails closed when a deterministic case-bound spec-import root survives a lost case event", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(dataRoot, "production-draft-apply-unprojected-spec-root");
    const specId = fixture.persistedOffer.handoff.eventSpecSnapshot.specId;
    let failed = false;
    const originalAppend = (fixture.store as any).appendEventInCollections.bind(fixture.store);
    const appendSpy = vi.spyOn(fixture.store as any, "appendEventInCollections");
    appendSpy.mockImplementation(async (...args: any[]) => {
      const input = args[2] as { kind?: string; artifactId?: string };
      if (!failed && input.kind === "draft_created" && input.artifactId !== fixture.draft.draftId) {
        failed = true;
        throw new Error("simulated one-time deterministic root timeline failure");
      }
      return originalAppend(...args);
    });

    try {
      const failedImport = await fixture.app.inject({
        method: "POST",
        url: "/v1/production/drafts",
        headers: trustedProductionHeaders,
        payload: { caseId: fixture.caseId, specId }
      });
      expect(failedImport.statusCode).toBe(500);
      const persistedDrafts = await (fixture.store as any).productionDrafts.list({ businessId: "local" }) as ProductionDraft[];
      const unprojectedRoot = persistedDrafts.find((candidate) =>
        candidate.draftId !== fixture.draft.draftId && !candidate.supersedesDraftId
      );
      expect(unprojectedRoot).toBeDefined();
      expect((await fixture.store.listEvents({ businessId: "local" }, fixture.caseId))
        .some((event) => event.artifactId === unprojectedRoot?.draftId)).toBe(false);

      const caseBeforeApply = await fixture.store.getCase({ businessId: "local" }, fixture.caseId);
      const eventsBeforeApply = await fixture.store.listEvents({ businessId: "local" }, fixture.caseId);
      const auditsBeforeApply = await fixture.auditLog.listRecentFor({ businessId: "local" }, 200);
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(await fixture.store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.repository.list({ businessId: "local" })).toHaveLength(0);
      await expect(fixture.store.getCase({ businessId: "local" }, fixture.caseId))
        .resolves.toEqual(caseBeforeApply);
      await expect(fixture.store.listEvents({ businessId: "local" }, fixture.caseId))
        .resolves.toEqual(eventsBeforeApply);
      await expect(fixture.auditLog.listRecentFor({ businessId: "local" }, 200))
        .resolves.toEqual(auditsBeforeApply);
    } finally {
      appendSpy.mockRestore();
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("fails closed when a changed-source continuation is persisted before its case timeline event", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(dataRoot, "production-draft-apply-source-race");
    const nextSpecId = `${fixture.draft.draftArtifacts.eventSpec!.specId}-continuation`;
    const continuation = continuationDraftFor(fixture.draft, nextSpecId, "changed-source");

    try {
      const timelineBarrier = blockDraftTimelineEvent(fixture.store, continuation.draftId);
      const commitPromise = commitContinuationWithTimeline(fixture.store, fixture.caseId, fixture.draft, continuation);
      await yieldUntil(timelineBarrier.hasStarted);
      expect(timelineBarrier.hasStarted()).toBe(true);
      let applySettled = false;
      const applyPromise = fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      }).then((response) => {
        applySettled = true;
        return response;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(applySettled).toBe(false);
      timelineBarrier.release();
      await commitPromise;
      const eventsAfterCommit = await fixture.store.listEvents({ businessId: "local" }, fixture.caseId);
      expect(eventsAfterCommit.some((event) =>
        event.artifactId === continuation.draftId || event.revisionRef?.artifactId === continuation.draftId
      )).toBe(true);
      const changedSourceCase = await fixture.store.getCase({ businessId: "local" }, fixture.caseId);
      expect(changedSourceCase).toMatchObject({ sourceSpecId: nextSpecId, status: "open" });
      expect(changedSourceCase?.approvedProductionSpecId).toBeUndefined();
      expect(changedSourceCase?.currentPlanId).toBeUndefined();
      expect(changedSourceCase?.currentPurchaseListId).toBeUndefined();

      const apply = await applyPromise;
      expect(apply.statusCode).toBe(409);
      expect(await fixture.store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.repository.list({ businessId: "local" })).toHaveLength(0);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("fails closed when a same-source continuation is persisted before its case timeline event", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(dataRoot, "production-draft-apply-same-source-race");
    const sourceSpecId = fixture.draft.draftArtifacts.eventSpec!.specId;
    const continuation = continuationDraftFor(fixture.draft, sourceSpecId, "same-source");

    try {
      const timelineBarrier = blockDraftTimelineEvent(fixture.store, continuation.draftId);
      const commitPromise = commitContinuationWithTimeline(fixture.store, fixture.caseId, fixture.draft, continuation);
      await yieldUntil(timelineBarrier.hasStarted);
      expect(timelineBarrier.hasStarted()).toBe(true);
      let applySettled = false;
      const applyPromise = fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      }).then((response) => {
        applySettled = true;
        return response;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(applySettled).toBe(false);
      timelineBarrier.release();
      await commitPromise;
      const eventsAfterCommit = await fixture.store.listEvents({ businessId: "local" }, fixture.caseId);
      expect(eventsAfterCommit.some((event) =>
        event.artifactId === continuation.draftId || event.revisionRef?.artifactId === continuation.draftId
      )).toBe(true);
      const sameSourceCase = await fixture.store.getCase({ businessId: "local" }, fixture.caseId);
      expect(sameSourceCase).toMatchObject({ sourceSpecId, status: "open" });
      expect(sameSourceCase?.approvedProductionSpecId).toBeUndefined();
      expect(sameSourceCase?.currentPlanId).toBeUndefined();
      expect(sameSourceCase?.currentPurchaseListId).toBeUndefined();

      const apply = await applyPromise;
      expect(apply.statusCode).toBe(409);
      expect(await fixture.store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await fixture.repository.list({ businessId: "local" })).toHaveLength(0);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
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
      env: { CATERING_DEV_AUTH: "1" }
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
      env: { CATERING_DEV_AUTH: "1" }
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
      env: { CATERING_DEV_AUTH: "1" }
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
    const canonicalDraft: ProductionDraft = {
      ...originalDraft,
      source: { ...originalDraft.source, sourceRef: `offer-handoff:${handoff.handoffId}` },
      draftArtifacts: {
        ...originalDraft.draftArtifacts,
        eventSpec: handoff.eventSpecSnapshot
      }
    };
    await intakeRecords.insertSpec({ businessId: "local" }, handoff.eventSpecSnapshot);
    let handoffForApply = handoff;
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      handoffReader: { get: async () => handoffForApply },
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });

    try {
      await linkProductionCaseToDraft(app, store, canonicalDraft, handoff.handoffId);
      const approvedProductionSpecId = await approveDraft(
        app,
        store,
        canonicalDraft,
        intakeRecords,
        handoff.eventSpecSnapshot
      );
      handoffForApply = {
        ...handoff,
        eventSpecSnapshot: {
          ...handoff.eventSpecSnapshot,
          attendees: {
            ...handoff.eventSpecSnapshot.attendees,
            expected: (handoff.eventSpecSnapshot.attendees.expected ?? 0) + 1
          }
        }
      };
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain(
        "Freigegebener Produktionssnapshot weicht vom persistierten Offer-/Handoff-Snapshot ab."
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
      env: { CATERING_DEV_AUTH: "1" }
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
        artifactId: draft.draftId,
        revisionRef: {
          artifactType: "ProductionDraft",
          artifactId: draft.draftId,
          revision: draft.revision,
          createdAt: draft.createdAt
        }
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
      env: { CATERING_DEV_AUTH: "1" }
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
        artifactId: draft.draftId,
        revisionRef: {
          artifactType: "ProductionDraft",
          artifactId: draft.draftId,
          revision: draft.revision,
          createdAt: draft.createdAt
        }
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
      env: { CATERING_DEV_AUTH: "1" }
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

  it("leaves no Apply artifacts when a recipe target already contains conflicting content", async () => {
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
    await repository.save({ businessId: "local" }, conflictingRecipe);
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
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

  it("serializes cross-case recipe publication until a failing Apply has rolled back", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const first = await buildCanonicalApplyFixture(dataRoot, "production-draft-cross-case-recipe-a");
    const second = await buildCanonicalApplyFixture(dataRoot, "production-draft-cross-case-recipe-b");
    const sharedRecipe = structuredClone(first.draft.draftArtifacts.recipes![0]!);
    const aOnlyRecipe = {
      ...sharedRecipe,
      recipeId: "recipe-apply-a-only",
      name: "A-only recipe"
    } satisfies Recipe;
    const conflictingRecipe = {
      ...aOnlyRecipe,
      name: "Concurrent conflicting recipe"
    } satisfies Recipe;
    const draftA: ProductionDraft = {
      ...first.draft,
      reviewCards: [
        ...first.draft.reviewCards,
        {
          cardId: "card-recipe-a-only",
          kind: "recipe",
          title: "SECRET_RECIPE_A_ONLY_TITLE",
          summary: "SECRET_RECIPE_A_ONLY_SUMMARY",
          decision: "pending",
          targetPath: "$.draftArtifacts.recipes[1]",
          targetId: conflictingRecipe.recipeId,
          requiredApproval: true
        }
      ],
      draftArtifacts: {
        ...first.draft.draftArtifacts,
        recipes: [sharedRecipe, aOnlyRecipe]
      }
    };
    const draftB: ProductionDraft = {
      ...second.draft,
      draftArtifacts: {
        ...second.draft.draftArtifacts,
        recipes: [structuredClone(sharedRecipe)]
      }
    };
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      intakeRecords,
      handoffReader: {
        get: async (context, handoffId) =>
          (handoffId === first.persistedOffer.handoff.handoffId
            ? first.persistedOffer.store.getHandoff(context, handoffId)
            : second.persistedOffer.store.getHandoff(context, handoffId))
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    let releaseA!: () => void;
    const recipeInsertPaused = new Promise<void>((resolve) => { releaseA = resolve; });
    let sharedInsertStarted!: () => void;
    const sharedInsertObserved = new Promise<void>((resolve) => { sharedInsertStarted = resolve; });
    let sharedPaused = false;
    const originalScopeFactory = repository.createLockedMutationScope.bind(repository);
    vi.spyOn(repository, "createLockedMutationScope").mockImplementation((transactionalQueryable) => {
      const base = originalScopeFactory(transactionalQueryable);
      return {
        ...base,
        insert: async (context, recipe) => {
          const result = await base.insert(context, recipe);
          if (!sharedPaused && recipe.recipeId === sharedRecipe.recipeId && result === "created") {
            sharedPaused = true;
            sharedInsertStarted();
            await recipeInsertPaused;
            await base.set(context, conflictingRecipe);
          }
          return result;
        }
      };
    });

    try {
      await linkProductionCaseToDraft(app, store, draftA, first.persistedOffer.handoff.handoffId);
      await linkProductionCaseToDraft(app, store, draftB, second.persistedOffer.handoff.handoffId);
      const approvedA = await approveDraft(
        app,
        store,
        draftA,
        intakeRecords,
        first.persistedOffer.handoff.eventSpecSnapshot
      );
      const approvedB = await approveDraft(
        app,
        store,
        draftB,
        intakeRecords,
        second.persistedOffer.handoff.eventSpecSnapshot
      );
      const applyA = app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedA}/apply`,
        headers: trustedProductionHeaders
      });
      await sharedInsertObserved;
      let applyBSettled = false;
      const applyB = app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedB}/apply`,
        headers: trustedProductionHeaders
      }).then((response) => {
        applyBSettled = true;
        return response;
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      const settledBeforeRollback = applyBSettled;
      releaseA();
      const [responseA, responseB] = await Promise.all([applyA, applyB]);

      expect(settledBeforeRollback).toBe(false);
      expect(responseA.statusCode, responseA.body).toBe(409);
      expect(responseB.statusCode, responseB.body).toBe(200);
      const specA = await store.getApprovedProductionSpec({ businessId: "local" }, approvedA);
      const specB = await store.getApprovedProductionSpec({ businessId: "local" }, approvedB);
      expect(specA).toBeDefined();
      expect(specB).toBeDefined();
      expect(await store.getApplyManifest({ businessId: "local" }, approvedA)).toBeUndefined();
      expect(await store.getApplyManifest({ businessId: "local" }, approvedB)).toBeDefined();
      expect(await store.getPlan({ businessId: "local" }, specA!.artifacts.productionPlan.planId)).toBeUndefined();
      expect(await store.getPurchaseList({ businessId: "local" }, specA!.artifacts.purchaseList.purchaseListId)).toBeUndefined();
      expect(await repository.get({ businessId: "local" }, sharedRecipe.recipeId)).toEqual(sharedRecipe);
      expect(await repository.get({ businessId: "local" }, conflictingRecipe.recipeId)).toEqual(conflictingRecipe);
      expect(await store.listPlans({ businessId: "local" })).toEqual([specB!.artifacts.productionPlan]);
      expect(await store.listPurchaseLists({ businessId: "local" })).toEqual([specB!.artifacts.purchaseList]);
    } finally {
      releaseA();
      vi.restoreAllMocks();
      await app.close();
      await first.persistedOffer.app.close();
      await second.persistedOffer.app.close();
    }
  });

  it("does not leave File Apply artifacts after an audit failure following manifest publication", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    let faultCalls = 0;
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-file-audit-fault",
      (phase) => {
        if (phase === "after_audit") {
          faultCalls += 1;
          throw new Error("synthetic Apply audit failure");
        }
      }
    );
    const before = await snapshotApplyState(fixture);
    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });
      expect(response.statusCode, response.body).toBe(500);
      expect(faultCalls).toBe(1);
      expect(await snapshotApplyState(fixture)).toEqual(before);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("fails closed when an existing apply audit has the deterministic id but different content", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-conflicting-audit"
    );
    const context = { businessId: "local" };
    const conflictingAuditInput = {
      action: "production.approved_spec_applied",
      entityType: "ApprovedProductionSpec",
      entityId: fixture.approvedProductionSpecId,
      actor: { name: "Fremder-Akteur", source: "trusted-proxy:foreign" },
      at: "2026-08-30T00:00:00.000Z",
      idempotencyKey: `production-apply:${fixture.approvedProductionSpecId}`,
      summary: "Fremder Apply-Audit mit gleicher deterministischer ID.",
      details: {
        specId: fixture.persistedOffer.handoff.eventSpecSnapshot.specId,
        planId: "foreign-plan",
        purchaseListId: "foreign-purchase-list",
        recipeCandidateCount: 99,
        writesProductObject: false
      }
    } as const;
    const conflictingAudit = await fixture.auditLog.logFor(context, conflictingAuditInput);
    const expectedAuditId = auditIdFor(
      {
        ...conflictingAuditInput,
        businessId: context.businessId
      },
      conflictingAuditInput.idempotencyKey
    );
    expect(conflictingAudit.auditId).toBe(expectedAuditId);
    const before = await snapshotApplyState(fixture);

    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(await snapshotApplyState(fixture)).toEqual(before);
      expect(await fixture.auditLog.getFor(context, conflictingAudit.auditId)).toEqual(conflictingAudit);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("preserves a foreign same-ID audit when the File audit writer fails generically", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-generic-audit-failure"
    );
    const context = { businessId: "local" };
    const conflictingAuditInput = {
      action: "production.approved_spec_applied",
      entityType: "ApprovedProductionSpec",
      entityId: fixture.approvedProductionSpecId,
      actor: { name: "Fremder-Akteur", source: "trusted-proxy:foreign" },
      at: "2026-08-30T00:00:00.000Z",
      idempotencyKey: `production-apply:${fixture.approvedProductionSpecId}`,
      summary: "Fremder Apply-Audit vor einem generischen Writer-Fehler.",
      details: {
        specId: fixture.persistedOffer.handoff.eventSpecSnapshot.specId,
        planId: "foreign-plan",
        purchaseListId: "foreign-purchase-list",
        recipeCandidateCount: 7,
        writesProductObject: false
      }
    } as const;
    const conflictingAudit = await fixture.auditLog.logFor(context, conflictingAuditInput);
    const before = await snapshotApplyState(fixture);
    vi.spyOn(fixture.auditLog, "logForWithResult").mockRejectedValueOnce(
      new Error("synthetic generic File audit write failure")
    );

    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(500);
      expect(await snapshotApplyState(fixture)).toEqual(before);
      expect(await fixture.auditLog.getFor(context, conflictingAudit.auditId)).toEqual(conflictingAudit);
    } finally {
      vi.restoreAllMocks();
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it.each([
    "plan",
    "purchase",
    "recipe",
    "manifest"
  ] as const)("compensates a File %s insert that throws after publication", async (artifact) => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      `production-draft-apply-file-post-publish-${artifact}`
    );
    const before = await snapshotApplyState(fixture);
    let faultCalls = 0;
    const throwAfterCreated = async <T>(
      original: (...args: any[]) => Promise<"created" | "exists">,
      args: any[]
    ): Promise<"created" | "exists"> => {
      const result = await original(...args);
      if (result === "created" && faultCalls === 0) {
        faultCalls += 1;
        throw new Error(`synthetic File ${artifact} post-publish failure`);
      }
      return result;
    };
    const originals: Array<() => void> = [];
    if (artifact === "recipe") {
      const scopeFactory = fixture.repository.createLockedMutationScope.bind(fixture.repository);
      const scopeSpy = vi.spyOn(fixture.repository, "createLockedMutationScope").mockImplementation((queryable) => {
        const scope = scopeFactory(queryable);
        return {
          ...scope,
          insert: (context, recipe) => throwAfterCreated(scope.insert.bind(scope), [context, recipe])
        };
      });
      originals.push(() => scopeSpy.mockRestore());
    } else {
      const collection = (fixture.store as any)[artifact === "plan" ? "plans" : artifact === "purchase" ? "purchaseLists" : "applyManifests"] as {
        insert: (...args: any[]) => Promise<"created" | "exists">
      };
      const originalInsert = collection.insert.bind(collection);
      const insertSpy = vi.spyOn(collection, "insert").mockImplementation((...args: any[]) =>
        throwAfterCreated(originalInsert, args)
      );
      originals.push(() => insertSpy.mockRestore());
    }

    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(500);
      expect(faultCalls).toBe(1);
      expect(await snapshotApplyState(fixture)).toEqual(before);
    } finally {
      for (const restore of originals.reverse()) restore();
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("keeps File plan ownership when the post-insert read-back fails", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-file-plan-readback-failure"
    );
    const plan = fixture.draft.draftArtifacts.productionPlan!;
    const plans = (fixture.store as any).plans as {
      insert: (...args: any[]) => Promise<"created" | "exists">;
      get: (...args: any[]) => Promise<unknown>;
    };
    const originalInsert = plans.insert.bind(plans);
    const originalGet = plans.get.bind(plans);
    let published = false;
    let readBackFaulted = false;
    const insertSpy = vi.spyOn(plans, "insert").mockImplementation(async (...args: any[]) => {
      const result = await originalInsert(...args);
      if (result === "created") published = true;
      return result;
    });
    const getSpy = vi.spyOn(plans, "get").mockImplementation(async (...args: any[]) => {
      const result = await originalGet(...args);
      if (published && !readBackFaulted && args[1] === plan.planId) {
        readBackFaulted = true;
        throw new Error("synthetic File plan read-back failure after publication");
      }
      return result;
    });
    const before = await snapshotApplyState(fixture);

    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(500);
      expect(readBackFaulted).toBe(true);
      expect(await snapshotApplyState(fixture)).toEqual(before);
    } finally {
      getSpy.mockRestore();
      insertSpy.mockRestore();
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("rolls back PostgreSQL Apply when an existing audit has the deterministic id but different content", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const pgPool = advisoryCompatiblePgMemPool();
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-pg-conflicting-audit",
      undefined,
      { pgPool }
    );
    const context = { businessId: "local" };
    const conflictingAuditInput = {
      action: "production.approved_spec_applied",
      entityType: "ApprovedProductionSpec",
      entityId: fixture.approvedProductionSpecId,
      actor: { name: "Fremder-Akteur", source: "trusted-proxy:foreign" },
      at: "2026-08-30T00:00:00.000Z",
      idempotencyKey: `production-apply:${fixture.approvedProductionSpecId}`,
      summary: "Fremder Apply-Audit mit gleicher deterministischer ID.",
      details: {
        specId: fixture.persistedOffer.handoff.eventSpecSnapshot.specId,
        planId: "foreign-plan",
        purchaseListId: "foreign-purchase-list",
        recipeCandidateCount: 99,
        writesProductObject: false
      }
    } as const;
    const conflictingAudit = await fixture.auditLog.logFor(context, conflictingAuditInput);
    const before = await snapshotApplyState(fixture);

    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(await snapshotApplyState(fixture)).toEqual(before);
      expect(await fixture.auditLog.getFor(context, conflictingAudit.auditId)).toEqual(conflictingAudit);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
      await pgPool.end();
    }
  });

  it("atomically rejects a concurrent conflicting Apply audit without replacing the winner", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const context = { businessId: "local" };
    const expectedWriter = new AuditLogStore({ rootDir: dataRoot });
    const competingWriter = new AuditLogStore({ rootDir: dataRoot });
    const expectedInput = {
      action: "production.approved_spec_applied",
      entityType: "ApprovedProductionSpec",
      entityId: "approved-spec-concurrent-audit",
      actor: { name: "Produktions-Mitarbeiter", source: "trusted-proxy:production" },
      at: "2026-08-30T00:00:00.000Z",
      idempotencyKey: "production-apply:approved-spec-concurrent-audit",
      summary: "Autoritativer Apply-Audit.",
      details: { planId: "plan-1", writesProductObject: true }
    } as const;
    const competingInput = {
      ...expectedInput,
      actor: { name: "Fremder-Akteur", source: "trusted-proxy:foreign" },
      summary: "Abweichender konkurrierender Audit-Eintrag.",
      details: { planId: "foreign-plan", writesProductObject: false }
    } as const;

    const results = await Promise.allSettled([
      expectedWriter.logForWithResult(context, expectedInput),
      competingWriter.logForWithResult(context, competingInput)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection?.status).toBe("rejected");
    expect((rejection as PromiseRejectedResult).reason).toMatchObject({
      name: "AuditLogEntryConflictError",
      statusCode: 409
    });
    const persisted = await expectedWriter.listRecentFor(context, 10);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.auditId).toBe(
      auditIdFor({ ...expectedInput, businessId: context.businessId }, expectedInput.idempotencyKey)
    );
  });

  it("does not leave File Apply artifacts after a Case-CAS failure", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    let faultCalls = 0;
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-file-case-fault",
      (phase) => {
        if (phase === "after_case_cas") {
          faultCalls += 1;
          throw new Error("synthetic Apply Case-CAS failure");
        }
      }
    );
    const before = await snapshotApplyState(fixture);
    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });
      expect(response.statusCode, response.body).toBe(500);
      expect(faultCalls).toBe(1);
      expect(await snapshotApplyState(fixture)).toEqual(before);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("continues File Apply compensation when restoring the Case throws after publication", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    let faultCalls = 0;
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-file-case-restore-post-publish-fault",
      (phase) => {
        if (phase === "after_case_cas") {
          faultCalls += 1;
          throw new Error("synthetic Apply failure after Case-CAS");
        }
      }
    );
    const cases = (fixture.store as any).cases as {
      compareAndSetExact: (...args: any[]) => Promise<"updated" | "conflict" | "missing">;
    };
    const originalRestore = cases.compareAndSetExact.bind(cases);
    let restoreFaulted = false;
    const restoreSpy = vi.spyOn(cases, "compareAndSetExact").mockImplementation(async (...args: any[]) => {
      const result = await originalRestore(...args);
      if (!restoreFaulted && result === "updated") {
        restoreFaulted = true;
        throw new Error("synthetic File Case restore failure after publication");
      }
      return result;
    });
    const before = await snapshotApplyState(fixture);

    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(500);
      expect(faultCalls).toBe(1);
      expect(restoreFaulted).toBe(true);
      expect(await snapshotApplyState(fixture)).toEqual(before);
    } finally {
      restoreSpy.mockRestore();
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("does not leave File Apply artifacts after a result-event failure", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    let faultCalls = 0;
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-file-result-fault",
      (phase) => {
        if (phase === "after_result_event") {
          faultCalls += 1;
          throw new Error("synthetic Apply result-event failure");
        }
      }
    );
    const before = await snapshotApplyState(fixture);
    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });
      expect(response.statusCode, response.body).toBe(500);
      expect(faultCalls).toBe(1);
      expect(await snapshotApplyState(fixture)).toEqual(before);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
    }
  });

  it("rolls back PostgreSQL Apply after the transaction-local result event", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const pgPool = advisoryCompatiblePgMemPool();
    let faultCalls = 0;
    const fixture = await buildApprovedContinuationFixture(
      dataRoot,
      "production-draft-apply-pg-result-fault",
      (phase) => {
        if (phase === "after_result_event") {
          faultCalls += 1;
          throw new Error("synthetic PostgreSQL result-event failure");
        }
      },
      { pgPool }
    );
    const before = await snapshotApplyState(fixture);
    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${fixture.approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });
      expect(response.statusCode, response.body).toBe(500);
      expect(faultCalls).toBe(1);
      expect(await snapshotApplyState(fixture)).toEqual(before);
    } finally {
      await fixture.app.close();
      await fixture.persistedOffer.app.close();
      await pgPool.end();
    }
  });

  it("holds the AcceptedEventSpec fence until File Apply publication finishes", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const intakeRecords = new IntakeStoreRecordsPort(new IntakeStore({ rootDir: dataRoot }));
    const { draft, persistedOffer } = await buildCanonicalApplyFixture(
      dataRoot,
      "production-draft-apply-spec-fence"
    );
    const app = buildProductionApp({
      dataRoot,
      store,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    let releaseApply!: () => void;
    const applyReleased = new Promise<void>((resolve) => { releaseApply = resolve; });
    let signalApplyEntered!: () => void;
    const applyEntered = new Promise<void>((resolve) => { signalApplyEntered = resolve; });
    const originalApplyScope = store.withCaseApplyCriticalSection.bind(store);
    const applyScopeSpy = vi.spyOn(store, "withCaseApplyCriticalSection").mockImplementation(
      async (...args: any[]) => originalApplyScope(
        args[0],
        args[1],
        async (current: any, scope: any, transactionalQueryable: any) => {
          signalApplyEntered();
          await applyReleased;
          return args[2](current, scope, transactionalQueryable);
        },
        args[3],
        args[4],
        args[5]
      )
    );

    try {
      await linkProductionCaseToDraft(app, store, draft, persistedOffer.handoff.handoffId);
      const approvedProductionSpecId = await approveDraft(
        app,
        store,
        draft,
        intakeRecords,
        persistedOffer.handoff.eventSpecSnapshot
      );
      const specQueue = acceptedEventSpecLockQueue(
        dataRoot,
        persistedOffer.handoff.eventSpecSnapshot.specId
      );
      const specTicketsBeforeApply = fileLockTicketCount(specQueue);
      const applyPromise = app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });
      await applyEntered;

      const canonical = await intakeRecords.store.getSpec({ businessId: "local" }, persistedOffer.handoff.eventSpecSnapshot.specId);
      expect(canonical).toBeDefined();
      const changed = structuredClone(canonical!);
      changed.attendees = { ...changed.attendees, expected: (changed.attendees.expected ?? 0) + 1 };
      let mutationSettled = false;
      const mutationPromise = intakeRecords.store.replaceSpec(
        { businessId: "local" },
        canonical!,
        changed
      ).then((result) => {
        mutationSettled = true;
        return result;
      });
      await waitForFileLockTicketCount(specQueue, specTicketsBeforeApply + 2);
      expect(mutationSettled).toBe(false);

      releaseApply();
      const response = await applyPromise;
      expect(response.statusCode, response.body).toBe(200);
      await expect(mutationPromise).resolves.toBe("updated");
      await expect(intakeRecords.store.getSpec(
        { businessId: "local" },
        persistedOffer.handoff.eventSpecSnapshot.specId
      )).resolves.toEqual(changed);
    } finally {
      releaseApply();
      applyScopeSpy.mockRestore();
      await app.close();
      await persistedOffer.app.close();
    }
  });

  it("waits for a prior IntakeStore spec mutation before applying and then fails on drift", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const intakeRecords = new IntakeStoreRecordsPort(new IntakeStore({ rootDir: dataRoot }));
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const { draft, persistedOffer } = await buildCanonicalApplyFixture(
      dataRoot,
      "production-draft-apply-spec-fence-reverse"
    );
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      auditLog,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    let releaseMutation!: () => void;
    const mutationReleased = new Promise<void>((resolve) => { releaseMutation = resolve; });
    let signalMutationEntered!: () => void;
    const mutationEntered = new Promise<void>((resolve) => { signalMutationEntered = resolve; });
    let specScopeSpy: { mockRestore: () => void } | undefined;

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
      if (!caseId) throw new Error("Apply-Fixture besitzt keinen Produktionsfall.");
      const snapshotBeforeMutation = await snapshotApplyState({
        store,
        repository,
        auditLog,
        caseId
      });
      const specQueue = acceptedEventSpecLockQueue(
        dataRoot,
        persistedOffer.handoff.eventSpecSnapshot.specId
      );
      const specTicketsBeforeMutation = fileLockTicketCount(specQueue);
      const originalSpecScope = (intakeRecords.store as any).withSpecCriticalSection.bind(intakeRecords.store);
      specScopeSpy = vi.spyOn(intakeRecords.store as any, "withSpecCriticalSection").mockImplementation(
        async (...args: any[]) => originalSpecScope(
          args[0],
          args[1],
          async (specs: any) => {
            signalMutationEntered();
            await mutationReleased;
            return args[2](specs);
          }
        )
      );
      const canonical = await intakeRecords.store.getSpec({ businessId: "local" }, persistedOffer.handoff.eventSpecSnapshot.specId);
      expect(canonical).toBeDefined();
      const changed = structuredClone(canonical!);
      changed.sourceLineage = changed.sourceLineage.map((source, index) =>
        index === 0 ? { ...source, reference: `${source.reference}:drift` } : source
      );
      const mutationPromise = intakeRecords.store.replaceSpec(
        { businessId: "local" },
        canonical!,
        changed
      );
      await mutationEntered;

      let applySettled = false;
      const applyPromise = app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      }).then((response) => {
        applySettled = true;
        return response;
      });
      await waitForFileLockTicketCount(specQueue, specTicketsBeforeMutation + 2);
      expect(applySettled).toBe(false);

      releaseMutation();
      await expect(mutationPromise).resolves.toBe("updated");
      const response = await applyPromise;
      expect(response.statusCode, response.body).toBe(409);
      await expect(snapshotApplyState({
        store,
        repository,
        auditLog,
        caseId
      })).resolves.toEqual(snapshotBeforeMutation);
    } finally {
      releaseMutation();
      specScopeSpy?.mockRestore();
      await app.close();
      await persistedOffer.app.close();
    }
  });

  it("fails closed when the linked Intake context is fully archived before Apply", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const intakeRecords = new IntakeStoreRecordsPort(intakeStore);
    const { draft, persistedOffer } = await buildCanonicalApplyFixture(
      dataRoot,
      "production-draft-apply-archived-intake"
    );
    const app = buildProductionApp({
      dataRoot,
      repository,
      store,
      auditLog,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => persistedOffer.store.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
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
      const sourceReference = persistedOffer.handoff.eventSpecSnapshot.sourceLineage[0]?.reference;
      expect(sourceReference).toBeTruthy();
      await intakeStore.saveRequest(
        { businessId: "local" },
        createEventRequestFromText({
          requestId: sourceReference!,
          channel: "text",
          rawText: "Archivierter Testkontext für den Apply-Spec-Fence."
        })
      );
      const archived = await intakeStore.archiveRequestContext(
        { businessId: "local" },
        {
          requestId: sourceReference!,
          reasonCode: "operator_rehearsal_cleanup",
          archivedAt: "2026-08-31T12:00:00.000Z",
          archivedBy: "Gate-C-Test"
        }
      );
      expect(archived.specs.map((spec) => spec.specId)).toContain(
        persistedOffer.handoff.eventSpecSnapshot.specId
      );
      await expect(intakeStore.getSpec(
        { businessId: "local" },
        persistedOffer.handoff.eventSpecSnapshot.specId
      )).resolves.toMatchObject({ operationalArchive: { status: "archived" } });

      const before = await snapshotApplyState({ store, repository, auditLog, caseId: (await store.findCaseIdForArtifact(
        { businessId: "local" },
        draft.draftId
      ))! });
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: trustedProductionHeaders
      });

      expect(response.statusCode, response.body).toBe(409);
      await expect(snapshotApplyState({ store, repository, auditLog, caseId: before.currentCase!.caseId }))
        .resolves.toEqual(before);
    } finally {
      await app.close();
      await persistedOffer.app.close();
    }
  });
});
