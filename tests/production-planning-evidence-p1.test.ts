import { describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildProductionApp,
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  ProductionStore,
  RecipeDiscoveryService,
  productionDecisionRepositoryFor
} from "@catering/production-service";
import {
  createEventRequestFromText,
  createApprovalRequestRecord,
  createApprovedProductionSpec,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  validateProductionDraft,
  type AcceptedEventSpec,
  type LlmReadinessModelInput,
  type LlmReadinessProviderAdapter,
  type ProductionHandoff,
  type ProductionDraft,
  type Recipe
} from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { HttpSourceDocumentMetadataReader } from "../offer-service/src/gateways/http-source-document-metadata-reader.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { HttpIntakeRecordsPort } from "../production-service/src/gateways/http-intake-records-port.js";

const actorHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": "planning-evidence-p1-test-secret"
};

function eventSpec(): AcceptedEventSpec {
  const normalized = normalizeEventRequestToSpec(
    createEventRequestFromText({
      requestId: "planning-evidence-p1-request",
      channel: "text",
      rawText: "Lunch am 2026-09-22 für 60 Personen mit Caesar Salad."
    })
  );

  return {
    ...normalized,
    specId: "spec-planning-evidence-p1",
    budgetContext: {
      pricingSummary: {
        subtotal: { amount: 100, currency: "EUR" },
        perPerson: { amount: 1.67, currency: "EUR" }
      }
    },
    menuPlan: normalized.menuPlan.map((component) => ({
      ...component,
      componentId: "component-caesar-salad",
      label: "Caesar Salad",
      menuCategory: "classic" as const,
      servings: 60,
      recipeOverrideId: "recipe-caesar-salad",
      productionDecision: { mode: "scratch" as const }
    }))
  };
}

function purchaseEventSpec(): AcceptedEventSpec {
  const spec = eventSpec();
  return {
    ...spec,
    menuPlan: spec.menuPlan.map((component) => ({
      ...component,
      recipeOverrideId: undefined,
      productionDecision: {
        mode: "convenience_purchase" as const,
        purchasedElements: [component.label]
      }
    }))
  };
}

function recipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-caesar-salad",
    name: "Caesar Salad",
    source: {
      tier: "digitized_cookbook",
      originType: "cookbook",
      reference: "synthetic:caesar-salad",
      retrievedAt: "2026-08-20T10:00:00.000Z",
      approvalState: "review_required",
      qualityScore: 0.9,
      fitScore: 0.9,
      extractionCompleteness: 1
    },
    baseYield: { servings: 10, unit: "servings" },
    ingredients: [{
      ingredientId: "lettuce",
      name: "Salat",
      quantity: { amount: 1, unit: "kg" },
      group: "produce",
      normalizedUnit: "kg"
    }],
    steps: [{ index: 1, instruction: "Salat waschen, schneiden und anrichten." }],
    scalingRules: { defaultLossFactor: 1 },
    allergens: ["ei", "milch"],
    dietTags: []
  };
}

function planningEvidence(spec: AcceptedEventSpec, includeRecipeReview = true) {
  const component = spec.menuPlan[0]!;
  return {
    componentId: component.componentId,
    recipeId: "recipe-caesar-salad",
    quantityDecision: {
      decisionId: "quantity-planning-evidence-p1",
      eventSpecId: spec.specId,
      componentId: component.componentId,
      guestCount: 60,
      serviceFormat: "lunch",
      dishRole: "other" as const,
      basis: "servings_per_person" as const,
      perUnitAmount: 1,
      perUnitUnit: "servings",
      targetAmount: 60,
      targetUnit: "servings",
      rationale: "Explizite menschliche Mengenentscheidung für diesen Event.",
      evidence: { kind: "operator_instruction" as const, reference: "operator:goldlauf-2" },
      reviewStatus: "approved" as const
    },
    ...(includeRecipeReview
      ? {
        recipeEventUseReview: {
          eventSpecId: spec.specId,
          recipeId: "recipe-caesar-salad",
          reviewedBy: "Produktions-Mitarbeiter",
          reviewedAt: "2026-08-20T10:05:00.000Z",
          decision: "accepted_for_event" as const,
          confirmations: {
            quantitiesAndYield: true,
            methodAndEquipment: true,
            allergensAndDiet: true,
            holdingAndRegeneration: true
          }
        }
      }
      : {})
  };
}

function planningEvidenceWithReviewedOutputMapping(spec: AcceptedEventSpec) {
  const evidence = planningEvidence(spec);
  return {
    ...evidence,
    quantityDecision: {
      ...evidence.quantityDecision,
      basis: "per_person_weight" as const,
      perUnitAmount: 0.1,
      perUnitUnit: "kg",
      targetAmount: 6,
      targetUnit: "kg"
    },
    outputMapping: {
      recipeId: "recipe-caesar-salad",
      outputAmount: 1,
      outputUnit: "kg",
      recipeServings: 10,
      reviewedBy: "Produktions-Mitarbeiter",
      reviewedAt: "2026-08-20T10:06:00.000Z"
    }
  };
}

function handoffFor(spec: AcceptedEventSpec): ProductionHandoff {
  return {
    schemaVersion: "1.0",
    businessId: "local",
    handoffId: "handoff-planning-evidence-p1",
    approvedOfferId: "approved-offer-planning-evidence-p1",
    approvalRequestId: "approval-planning-evidence-p1",
    createdAt: "2026-08-20T10:00:00.000Z",
    eventSpecSnapshot: structuredClone({
      ...spec,
      lifecycle: { commercialState: "accepted" as const }
    }),
    pricingSnapshot: {
      subtotal: { amount: 100, currency: "EUR" },
      perPerson: { amount: 1.67, currency: "EUR" }
    },
    source: {
      draftId: "offer-draft-planning-evidence-p1",
      revision: 1,
      selectedVariantId: "variant-planning-evidence-p1"
    }
  };
}

async function productionFixture(
  inputSpec: AcceptedEventSpec = eventSpec(),
  appOptions: Parameters<typeof buildProductionApp>[0] = {}
): Promise<{
  app: ReturnType<typeof buildProductionApp>;
  store: ProductionStore;
  repository: InMemoryRecipeRepository;
  discoveryService: RecipeDiscoveryService;
  draft: ProductionDraft;
  spec: AcceptedEventSpec;
  caseId: string;
}> {
  const spec = structuredClone(inputSpec);
  const dataRoot = path.join(tmpdir(), `catering-planning-evidence-p1-${randomUUID()}`);
  const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
  await repository.save({ businessId: "local" }, recipe());
  const store = new ProductionStore({ rootDir: dataRoot });
  const discoveryService = new RecipeDiscoveryService(repository, { searchRecipes: async () => [] });
  const handoff = handoffFor(spec);
  const app = buildProductionApp({
    ...appOptions,
    repository,
    store,
    discoveryService,
    dataRoot,
    trustedActorSecret: actorHeaders["x-catering-trusted-secret"],
    handoffReader: {
      get: async (_context, handoffId) => handoffId === handoff.handoffId ? handoff : undefined
    },
    env: { ...appOptions.env }
  });
  const productionCase = await app.inject({
    method: "POST",
    url: `/v1/production/cases/from-handoff/${handoff.handoffId}`,
    headers: actorHeaders,
    payload: {}
  });
  expect(productionCase.statusCode).toBe(201);
  const caseId = productionCase.json<{ case: { caseId: string } }>().case.caseId;
  const draftResponse = await app.inject({
    method: "POST",
    url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
    headers: actorHeaders,
    payload: { caseId }
  });
  expect(draftResponse.statusCode).toBe(201);
  const draft = draftResponse.json<{ draft: ProductionDraft }>().draft;

  // The fixture uses the same handoff-backed case and draft routes as server.ts.
  return { app, store, repository, discoveryService, draft, spec, caseId };
}

function syntheticRevisionAppOptions(prefix: string): Parameters<typeof buildProductionApp>[0] {
  const approvalPath = path.join(tmpdir(), `catering-planning-evidence-${prefix}-approval-${randomUUID()}.json`);
  const revisionAdapter: LlmReadinessProviderAdapter = {
    adapterId: `planning-evidence-${prefix}`,
    adapterMode: "synthetic_live",
    async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
      return {
        ok: true,
        errors: [],
        adapterId: `planning-evidence-${prefix}`,
        adapterMode: "synthetic_live" as const,
        providerId: `planning-evidence-${prefix}-provider`,
        providerRequestId: `planning-evidence-${prefix}-request`,
        promptSchemaId: request.promptSchemaId,
        outputCandidate: {
          contractVersion: "llm-readiness-v0" as const,
          outputId: `planning-evidence-${prefix}-output`,
          kind: "production_draft_extraction" as const,
          sourceRefs: request.input.sourceRefs,
          humanApprovalRequired: true as const,
          writesProductObject: false as const,
          text: JSON.stringify({
            eventType: "lunch",
            serviceForm: "buffet",
            eventDate: "2026-09-22",
            attendeeCount: 60,
            components: [{ label: "Caesar Salad", course: "main" }],
            openQuestions: []
          })
        }
      };
    }
  };
  writeFileSync(approvalPath, JSON.stringify({
    approvalId: `planning-evidence-${prefix}-approval`,
    businessId: "local",
    providerKind: "openai",
    allowedDataClasses: ["personal_confidential"],
    allowedPurposes: ["production_draft_revision"],
    allowedModels: [`planning-evidence-${prefix}-model`],
    allowedCapabilities: ["structured_output"],
    allowedRegions: ["local"],
    allowedEndpoints: ["https://fixture.invalid"],
    maxCostEurPerCall: 0,
    retentionPolicy: "local-only",
    trainingUse: "contractually_excluded",
    legalBasisReference: "synthetic-race-test",
    approvedBy: "synthetic-test-actor",
    approvedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z"
  }), { mode: 0o600 });
  return {
    llmAdapter: revisionAdapter,
    llmProviderDescriptor: {
      providerKind: "openai",
      dataLeavesInstallation: true,
      providerModel: `planning-evidence-${prefix}-model`,
      capability: "structured_output",
      actualRegion: "local",
      maximumEstimatedCostEur: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      endpoint: "https://fixture.invalid",
      metadataVerified: true
    },
    env: {
      CATERING_SYNTHETIC_LLM_SLICE: "1",
      CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
    }
  };
}

const trustedProductionActor = {
  name: "Produktions-Mitarbeiter",
  businessId: "local" as const,
  source: "trusted-proxy:x-catering-actor-name" as const,
  trusted: true as const
};

async function persistInsufficientApprovedAggregate(
  store: ProductionStore,
  draft: ProductionDraft,
  spec: AcceptedEventSpec
) {
  const canonicalSpec = draft.draftArtifacts.eventSpec ?? spec;
  const artifacts = await buildProductionArtifacts(
    canonicalSpec,
    new RecipeDiscoveryService(new InMemoryRecipeRepository(), { searchRecipes: async () => [] }),
    { context: { businessId: "local" } }
  );
  const sourceDraft: ProductionDraft = {
    ...structuredClone(draft),
    reviewCards: [
      ...structuredClone(draft.reviewCards),
      {
        cardId: "persisted-insufficient-plan",
        kind: "timeline" as const,
        title: "Produktionsplan",
        summary: "Insufficient plan fixture",
        decision: "fits",
        targetPath: "$.draftArtifacts.productionPlan",
        targetId: artifacts.productionPlan.planId,
        requiredApproval: true,
        decidedBy: trustedProductionActor.name,
        decidedAt: "2026-08-20T10:30:00.000Z"
      },
      {
        cardId: "persisted-insufficient-purchase",
        kind: "purchase_item" as const,
        title: "Einkauf",
        summary: "Insufficient purchase fixture",
        decision: "fits",
        targetPath: "$.draftArtifacts.purchaseList",
        targetId: artifacts.purchaseList.purchaseListId,
        requiredApproval: true,
        decidedBy: trustedProductionActor.name,
        decidedAt: "2026-08-20T10:30:00.000Z"
      }
    ].map((card) => ({
      ...card,
      decision: "fits" as const,
      decidedBy: trustedProductionActor.name,
      decidedAt: "2026-08-20T10:30:00.000Z"
    })),
    draftArtifacts: {
      ...structuredClone(draft.draftArtifacts),
      eventSpec: canonicalSpec,
      productionPlan: {
        ...artifacts.productionPlan,
        productionBatches: [],
        kitchenSheets: [],
        timeline: [],
        recipeSelections: [],
        readiness: { status: "insufficient", reasons: ["persisted planning evidence missing"] },
        blockingIssues: ["persisted planning evidence missing"]
      },
      purchaseList: artifacts.purchaseList,
      recipes: []
    }
  };
  await store.saveProductionDraft({ businessId: "local" }, sourceDraft);
  const caseId = await store.findCaseIdForArtifact({ businessId: "local" }, sourceDraft.draftId);
  if (caseId) {
    for (const card of sourceDraft.reviewCards) {
      await store.appendEvent({ businessId: "local" }, caseId, {
        at: card.decidedAt!,
        role: "user",
        kind: "review_decision",
        text: "Prüfpunkt als „Passt“ bewertet.",
        artifactId: sourceDraft.draftId
      }, `review:${sourceDraft.draftId}:${card.cardId}:${card.decidedAt}`);
    }
  }
  const target = {
    kind: "production_draft" as const,
    artifactId: sourceDraft.draftId,
    revision: sourceDraft.revision
  };
  const approval = createApprovalRequestRecord({
    actor: trustedProductionActor,
    role: "production_operator",
    target,
    decision: "approved",
    now: new Date("2026-08-20T10:30:00.000Z")
  });
  const decidedDraft: ProductionDraft = {
    ...sourceDraft,
    status: "approved",
    approvalRequestId: approval.approvalRequestId,
    approvedBy: approval.decidedBy.name,
    approvedAt: approval.decidedAt,
    reviewCards: sourceDraft.reviewCards.map((card) => ({
      ...card,
      decision: "fits" as const,
      decidedBy: trustedProductionActor.name,
      decidedAt: approval.decidedAt
    }))
  };
  const approvedProductionSpec = createApprovedProductionSpec({ draft: sourceDraft, approval });
  const aggregate = {
    schemaVersion: "1.0" as const,
    businessId: "local" as const,
    sourceDraft,
    approval,
    decidedDraft,
    approvedProductionSpec
  };
  await productionDecisionRepositoryFor(store).insertDecisionAggregate({ businessId: "local" }, aggregate);
  return { sourceDraft, approval, approvedProductionSpec, aggregate };
}

async function persistReadyApprovedAggregateWithoutOneReviewEvent(
  store: ProductionStore,
  draft: ProductionDraft,
  caseId: string
) {
  const decidedAt = "2026-08-20T10:30:00.000Z";
  const sourceDraft: ProductionDraft = {
    ...structuredClone(draft),
    reviewCards: draft.reviewCards.map((card) => ({
      ...card,
      decision: "fits" as const,
      decidedBy: trustedProductionActor.name,
      decidedAt
    })),
    draftArtifacts: {
      ...structuredClone(draft.draftArtifacts)
    }
  };
  await store.saveProductionDraft({ businessId: "local" }, sourceDraft);
  const persistedSourceDraft = await store.getProductionDraft({ businessId: "local" }, sourceDraft.draftId);
  if (!persistedSourceDraft) throw new Error("Apply-Review-Projection-Fixture konnte den Quelldraft nicht lesen.");
  const missingCard = persistedSourceDraft.reviewCards.at(-1)!;
  for (const card of persistedSourceDraft.reviewCards.slice(0, -1)) {
    await store.appendEvent({ businessId: "local" }, caseId, {
      at: card.decidedAt!,
      role: "user",
      kind: "review_decision",
      text: "Prüfpunkt als „Passt“ bewertet.",
      artifactId: persistedSourceDraft.draftId
    }, `review:${persistedSourceDraft.draftId}:${card.cardId}:${card.decidedAt}`);
  }
  const target = {
    kind: "production_draft" as const,
    artifactId: persistedSourceDraft.draftId,
    revision: persistedSourceDraft.revision
  };
  const approval = createApprovalRequestRecord({
    actor: trustedProductionActor,
    role: "production_operator",
    target,
    decision: "approved",
    now: new Date(decidedAt)
  });
  const decidedDraft: ProductionDraft = {
    ...persistedSourceDraft,
    status: "approved",
    approvalRequestId: approval.approvalRequestId,
    approvedBy: approval.decidedBy.name,
    approvedAt: approval.decidedAt
  };
  const approvedProductionSpec = createApprovedProductionSpec({ draft: persistedSourceDraft, approval });
  const aggregate = {
    schemaVersion: "1.0" as const,
    businessId: "local" as const,
    sourceDraft: persistedSourceDraft,
    approval,
    decidedDraft,
    approvedProductionSpec
  };
  await productionDecisionRepositoryFor(store).insertDecisionAggregate({ businessId: "local" }, aggregate);
  await store.insertApproval({ businessId: "local" }, approval);
  await store.saveProductionDraft({ businessId: "local" }, decidedDraft);
  await store.insertApprovedProductionSpec({ businessId: "local" }, approvedProductionSpec);
  const currentCase = await store.getCase({ businessId: "local" }, caseId);
  if (!currentCase) throw new Error("Apply-Review-Projection-Fixture benötigt einen ProductionCase.");
  const caseUpdate = await store.updateCase({ businessId: "local" }, caseId, currentCase.version, {
    ...currentCase,
    approvedProductionSpecId: approvedProductionSpec.approvedProductionSpecId,
    version: currentCase.version + 1,
    updatedAt: decidedAt
  });
  if (caseUpdate !== "updated") throw new Error("Apply-Review-Projection-Fixture konnte den Case nicht freigeben.");
  await store.appendEvent({ businessId: "local" }, caseId, {
    at: decidedAt,
    role: "system",
    kind: "approval",
    text: "Produktionssnapshot freigegeben.",
    artifactId: approvedProductionSpec.approvedProductionSpecId
  });
  return { sourceDraft: persistedSourceDraft, decidedDraft, approvedProductionSpec, missingCard };
}

describe("persisted production planning evidence", () => {
  it("consumes an explicitly submitted human bridge and event review before Prepare", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });

      expect(response.statusCode).toBe(201);
      const prepared = response.json<{ draft: ProductionDraft }>().draft;
      expect(prepared.draftArtifacts.productionPlan?.productionBatches).toHaveLength(1);
      expect(prepared.draftArtifacts.productionPlan?.productionBatches[0]?.recipeId).toBe("recipe-caesar-salad");
      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(retry.statusCode).toBe(201);
      expect(retry.json<{ draft: ProductionDraft }>().draft.draftId).toBe(prepared.draftId);
      const evidenceStore = store as ProductionStore & {
        listProductionPlanningEvidence?: (...args: any[]) => Promise<unknown[]>;
      };
      expect(await evidenceStore.listProductionPlanningEvidence?.({ businessId: "local" }, draft.draftId, draft.revision) ?? []).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("rejects a bridge submission without an exact human RecipeEventUseReview", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec, false) }
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().message).toContain("RecipeEventUseReview");
      const evidenceStore = store as ProductionStore & {
        listProductionPlanningEvidence?: (...args: any[]) => Promise<unknown[]>;
      };
      expect(await evidenceStore.listProductionPlanningEvidence?.({ businessId: "local" }, draft.draftId, draft.revision) ?? []).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("persists reviewed output mapping and re-materializes its serving bridge", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidenceWithReviewedOutputMapping(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);
      const persistedEvidence = await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision);
      expect(persistedEvidence[0]?.outputMapping).toMatchObject({ outputAmount: 1, outputUnit: "kg", recipeServings: 10 });

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(201);
      expect(prepared.json<{ draft: ProductionDraft }>().draft.draftArtifacts.productionPlan?.productionBatches[0]?.scaledYield)
        .toEqual({ amount: 60, unit: "servings" });
    } finally {
      await app.close();
    }
  });

  it("rejects output mapping provenance from a different reviewer", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const evidence = planningEvidenceWithReviewedOutputMapping(spec);
      evidence.outputMapping.reviewedBy = "untrusted-fixture-actor";
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...evidence }
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().message).toContain("outputMapping");
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("does not let a configured resolver replace missing persisted planning evidence", async () => {
    const { app, store, draft, repository } = await productionFixture();
    try {
      await repository.save({ businessId: "local" }, {
        ...recipe(),
        source: {
          ...recipe().source,
          tier: "internal_verified",
          originType: "internal_db",
          approvalState: "approved_internal"
        },
        knowledge: {
          artifactKind: "transcribed_recipe",
          sourceCitation: { title: "Synthetic kitchen reference" },
          derivation: { method: "direct_transcription" },
          production: { prepLeadMinutes: 20, holdMinutes: 15 },
          verification: {
            sourceStatus: "verified",
            allergenStatus: "verified",
            productionStatus: "verified",
            verifiedBy: "Produktions-Mitarbeiter",
            verifiedAt: "2026-08-20T10:00:00.000Z"
          },
          version: { revision: 1 }
        }
      });
      app.setQuantityRecipeBridgeResolver(({ eventSpec, component, recipe, servings }) => ({
        status: "ready_for_scaling",
        eventSpecId: eventSpec.specId,
        componentId: component.componentId,
        recipeId: recipe.recipeId,
        targetOutput: { amount: servings, unit: "servings" },
        targetServings: servings,
        conversionMethod: "direct_servings",
        issues: []
      }));

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect(prepared.json().message).toContain("Planungs-Evidenz");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(1);
    } finally {
      app.setQuantityRecipeBridgeResolver(undefined);
      await app.close();
    }
  });

  it("keeps the resolver contract for noncanonical manual drafts", async () => {
    const { app, store, repository, draft } = await productionFixture();
    try {
      const trustedRecipe = {
        ...recipe(),
        source: {
          ...recipe().source,
          tier: "internal_verified" as const,
          originType: "internal_db" as const,
          approvalState: "approved_internal" as const
        },
        knowledge: {
          artifactKind: "transcribed_recipe" as const,
          sourceCitation: { title: "Synthetic kitchen reference" },
          derivation: { method: "direct_transcription" as const },
          production: { prepLeadMinutes: 20, holdMinutes: 15 },
          verification: {
            sourceStatus: "verified" as const,
            allergenStatus: "verified" as const,
            productionStatus: "verified" as const,
            verifiedBy: "Produktions-Mitarbeiter",
            verifiedAt: "2026-08-20T10:00:00.000Z"
          },
          version: { revision: 1 }
        }
      };
      await repository.save({ businessId: "local" }, trustedRecipe);
      const manualDraft = structuredClone(draft);
      manualDraft.source = {
        ...manualDraft.source,
        sourceRef: "manual-import:planning-evidence-p1"
      };
      await store.saveProductionDraft({ businessId: "local" }, manualDraft);
      app.setQuantityRecipeBridgeResolver(({ eventSpec: resolvedSpec, component, recipe: resolvedRecipe, servings }) => ({
        status: "ready_for_scaling",
        eventSpecId: resolvedSpec.specId,
        componentId: component.componentId,
        recipeId: resolvedRecipe.recipeId,
        targetOutput: { amount: servings, unit: "servings" },
        targetServings: servings,
        conversionMethod: "direct_servings",
        issues: []
      }));
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${manualDraft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(201);
      const preparedDraft = prepared.json<{ draft: ProductionDraft }>().draft;
      expect(preparedDraft.draftArtifacts.productionPlan?.readiness).toMatchObject({ status: "complete" });
      expect(preparedDraft.draftArtifacts.productionPlan?.productionBatches).toHaveLength(1);
      expect(preparedDraft.draftArtifacts.productionPlan?.readiness.status).toBe("complete");
    } finally {
      app.setQuantityRecipeBridgeResolver(undefined);
      await app.close();
    }
  });

  it("keeps canonical Handoff provenance across revisions", async () => {
    const approvalPath = path.join(tmpdir(), `catering-planning-evidence-provenance-approval-${randomUUID()}.json`);
    const revisionAdapter: LlmReadinessProviderAdapter = {
      adapterId: "planning-evidence-provenance-revision",
      adapterMode: "synthetic_live",
      async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
        return {
          ok: true,
          errors: [],
          adapterId: "planning-evidence-provenance-revision",
          adapterMode: "synthetic_live" as const,
          providerId: "planning-evidence-provenance-provider",
          providerRequestId: "planning-evidence-provenance-request",
          promptSchemaId: request.promptSchemaId,
          outputCandidate: {
            contractVersion: "llm-readiness-v0" as const,
            outputId: "planning-evidence-provenance-output",
            kind: "production_draft_extraction" as const,
            sourceRefs: request.input.sourceRefs,
            humanApprovalRequired: true as const,
            writesProductObject: false as const,
            text: JSON.stringify({
              eventType: "lunch",
              serviceForm: "buffet",
              eventDate: "2026-09-22",
              attendeeCount: 60,
              components: [{ label: "Caesar Salad", course: "main" }],
              openQuestions: []
            })
          }
        };
      }
    };
    writeFileSync(approvalPath, JSON.stringify({
      approvalId: "planning-evidence-provenance-approval",
      businessId: "local",
      providerKind: "openai",
      allowedDataClasses: ["personal_confidential"],
      allowedPurposes: ["production_draft_revision"],
      allowedModels: ["planning-evidence-provenance-model"],
      allowedCapabilities: ["structured_output"],
      allowedRegions: ["local"],
      allowedEndpoints: ["https://fixture.invalid"],
      maxCostEurPerCall: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      legalBasisReference: "synthetic-provenance-test",
      approvedBy: "synthetic-test-actor",
      approvedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    }), { mode: 0o600 });
    const { app, store, repository, draft } = await productionFixture(eventSpec(), {
      llmAdapter: revisionAdapter,
      llmProviderDescriptor: {
        providerKind: "openai",
        dataLeavesInstallation: true,
        providerModel: "planning-evidence-provenance-model",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "https://fixture.invalid",
        metadataVerified: true
      },
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
      }
    });
    try {
      const review = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/card-event-handoff`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten fuer die Revision korrigieren." }
      });
      expect(review.statusCode).toBe(200);
      const revision = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      });
      expect(revision.statusCode).toBe(201);
      const revisedDraft = revision.json<{ draft: ProductionDraft }>().draft;
      expect(revisedDraft.supersedesDraftId).toBe(draft.draftId);
      expect(revisedDraft.revision).toBe(draft.revision + 1);
      expect(revisedDraft.source.sourceRef).toBe(draft.source.sourceRef);

      const trustedRecipe = {
        ...recipe(),
        source: {
          ...recipe().source,
          tier: "internal_verified" as const,
          originType: "internal_db" as const,
          approvalState: "approved_internal" as const
        },
        knowledge: {
          artifactKind: "transcribed_recipe" as const,
          sourceCitation: { title: "Synthetic kitchen reference" },
          derivation: { method: "direct_transcription" as const },
          production: { prepLeadMinutes: 20, holdMinutes: 15 },
          verification: {
            sourceStatus: "verified" as const,
            allergenStatus: "verified" as const,
            productionStatus: "verified" as const,
            verifiedBy: "Produktions-Mitarbeiter",
            verifiedAt: "2026-08-20T10:00:00.000Z"
          },
          version: { revision: 1 }
        }
      };
      await repository.save({ businessId: "local" }, trustedRecipe);
      await store.saveProductionDraft({
        businessId: "local"
      }, {
        ...revisedDraft,
        source: {
          ...revisedDraft.source,
          sourceRef: "upload:tampered-revision-source"
        }
      });
      app.setQuantityRecipeBridgeResolver(({ eventSpec: resolvedSpec, component, recipe: resolvedRecipe, servings }) => ({
        status: "ready_for_scaling",
        eventSpecId: resolvedSpec.specId,
        componentId: component.componentId,
        recipeId: resolvedRecipe.recipeId,
        targetOutput: { amount: servings, unit: "servings" },
        targetServings: servings,
        conversionMethod: "direct_servings",
        issues: []
      }));
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${revisedDraft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect((await store.listProductionDrafts({ businessId: "local" }))
        .filter((candidate) => candidate.supersedesDraftId === revisedDraft.draftId)).toHaveLength(0);
    } finally {
      app.setQuantityRecipeBridgeResolver(undefined);
      await app.close();
    }
  });

  it("requires evidence for canonical scratch components even without a recipe override", async () => {
    const spec = eventSpec();
    spec.menuPlan = spec.menuPlan.map((component) => ({
      ...component,
      recipeOverrideId: undefined
    }));
    const { app, store, draft } = await productionFixture(spec);
    try {
      app.setQuantityRecipeBridgeResolver(({ eventSpec: resolvedSpec, component, recipe: resolvedRecipe, servings }) => ({
        status: "ready_for_scaling",
        eventSpecId: resolvedSpec.specId,
        componentId: component.componentId,
        recipeId: resolvedRecipe.recipeId,
        targetOutput: { amount: servings, unit: "servings" },
        targetServings: servings,
        conversionMethod: "direct_servings",
        issues: []
      }));
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect(prepared.json().message).toContain("Planungs-Evidenz");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(1);
    } finally {
      app.setQuantityRecipeBridgeResolver(undefined);
      await app.close();
    }
  });

  it("does not recover a resolver-built prepared snapshot without persisted evidence", async () => {
    const { app, store, repository, discoveryService, draft, spec } = await productionFixture();
    try {
      const trustedRecipe = {
        ...recipe(),
        source: {
          ...recipe().source,
          tier: "internal_verified" as const,
          originType: "internal_db" as const,
          approvalState: "approved_internal" as const
        },
        knowledge: {
          artifactKind: "transcribed_recipe" as const,
          sourceCitation: { title: "Synthetic kitchen reference" },
          derivation: { method: "direct_transcription" as const },
          production: { prepLeadMinutes: 20, holdMinutes: 15 },
          verification: {
            sourceStatus: "verified" as const,
            allergenStatus: "verified" as const,
            productionStatus: "verified" as const,
            verifiedBy: "Produktions-Mitarbeiter",
            verifiedAt: "2026-08-20T10:00:00.000Z"
          },
          version: { revision: 1 }
        }
      };
      await repository.save({ businessId: "local" }, trustedRecipe);
      app.setQuantityRecipeBridgeResolver(({ eventSpec, component, recipe: resolvedRecipe, servings }) => ({
        status: "ready_for_scaling",
        eventSpecId: eventSpec.specId,
        componentId: component.componentId,
        recipeId: resolvedRecipe.recipeId,
        targetOutput: { amount: servings, unit: "servings" },
        targetServings: servings,
        conversionMethod: "direct_servings",
        issues: []
      }));
      const artifacts = await buildProductionArtifacts(spec, discoveryService, {
        context: { businessId: "local" },
        allowQuantityRecipeBridgeResolver: true,
        recipeEventUseReviews: {
          [spec.menuPlan[0]!.componentId]: planningEvidence(spec).recipeEventUseReview!
        }
      });
      expect(artifacts.productionPlan.productionBatches).toHaveLength(1);
      const preparedDraftId = `production-draft-prepared-${createHash("sha256")
        .update(`local\0${draft.draftId}\0${draft.revision}\0prepare`)
        .digest("hex")}`;
      const preparedDraft: ProductionDraft = {
        ...structuredClone(draft),
        draftId: preparedDraftId,
        revision: draft.revision + 1,
        status: "pending_review",
        createdAt: "2026-08-20T10:20:00.000Z",
        supersedesDraftId: draft.draftId,
        approvalRequestId: undefined,
        approvedBy: undefined,
        approvedAt: undefined,
        reviewCards: [
          ...structuredClone(draft.reviewCards),
          {
            cardId: "resolver-prepared-plan",
            kind: "timeline" as const,
            title: "Produktionsplan",
            summary: "Resolver snapshot plan",
            decision: "pending" as const,
            targetPath: "$.draftArtifacts.productionPlan",
            targetId: artifacts.productionPlan.planId,
            requiredApproval: true
          },
          {
            cardId: "resolver-prepared-purchase",
            kind: "purchase_item" as const,
            title: "Einkauf",
            summary: "Resolver snapshot purchase",
            decision: "pending" as const,
            targetPath: "$.draftArtifacts.purchaseList",
            targetId: artifacts.purchaseList.purchaseListId,
            requiredApproval: true
          },
          ...artifacts.recipes.map((resolvedRecipe, index) => ({
            cardId: `resolver-prepared-recipe-${index + 1}`,
            kind: "recipe" as const,
            title: resolvedRecipe.name,
            summary: "Resolver snapshot recipe",
            decision: "pending" as const,
            targetPath: `$.draftArtifacts.recipes[${index}]`,
            targetId: resolvedRecipe.recipeId,
            requiredApproval: true
          }))
        ],
        draftArtifacts: {
          ...structuredClone(draft.draftArtifacts),
          eventSpec: draft.draftArtifacts.eventSpec,
          productionPlan: artifacts.productionPlan,
          purchaseList: artifacts.purchaseList,
          recipes: artifacts.recipes
        }
      };
      expect(await store.insertProductionDraft({ businessId: "local" }, preparedDraft)).toBe("created");

      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(retry.statusCode).toBe(409);
      expect(retry.json().message).toContain("Planungs-Evidenz");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(2);
    } finally {
      app.setQuantityRecipeBridgeResolver(undefined);
      await app.close();
    }
  });

  it("rejects a recipe snapshot that drifts between evidence read and prepared materialization", async () => {
    const { app, store, draft, spec, caseId, repository } = await productionFixture();
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(201);

      const originalGet = repository.get.bind(repository);
      let armed = false;
      let prepareReads = 0;
      repository.get = async (context, recipeId) => {
        const current = await originalGet(context, recipeId);
        if (armed && recipeId === "recipe-caesar-salad") {
          prepareReads += 1;
          if (prepareReads === 2 && current) {
            await repository.save(context, {
              ...current,
              ingredients: [{
                ...current.ingredients[0]!,
                quantity: { amount: 2, unit: "kg" }
              }]
            });
            return originalGet(context, recipeId);
          }
        }
        return current;
      };
      armed = true;

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect(prepared.json().message).toContain("Rezept-Snapshot");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("rejects a case source drift between canonical preflight and prepared commit", async () => {
    const { app, store, repository, draft, spec, caseId } = await productionFixture();
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(201);

      const originalGet = repository.get.bind(repository);
      let recipeReads = 0;
      repository.get = async (context, recipeId) => {
        const current = await originalGet(context, recipeId);
        if (recipeId === "recipe-caesar-salad") {
          recipeReads += 1;
          if (recipeReads === 2) {
            expect(await store.advanceCaseSourceSpec(
              { businessId: "local" },
              caseId,
              spec.specId,
              "spec-planning-evidence-p1-drifted",
              "2026-08-20T10:30:00.000Z"
            )).toBe("advanced");
          }
        }
        return current;
      };

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect(prepared.json().message).toContain("verändert");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("publishes a canonical revision event with the draft mutation", async () => {
    const approvalPath = path.join(tmpdir(), `catering-planning-evidence-race-approval-${randomUUID()}.json`);
    const revisionAdapter: LlmReadinessProviderAdapter = {
      adapterId: "planning-evidence-revision-race",
      adapterMode: "synthetic_live" as const,
      async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
        return {
          ok: true,
          errors: [],
          adapterId: "planning-evidence-revision-race",
          adapterMode: "synthetic_live" as const,
          providerId: "planning-evidence-race-provider",
          providerRequestId: "planning-evidence-race-request",
          promptSchemaId: request.promptSchemaId,
          outputCandidate: {
            contractVersion: "llm-readiness-v0" as const,
            outputId: "planning-evidence-revision-race-output",
            kind: "production_draft_extraction" as const,
            sourceRefs: request.input.sourceRefs,
            humanApprovalRequired: true as const,
            writesProductObject: false as const,
            text: JSON.stringify({
              eventType: "lunch",
              serviceForm: "buffet",
              eventDate: "2026-09-22",
              attendeeCount: 60,
              components: [{ label: "Caesar Salad", course: "main" }],
              openQuestions: []
            })
          }
        };
      }
    };
    writeFileSync(approvalPath, JSON.stringify({
      approvalId: "planning-evidence-revision-race-approval",
      businessId: "local",
      providerKind: "openai",
      allowedDataClasses: ["personal_confidential"],
      allowedPurposes: ["production_draft_revision"],
      allowedModels: ["planning-evidence-revision-race-model"],
      allowedCapabilities: ["structured_output"],
      allowedRegions: ["local"],
      allowedEndpoints: ["https://fixture.invalid"],
      maxCostEurPerCall: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      legalBasisReference: "synthetic-race-test",
      approvedBy: "synthetic-test-actor",
      approvedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    }), { mode: 0o600 });
    const { app, store, draft, spec, caseId } = await productionFixture(eventSpec(), {
      llmAdapter: revisionAdapter,
      llmProviderDescriptor: {
        providerKind: "openai",
        dataLeavesInstallation: true,
        providerModel: "planning-evidence-revision-race-model",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "https://fixture.invalid",
        metadataVerified: true
      },
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
      }
    });
    try {
      const review = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/card-event-handoff`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten fuer die Revision korrigieren." }
      });
      expect(review.statusCode).toBe(200);

      const revision = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      });
      const persistedRevision = (await store.listProductionDrafts({ businessId: "local" }))
        .find((candidate) => candidate.supersedesDraftId === draft.draftId);
      expect(revision.statusCode).toBe(201);
      expect(persistedRevision).toMatchObject({
        revision: draft.revision + 1,
        status: "pending_review",
        supersedesDraftId: draft.draftId
      });
      expect((await store.getProductionDraft({ businessId: "local" }, draft.draftId))?.status).toBe("superseded");
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(1);

      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(409);
      expect(evidence.json().message).toMatch(/offenen ProductionDraft|aktuellen Produktionsrevision/);
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(0);
    } finally {
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("holds the case lock while a revision event is published before evidence can start", async () => {
    const approvalPath = path.join(tmpdir(), `catering-planning-evidence-revision-first-approval-${randomUUID()}.json`);
    const revisionAdapter: LlmReadinessProviderAdapter = {
      adapterId: "planning-evidence-revision-first",
      adapterMode: "synthetic_live",
      async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
        return {
          ok: true,
          errors: [],
          adapterId: "planning-evidence-revision-first",
          adapterMode: "synthetic_live" as const,
          providerId: "planning-evidence-revision-first-provider",
          providerRequestId: "planning-evidence-revision-first-request",
          promptSchemaId: request.promptSchemaId,
          outputCandidate: {
            contractVersion: "llm-readiness-v0" as const,
            outputId: "planning-evidence-revision-first-output",
            kind: "production_draft_extraction" as const,
            sourceRefs: request.input.sourceRefs,
            humanApprovalRequired: true as const,
            writesProductObject: false as const,
            text: JSON.stringify({
              eventType: "lunch",
              serviceForm: "buffet",
              eventDate: "2026-09-22",
              attendeeCount: 60,
              components: [{ label: "Caesar Salad", course: "main" }],
              openQuestions: []
            })
          }
        };
      }
    };
    writeFileSync(approvalPath, JSON.stringify({
      approvalId: "planning-evidence-revision-first-approval",
      businessId: "local",
      providerKind: "openai",
      allowedDataClasses: ["personal_confidential"],
      allowedPurposes: ["production_draft_revision"],
      allowedModels: ["planning-evidence-revision-first-model"],
      allowedCapabilities: ["structured_output"],
      allowedRegions: ["local"],
      allowedEndpoints: ["https://fixture.invalid"],
      maxCostEurPerCall: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      legalBasisReference: "synthetic-race-test",
      approvedBy: "synthetic-test-actor",
      approvedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    }), { mode: 0o600 });
    const { app, store, draft, spec, caseId } = await productionFixture(eventSpec(), {
      llmAdapter: revisionAdapter,
      llmProviderDescriptor: {
        providerKind: "openai",
        dataLeavesInstallation: true,
        providerModel: "planning-evidence-revision-first-model",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "https://fixture.invalid",
        metadataVerified: true
      },
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
      }
    });
    let releaseEvent!: () => void;
    const eventReleased = new Promise<void>((resolve) => {
      releaseEvent = resolve;
    });
    let eventBarrierReached!: () => void;
    const eventBarrier = new Promise<void>((resolve) => {
      eventBarrierReached = resolve;
    });
    let revisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    let evidenceRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    try {
      const review = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/card-event-handoff`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten fuer die Revision korrigieren." }
      });
      expect(review.statusCode).toBe(200);

      const originalFailurePlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalFailurePlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            if (scopedDraftId !== draft.draftId) return operation(scope);
            const originalAppendRevisionEvent = scope.appendRevisionEvent;
            const wrappedScope = {
              ...scope,
              appendRevisionEvent: async (
                sourceDraft: ProductionDraft,
                revision: ProductionDraft,
                text: string
              ) => {
                eventBarrierReached();
                await eventReleased;
                return originalAppendRevisionEvent(sourceDraft, revision, text);
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );

      revisionRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      });
      await Promise.race([
        eventBarrier,
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Timed out waiting for revision event barrier")),
          5_000
        ))
      ]);

      let evidenceSettled = false;
      evidenceRequest = app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      }).then((response) => {
        evidenceSettled = true;
        return response;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(evidenceSettled).toBe(false);
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(0);

      releaseEvent();
      const revision = await revisionRequest;
      expect(revision.statusCode).toBe(201);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(1);

      const evidence = await evidenceRequest;
      expect(evidence.statusCode).toBe(409);
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(0);
    } finally {
      releaseEvent();
      await revisionRequest?.catch(() => undefined);
      await evidenceRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("linearizes initial prepare event publication before a descendant revision can commit", async () => {
    const approvalPath = path.join(tmpdir(), `catering-planning-evidence-initial-prepare-approval-${randomUUID()}.json`);
    const revisionAdapter: LlmReadinessProviderAdapter = {
      adapterId: "planning-evidence-initial-prepare",
      adapterMode: "synthetic_live",
      async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
        return {
          ok: true,
          errors: [],
          adapterId: "planning-evidence-initial-prepare",
          adapterMode: "synthetic_live" as const,
          providerId: "planning-evidence-initial-prepare-provider",
          providerRequestId: "planning-evidence-initial-prepare-request",
          promptSchemaId: request.promptSchemaId,
          outputCandidate: {
            contractVersion: "llm-readiness-v0" as const,
            outputId: "planning-evidence-initial-prepare-output",
            kind: "production_draft_extraction" as const,
            sourceRefs: request.input.sourceRefs,
            humanApprovalRequired: true as const,
            writesProductObject: false as const,
            text: JSON.stringify({
              eventType: "lunch",
              serviceForm: "buffet",
              eventDate: "2026-09-22",
              attendeeCount: 60,
              components: [{ label: "Caesar Salad", course: "main" }],
              openQuestions: []
            })
          }
        };
      }
    };
    writeFileSync(approvalPath, JSON.stringify({
      approvalId: "planning-evidence-initial-prepare-approval",
      businessId: "local",
      providerKind: "openai",
      allowedDataClasses: ["personal_confidential"],
      allowedPurposes: ["production_draft_revision"],
      allowedModels: ["planning-evidence-initial-prepare-model"],
      allowedCapabilities: ["structured_output"],
      allowedRegions: ["local"],
      allowedEndpoints: ["https://fixture.invalid"],
      maxCostEurPerCall: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      legalBasisReference: "synthetic-race-test",
      approvedBy: "synthetic-test-actor",
      approvedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    }), { mode: 0o600 });
    const { app, store, draft, spec, caseId } = await productionFixture(eventSpec(), {
      llmAdapter: revisionAdapter,
      llmProviderDescriptor: {
        providerKind: "openai",
        dataLeavesInstallation: true,
        providerModel: "planning-evidence-initial-prepare-model",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "https://fixture.invalid",
        metadataVerified: true
      },
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
      }
    });
    let releaseEvent!: () => void;
    const eventReleased = new Promise<void>((resolve) => {
      releaseEvent = resolve;
    });
    let eventBarrierReached!: () => void;
    const eventBarrier = new Promise<void>((resolve) => {
      eventBarrierReached = resolve;
    });
    let barrierReached = false;
    let prepareRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    let revisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);

      const originalAppendEventForArtifactCase = store.appendEventForArtifactCase.bind(store);
      vi.spyOn(store, "appendEventForArtifactCase").mockImplementation(
        async (context, artifactId, input, eventIdentity) => {
          if (input.kind === "revision_created" && !barrierReached) {
            barrierReached = true;
            eventBarrierReached();
            await eventReleased;
          }
          return originalAppendEventForArtifactCase(context, artifactId, input, eventIdentity);
        }
      );
      const recoveryBarrierPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => recoveryBarrierPlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            if (scopedDraftId !== draft.draftId) return operation(scope);
            const originalAppendRevisionEvent = scope.appendRevisionEvent;
            const wrappedScope = {
              ...scope,
              appendRevisionEvent: async (
                sourceDraft: ProductionDraft,
                revision: ProductionDraft,
                text: string
              ) => {
                if (!barrierReached) {
                  barrierReached = true;
                  eventBarrierReached();
                  await eventReleased;
                }
                return originalAppendRevisionEvent(sourceDraft, revision, text);
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );

      prepareRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      await Promise.race([
        eventBarrier,
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Timed out waiting for initial prepare event barrier")),
          5_000
        ))
      ]);

      const preparedDraft = (await store.listProductionDrafts({ businessId: "local" }))
        .find((candidate) => candidate.supersedesDraftId === draft.draftId);
      expect(preparedDraft).toBeDefined();
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(0);
      const reviewRequest = app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${preparedDraft!.draftId}/review-cards/card-prepared-event-spec`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten der Revision korrigieren." }
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect((await store.getProductionDraft({ businessId: "local" }, preparedDraft!.draftId))
        ?.reviewCards.some((card) => card.decision === "change_requested")).toBe(false);

      releaseEvent();
      const prepared = await prepareRequest;
      expect(prepared.statusCode).toBe(201);
      const review = await reviewRequest;
      expect(review.statusCode).toBe(200);
      revisionRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft!.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      });

      const revision = await revisionRequest;
      expect(revision.statusCode).toBe(201);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(2);
    } finally {
      releaseEvent();
      await prepareRequest?.catch(() => undefined);
      await revisionRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("binds a handoff draft and its draft-created event before revision can commit", async () => {
    const approvalPath = path.join(tmpdir(), `catering-planning-evidence-handoff-entry-approval-${randomUUID()}.json`);
    const revisionAdapter: LlmReadinessProviderAdapter = {
      adapterId: "planning-evidence-handoff-entry",
      adapterMode: "synthetic_live",
      async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
        return {
          ok: true,
          errors: [],
          adapterId: "planning-evidence-handoff-entry",
          adapterMode: "synthetic_live" as const,
          providerId: "planning-evidence-handoff-entry-provider",
          providerRequestId: "planning-evidence-handoff-entry-request",
          promptSchemaId: request.promptSchemaId,
          outputCandidate: {
            contractVersion: "llm-readiness-v0" as const,
            outputId: "planning-evidence-handoff-entry-output",
            kind: "production_draft_extraction" as const,
            sourceRefs: request.input.sourceRefs,
            humanApprovalRequired: true as const,
            writesProductObject: false as const,
            text: JSON.stringify({
              eventType: "lunch",
              serviceForm: "buffet",
              eventDate: "2026-09-22",
              attendeeCount: 60,
              components: [{ label: "Caesar Salad", course: "main" }],
              openQuestions: []
            })
          }
        };
      }
    };
    writeFileSync(approvalPath, JSON.stringify({
      approvalId: "planning-evidence-handoff-entry-approval",
      businessId: "local",
      providerKind: "openai",
      allowedDataClasses: ["personal_confidential"],
      allowedPurposes: ["production_draft_revision"],
      allowedModels: ["planning-evidence-handoff-entry-model"],
      allowedCapabilities: ["structured_output"],
      allowedRegions: ["local"],
      allowedEndpoints: ["https://fixture.invalid"],
      maxCostEurPerCall: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      legalBasisReference: "synthetic-race-test",
      approvedBy: "synthetic-test-actor",
      approvedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    }), { mode: 0o600 });
    const spec = eventSpec();
    const handoff = handoffFor(spec);
    const dataRoot = path.join(tmpdir(), `catering-planning-evidence-handoff-entry-${randomUUID()}`);
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    await repository.save({ businessId: "local" }, recipe());
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      repository,
      store,
      discoveryService: new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }),
      dataRoot,
      trustedActorSecret: actorHeaders["x-catering-trusted-secret"],
      handoffReader: {
        get: async (_context, handoffId) => handoffId === handoff.handoffId ? handoff : undefined
      },
      llmAdapter: revisionAdapter,
      llmProviderDescriptor: {
        providerKind: "openai",
        dataLeavesInstallation: true,
        providerModel: "planning-evidence-handoff-entry-model",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "https://fixture.invalid",
        metadataVerified: true
      },
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
      }
    });
    let releaseInsert!: () => void;
    const insertReleased = new Promise<void>((resolve) => {
      releaseInsert = resolve;
    });
    let insertBarrierReached!: () => void;
    const insertBarrier = new Promise<void>((resolve) => {
      insertBarrierReached = resolve;
    });
    let barrierReached = false;
    let draftRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    let revisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    try {
      const caseResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/from-handoff/${handoff.handoffId}`,
        headers: actorHeaders,
        payload: {}
      });
      expect(caseResponse.statusCode).toBe(201);
      const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
      const draftId = `production-draft-handoff-${handoff.handoffId}`;
      const recoveryLineagePlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => recoveryLineagePlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            if (scopedDraftId !== draftId) return operation(scope);
            const originalAppendDraftCreatedEvent = scope.appendDraftCreatedEvent;
            const wrappedScope = {
              ...scope,
              appendDraftCreatedEvent: async (draftToAppend: ProductionDraft) => {
                if (!barrierReached) {
                  barrierReached = true;
                  insertBarrierReached();
                  await insertReleased;
                }
                return originalAppendDraftCreatedEvent(draftToAppend);
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );

      draftRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
        headers: actorHeaders,
        payload: { caseId }
      });
      await Promise.race([
        insertBarrier,
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Timed out waiting for handoff draft insert barrier")),
          5_000
        ))
      ]);

      const draft = await store.getProductionDraft({ businessId: "local" }, draftId);
      expect(draft).toBeDefined();
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "draft_created")).toHaveLength(0);
      const reviewRequest = app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draftId}/review-cards/card-event-handoff`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten der Revision korrigieren." }
      });
      let reviewSettled = false;
      const pendingReviewRequest = reviewRequest.then((response) => {
        reviewSettled = true;
        return response;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(reviewSettled).toBe(false);

      releaseInsert();
      const enteredDraft = await draftRequest;
      expect(enteredDraft.statusCode).toBe(201);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "draft_created")).toHaveLength(1);
      const review = await pendingReviewRequest;
      expect(review.statusCode).toBe(200);

      let revisionSettled = false;
      revisionRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      }).then((response) => {
        revisionSettled = true;
        return response;
      });
      const revision = await revisionRequest;
      expect(revision.statusCode).toBe(201);
      const revisedDraft = revision.json<{ draft: ProductionDraft }>().draft;
      expect(revisedDraft.supersedesDraftId).toBe(draftId);
      expect(await store.findCaseIdForArtifact({ businessId: "local" }, revisedDraft.draftId)).toBe(caseId);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(1);
    } finally {
      releaseInsert();
      await draftRequest?.catch(() => undefined);
      await revisionRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("does not let a descendant commit before a raced prepare event is published", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture(
      eventSpec(),
      syntheticRevisionAppOptions("prepare-raced-event")
    );
    let releaseOuterEvent!: () => void;
    const outerEventReleased = new Promise<void>((resolve) => {
      releaseOuterEvent = resolve;
    });
    let outerEventReached!: () => void;
    const outerEventBarrier = new Promise<void>((resolve) => {
      outerEventReached = resolve;
    });
    let prepareRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    let revisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(201);

      const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      let forcePrepareRace = true;
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalPlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            if (scopedDraftId !== draft.draftId) return operation(scope);
            if (!forcePrepareRace) {
              const originalAppendRevisionEvent = scope.appendRevisionEvent;
              const wrappedScope = {
                ...scope,
                appendRevisionEvent: async (...args: Parameters<typeof originalAppendRevisionEvent>) => {
                  outerEventReached();
                  await outerEventReleased;
                  return originalAppendRevisionEvent(...args);
                }
              };
              return operation(wrappedScope);
            }
            const originalCommit = scope.commitPreparedDraft;
            const wrappedScope = {
              ...scope,
              commitPreparedDraft: async (...args: Parameters<typeof originalCommit>) => {
                const committed = await originalCommit(...args);
                forcePrepareRace = false;
                return committed ? false : committed;
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );

      prepareRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      await outerEventBarrier;
      const racedPrepared = (await store.listProductionDrafts({ businessId: "local" }))
        .find((candidate) => candidate.supersedesDraftId === draft.draftId);
      expect(racedPrepared).toBeDefined();
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(0);

      const reviewRequest = app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${racedPrepared!.draftId}/review-cards/card-prepared-event-spec`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten der Revision korrigieren." }
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect((await store.getProductionDraft({ businessId: "local" }, racedPrepared!.draftId))
        ?.reviewCards.some((card) => card.decision === "change_requested")).toBe(false);
      releaseOuterEvent();
      expect((await prepareRequest).statusCode).toBe(201);
      expect((await reviewRequest).statusCode).toBe(200);
      revisionRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${racedPrepared!.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      });
      expect((await revisionRequest).statusCode).toBe(201);
    } finally {
      releaseOuterEvent();
      await prepareRequest?.catch(() => undefined);
      await revisionRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("linearizes canonical review mutation and its case event before revision", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture(
      eventSpec(),
      syntheticRevisionAppOptions("review-event-race")
    );
    let releaseEvent!: () => void;
    const eventReleased = new Promise<void>((resolve) => {
      releaseEvent = resolve;
    });
    let eventReached!: () => void;
    const eventBarrier = new Promise<void>((resolve) => {
      eventReached = resolve;
    });
    let reviewRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    let revisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    try {
      const evidence = await app.inject({
        method: "POST",
        url: "/v1/production/cases/" + caseId + "/planning-evidence",
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(201);
      let barrierUsed = false;
      const originalAppendEventForArtifactCase = store.appendEventForArtifactCase.bind(store);
      vi.spyOn(store, "appendEventForArtifactCase").mockImplementation(async (context, artifactId, input, eventIdentity) => {
        if (!barrierUsed && input.kind === "review_decision") {
          barrierUsed = true;
          eventReached();
          await eventReleased;
        }
        return originalAppendEventForArtifactCase(context, artifactId, input, eventIdentity);
      });
      const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalPlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            const originalAppendReviewDecisionEvent = scope.appendReviewDecisionEvent;
            const wrappedScope = {
              ...scope,
              appendReviewDecisionEvent: async (...args: Parameters<typeof originalAppendReviewDecisionEvent>) => {
                if (!barrierUsed) {
                  barrierUsed = true;
                  eventReached();
                  await eventReleased;
                }
                return originalAppendReviewDecisionEvent(...args);
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );
      reviewRequest = app.inject({
        method: "PATCH",
        url: "/v1/production/drafts/" + draft.draftId + "/review-cards/card-event-handoff",
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten fuer die Revision korrigieren." }
      });
      await eventBarrier;
      expect((await store.getProductionDraft({ businessId: "local" }, draft.draftId))
        ?.reviewCards.find((card) => card.cardId === "card-event-handoff")?.decision).toBe("change_requested");

      let revisionSettled = false;
      revisionRequest = app.inject({
        method: "POST",
        url: "/v1/production/drafts/" + draft.draftId + "/revise",
        headers: actorHeaders,
        payload: {}
      }).then((response) => {
        revisionSettled = true;
        return response;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(revisionSettled).toBe(false);
      expect((await store.listProductionDrafts({ businessId: "local" }))
        .filter((candidate) => candidate.supersedesDraftId === draft.draftId)).toHaveLength(0);
      releaseEvent();
      expect((await reviewRequest).statusCode).toBe(200);
      expect((await revisionRequest).statusCode).toBe(201);
    } finally {
      releaseEvent();
      await reviewRequest?.catch(() => undefined);
      await revisionRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("rejects review and revise when the draft lineage has a missing predecessor", async () => {
    const { app, store, draft, caseId } = await productionFixture();
    try {
      const broken = validateProductionDraft({
        ...draft,
        supersedesDraftId: "production-draft-missing-predecessor"
      });
      await store.saveProductionDraft({ businessId: "local" }, broken);
      const review = await app.inject({
        method: "PATCH",
        url: "/v1/production/drafts/" + draft.draftId + "/review-cards/card-event-handoff",
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Lineage prüfen." }
      });
      expect(review.statusCode).toBe(409);
      expect((await store.getProductionDraft({ businessId: "local" }, draft.draftId))?.reviewCards[0]?.decision)
        .toBe("pending");
      const revisedBroken = validateProductionDraft({
        ...broken,
        reviewCards: broken.reviewCards.map((card) => ({
          ...card,
          decision: "change_requested" as const,
          operatorComment: "Lineage prüfen.",
          decidedBy: actorHeaders["x-catering-actor-name"],
          decidedAt: "2026-08-25T00:00:00.000Z"
        }))
      });
      await store.saveProductionDraft({ businessId: "local" }, revisedBroken);
      const revise = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/" + draft.draftId + "/revise",
        headers: actorHeaders,
        payload: {}
      });
      expect(revise.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it("fails closed when a review card is persisted before its case event", async () => {
    const { app, store, draft, caseId } = await productionFixture(
      eventSpec(),
      syntheticRevisionAppOptions("review-partial-failure")
    );
    let failReviewEvent = true;
    const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
    vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
      async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalPlanningScope(
        context,
        scopedCaseId,
        scopedDraftId,
        scopedRevision,
        async (scope) => {
          const wrappedScope = {
            ...scope,
            appendReviewDecisionEvent: async (...args: Parameters<typeof scope.appendReviewDecisionEvent>) => {
              if (failReviewEvent) {
                failReviewEvent = false;
                throw new Error("synthetic review event failure");
              }
              return scope.appendReviewDecisionEvent(...args);
            }
          };
          return operation(wrappedScope);
        }
      ) as any
    );
    try {
      const review = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/card-event-handoff`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Teilfehler pruefen." }
      });
      expect(review.statusCode).toBe(500);
      expect((await store.getProductionDraft({ businessId: "local" }, draft.draftId))
        ?.reviewCards.find((card) => card.cardId === "card-event-handoff")?.decision)
        .toBe("change_requested");

      const revise = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      });
      expect(revise.statusCode).toBe(409);
      expect((await store.listProductionDrafts({ businessId: "local" }))
        .filter((candidate) => candidate.supersedesDraftId === draft.draftId)).toHaveLength(0);

      const retry = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/card-event-handoff`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Teilfehler pruefen." }
      });
      expect(retry.statusCode).toBe(200);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "review_decision" && event.artifactId === draft.draftId))
        .toHaveLength(1);
      const revised = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      });
      expect(revised.statusCode).toBe(201);
      expect((await store.listProductionDrafts({ businessId: "local" }))
        .filter((candidate) => candidate.supersedesDraftId === draft.draftId)).toHaveLength(1);
    } finally {
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("rejects approval when a fits review event is missing until its idempotent retry repairs it", async () => {
    const { app, store, draft, caseId } = await productionFixture();
    const targetCard = draft.reviewCards.at(-1)!;
    let failTargetEvent = true;
    const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
    vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
      async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalPlanningScope(
        context,
        scopedCaseId,
        scopedDraftId,
        scopedRevision,
        async (scope) => {
          const wrappedScope = {
            ...scope,
            appendReviewDecisionEvent: async (...args: Parameters<typeof scope.appendReviewDecisionEvent>) => {
              if (failTargetEvent && args[1].eventIdentity.includes(`:${targetCard.cardId}:`)) {
                failTargetEvent = false;
                throw new Error("synthetic fits review event failure");
              }
              return scope.appendReviewDecisionEvent(...args);
            }
          };
          return operation(wrappedScope);
        }
      ) as any
    );
    try {
      for (const card of draft.reviewCards.slice(0, -1)) {
        const response = await app.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${draft.draftId}/review-cards/${card.cardId}`,
          headers: actorHeaders,
          payload: { decision: "fits", operatorComment: "Kanonische Fixture-Prüfung." }
        });
        expect(response.statusCode).toBe(200);
      }
      const failed = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${targetCard.cardId}`,
        headers: actorHeaders,
        payload: { decision: "fits", operatorComment: "Kanonische Fixture-Prüfung." }
      });
      expect(failed.statusCode).toBe(500);
      const persisted = await store.getProductionDraft({ businessId: "local" }, draft.draftId);
      expect(persisted?.reviewCards.every((card) => card.decision === "fits")).toBe(true);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "review_decision" && event.artifactId === draft.draftId))
        .toHaveLength(draft.reviewCards.length - 1);

      const blockedApproval = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/decision`,
        headers: actorHeaders,
        payload: { decision: "approved" }
      });
      expect(blockedApproval.statusCode).toBe(409);
      expect(await productionDecisionRepositoryFor(store)
        .listDecisionAggregatesForDraft({ businessId: "local" }, draft.draftId)).toHaveLength(0);

      const retry = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${targetCard.cardId}`,
        headers: actorHeaders,
        payload: { decision: "fits", operatorComment: "Kanonische Fixture-Prüfung." }
      });
      expect(retry.statusCode).toBe(200);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "review_decision" && event.artifactId === draft.draftId))
        .toHaveLength(draft.reviewCards.length);
    } finally {
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("rejects a decision when a review event fails after its preflight", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    let decisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    let releaseDecisionPreflight!: () => void;
    const decisionPreflightReleased = new Promise<void>((resolve) => {
      releaseDecisionPreflight = resolve;
    });
    let decisionPreflightReached!: () => void;
    const decisionPreflightBarrier = new Promise<void>((resolve) => {
      decisionPreflightReached = resolve;
    });
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(201);
      const preparedResponse = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(preparedResponse.statusCode).toBe(201);
      const preparedDraft = preparedResponse.json<{ draft: ProductionDraft }>().draft;
      const targetCard = preparedDraft.reviewCards.at(-1)!;
      for (const card of preparedDraft.reviewCards.slice(0, -1)) {
        const response = await app.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${card.cardId}`,
          headers: actorHeaders,
          payload: { decision: "fits", operatorComment: "Kanonische Vorprüfung." }
        });
        expect(response.statusCode).toBe(200);
      }

      const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      let pauseAfterDecisionPreflight = true;
      let failReviewEvent = true;
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => {
          const result = await originalPlanningScope(
            context,
            scopedCaseId,
            scopedDraftId,
            scopedRevision,
            async (scope) => {
              const wrappedScope = {
                ...scope,
                appendReviewDecisionEvent: async (...args: Parameters<typeof scope.appendReviewDecisionEvent>) => {
                  if (failReviewEvent) throw new Error("synthetic review event failure after decision preflight");
                  return scope.appendReviewDecisionEvent(...args);
                }
              };
              return operation(wrappedScope);
            }
          );
          if (pauseAfterDecisionPreflight) {
            pauseAfterDecisionPreflight = false;
            decisionPreflightReached();
            await decisionPreflightReleased;
          }
          return result;
        }
      );

      decisionRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: actorHeaders,
        payload: { decision: "approved" }
      });
      await decisionPreflightBarrier;

      const reviewFailure = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${targetCard.cardId}`,
        headers: actorHeaders,
        payload: { decision: "fits", operatorComment: "Parallele menschliche Prüfung." }
      });
      expect(reviewFailure.statusCode).toBe(500);
      const partiallyReviewed = await store.getProductionDraft({ businessId: "local" }, preparedDraft.draftId);
      expect(partiallyReviewed?.reviewCards.find((card) => card.cardId === targetCard.cardId)?.decision).toBe("fits");
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "review_decision" && event.artifactId === preparedDraft.draftId))
        .toHaveLength(preparedDraft.reviewCards.length - 1);

      releaseDecisionPreflight();
      const decision = await decisionRequest;
      expect(decision.statusCode).toBe(409);
      expect(await productionDecisionRepositoryFor(store)
        .listDecisionAggregatesForDraft({ businessId: "local" }, preparedDraft.draftId)).toHaveLength(0);
      expect(await store.listApprovedProductionSpecs({ businessId: "local" })).toHaveLength(0);

      failReviewEvent = false;
      const reviewRetry = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${targetCard.cardId}`,
        headers: actorHeaders,
        payload: { decision: "fits", operatorComment: "Parallele menschliche Prüfung." }
      });
      expect(reviewRetry.statusCode).toBe(200);
      const decisionRetry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: actorHeaders,
        payload: { decision: "approved" }
      });
      expect(decisionRetry.statusCode).toBe(201);
    } finally {
      releaseDecisionPreflight();
      await decisionRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("rejects incomplete persisted review timestamps before canonical approval", async () => {
    const { app, store, draft } = await productionFixture();
    try {
      const pendingWithTimestamp = validateProductionDraft({
        ...draft,
        reviewCards: draft.reviewCards.map((card, index) => index === 0
          ? {
            ...card,
            decision: "pending" as const,
            decidedBy: actorHeaders["x-catering-actor-name"],
            decidedAt: "2026-08-25T00:00:00.000Z"
          }
          : card)
      });
      await store.saveProductionDraft({ businessId: "local" }, pendingWithTimestamp);
      const pendingResponse = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/decision`,
        headers: actorHeaders,
        payload: { decision: "approved" }
      });
      expect(pendingResponse.statusCode).toBe(409);

      expect(() => validateProductionDraft({
        ...draft,
        reviewCards: draft.reviewCards.map((card, index) => index === 0
          ? { ...card, decision: "fits" as const, decidedBy: undefined, decidedAt: undefined }
          : card)
      })).toThrow(/needs decidedBy and decidedAt/);
    } finally {
      await app.close();
    }
  });

  it("recovers a committed prepared revision when its revision event is missing", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);

      let failRevisionEventOnce = true;
      const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalPlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            const wrappedScope = {
              ...scope,
              appendRevisionEvent: async (...args: Parameters<typeof scope.appendRevisionEvent>) => {
                if (failRevisionEventOnce) {
                  failRevisionEventOnce = false;
                  throw new Error("synthetic missing revision event");
                }
                return scope.appendRevisionEvent(...args);
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );
      const firstPrepare = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(firstPrepare.statusCode).toBe(500);
      vi.restoreAllMocks();

      const draftsAfterFailedEvent = await store.listProductionDrafts({ businessId: "local" });
      const preparedDraft = draftsAfterFailedEvent.find((candidate) => candidate.supersedesDraftId === draft.draftId);
      expect(preparedDraft).toMatchObject({
        revision: draft.revision + 1,
        status: "pending_review",
        supersedesDraftId: draft.draftId
      });
      expect(await store.getProductionDraft({ businessId: "local" }, draft.draftId)).toMatchObject({ status: "superseded" });
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(0);

      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(retry.statusCode).toBe(201);
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(2);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(1);
      expect(retry.json<{ draft: ProductionDraft }>().draft.draftId).toBe(preparedDraft?.draftId);
    } finally {
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("linearizes recovery event publication before a descendant revision can commit", async () => {
    const approvalPath = path.join(tmpdir(), `catering-planning-evidence-recovery-lineage-approval-${randomUUID()}.json`);
    const revisionAdapter: LlmReadinessProviderAdapter = {
      adapterId: "planning-evidence-recovery-lineage",
      adapterMode: "synthetic_live",
      async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
        return {
          ok: true,
          errors: [],
          adapterId: "planning-evidence-recovery-lineage",
          adapterMode: "synthetic_live" as const,
          providerId: "planning-evidence-recovery-lineage-provider",
          providerRequestId: "planning-evidence-recovery-lineage-request",
          promptSchemaId: request.promptSchemaId,
          outputCandidate: {
            contractVersion: "llm-readiness-v0" as const,
            outputId: "planning-evidence-recovery-lineage-output",
            kind: "production_draft_extraction" as const,
            sourceRefs: request.input.sourceRefs,
            humanApprovalRequired: true as const,
            writesProductObject: false as const,
            text: JSON.stringify({
              eventType: "lunch",
              serviceForm: "buffet",
              eventDate: "2026-09-22",
              attendeeCount: 60,
              components: [{ label: "Caesar Salad", course: "main" }],
              openQuestions: []
            })
          }
        };
      }
    };
    writeFileSync(approvalPath, JSON.stringify({
      approvalId: "planning-evidence-recovery-lineage-approval",
      businessId: "local",
      providerKind: "openai",
      allowedDataClasses: ["personal_confidential"],
      allowedPurposes: ["production_draft_revision"],
      allowedModels: ["planning-evidence-recovery-lineage-model"],
      allowedCapabilities: ["structured_output"],
      allowedRegions: ["local"],
      allowedEndpoints: ["https://fixture.invalid"],
      maxCostEurPerCall: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      legalBasisReference: "synthetic-race-test",
      approvedBy: "synthetic-test-actor",
      approvedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    }), { mode: 0o600 });
    const { app, store, draft, spec, caseId } = await productionFixture(eventSpec(), {
      llmAdapter: revisionAdapter,
      llmProviderDescriptor: {
        providerKind: "openai",
        dataLeavesInstallation: true,
        providerModel: "planning-evidence-recovery-lineage-model",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "https://fixture.invalid",
        metadataVerified: true
      },
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
      }
    });
    let releaseRecovery!: () => void;
    const recoveryReleased = new Promise<void>((resolve) => {
      releaseRecovery = resolve;
    });
    let recoveryLineageRead!: () => void;
    const recoveryLineageReadStarted = new Promise<void>((resolve) => {
      recoveryLineageRead = resolve;
    });
    let recoveryRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    let revisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);

      let failRevisionEventOnce = true;
      const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalPlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            const wrappedScope = {
              ...scope,
              appendRevisionEvent: async (...args: Parameters<typeof scope.appendRevisionEvent>) => {
                if (failRevisionEventOnce) {
                  failRevisionEventOnce = false;
                  throw new Error("synthetic missing revision event");
                }
                return scope.appendRevisionEvent(...args);
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );
      const firstPrepare = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(firstPrepare.statusCode).toBe(500);
      vi.restoreAllMocks();

      const preparedDraft = (await store.listProductionDrafts({ businessId: "local" }))
        .find((candidate) => candidate.supersedesDraftId === draft.draftId);
      expect(preparedDraft).toBeDefined();
      const recoveryLineagePlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => recoveryLineagePlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            const wrappedScope = {
              ...scope,
              listDraftsInLineage: async (sourceDraftId: string) => {
                const result = await scope.listDraftsInLineage(sourceDraftId);
                if (scopedDraftId === draft.draftId) {
                  recoveryLineageRead();
                  await recoveryReleased;
                }
                return result;
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );

      recoveryRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      await Promise.race([
        recoveryLineageReadStarted,
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Timed out waiting for recovery lineage barrier")),
          5_000
        ))
      ]);

      const reviewRequest = app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${preparedDraft!.draftId}/review-cards/card-prepared-event-spec`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten der Revision korrigieren." }
      });
      releaseRecovery();
      const recovered = await recoveryRequest;
      expect(recovered.statusCode).toBe(201);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(1);
      const review = await reviewRequest;
      expect(review.statusCode).toBe(200);

      revisionRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft!.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      }).then((response) => {
        return response;
      });
      const revision = await revisionRequest;
      expect(revision.statusCode).toBe(201);
      const revisedDraft = revision.json<{ draft: ProductionDraft }>().draft;
      expect(revisedDraft.supersedesDraftId).toBe(preparedDraft!.draftId);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(2);
    } finally {
      releaseRecovery();
      await recoveryRequest?.catch(() => undefined);
      await revisionRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("serializes revision behind an evidence-first planning scope", async () => {
    const approvalPath = path.join(tmpdir(), `catering-planning-evidence-order-approval-${randomUUID()}.json`);
    const revisionAdapter: LlmReadinessProviderAdapter = {
      adapterId: "planning-evidence-order-race",
      adapterMode: "synthetic_live",
      async run(request: { promptSchemaId?: string; input: LlmReadinessModelInput }) {
        return {
          ok: true,
          errors: [],
          adapterId: "planning-evidence-order-race",
          adapterMode: "synthetic_live" as const,
          providerId: "planning-evidence-order-provider",
          providerRequestId: "planning-evidence-order-request",
          promptSchemaId: request.promptSchemaId,
          outputCandidate: {
            contractVersion: "llm-readiness-v0" as const,
            outputId: "planning-evidence-order-output",
            kind: "production_draft_extraction" as const,
            sourceRefs: request.input.sourceRefs,
            humanApprovalRequired: true as const,
            writesProductObject: false as const,
            text: JSON.stringify({
              eventType: "lunch",
              serviceForm: "buffet",
              eventDate: "2026-09-22",
              attendeeCount: 60,
              components: [{ label: "Caesar Salad", course: "main" }],
              openQuestions: []
            })
          }
        };
      }
    };
    writeFileSync(approvalPath, JSON.stringify({
      approvalId: "planning-evidence-order-approval",
      businessId: "local",
      providerKind: "openai",
      allowedDataClasses: ["personal_confidential"],
      allowedPurposes: ["production_draft_revision"],
      allowedModels: ["planning-evidence-order-model"],
      allowedCapabilities: ["structured_output"],
      allowedRegions: ["local"],
      allowedEndpoints: ["https://fixture.invalid"],
      maxCostEurPerCall: 0,
      retentionPolicy: "local-only",
      trainingUse: "contractually_excluded",
      legalBasisReference: "synthetic-race-test",
      approvedBy: "synthetic-test-actor",
      approvedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z"
    }), { mode: 0o600 });
    const { app, store, repository, draft, spec, caseId } = await productionFixture(eventSpec(), {
      llmAdapter: revisionAdapter,
      llmProviderDescriptor: {
        providerKind: "openai",
        dataLeavesInstallation: true,
        providerModel: "planning-evidence-order-model",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "local-only",
        trainingUse: "contractually_excluded",
        endpoint: "https://fixture.invalid",
        metadataVerified: true
      },
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
      }
    });
    let releaseRecipeRead!: () => void;
    const recipeReadReleased = new Promise<void>((resolve) => {
      releaseRecipeRead = resolve;
    });
    let recipeReadStarted!: () => void;
    const recipeReadBarrier = new Promise<void>((resolve) => {
      recipeReadStarted = resolve;
    });
    const originalRepositoryGet = repository.get.bind(repository);
    let pausedOnce = true;
    let revisionSettled = false;
    let revisionRequest: Promise<Awaited<ReturnType<typeof app.inject>>> | undefined;
    try {
      const review = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/card-event-handoff`,
        headers: actorHeaders,
        payload: { decision: "change_requested", operatorComment: "Eventdaten fuer die Revision korrigieren." }
      });
      expect(review.statusCode).toBe(200);

      vi.spyOn(repository, "get").mockImplementation(async (context, recipeId) => {
        const current = await originalRepositoryGet(context, recipeId);
        if (pausedOnce && recipeId === "recipe-caesar-salad") {
          pausedOnce = false;
          recipeReadStarted();
          await recipeReadReleased;
        }
        return current;
      });
      const evidenceRequest = app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      await Promise.race([
        recipeReadBarrier,
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Timed out waiting for evidence scope recipe-read barrier")),
          5_000
        ))
      ]);

      revisionRequest = app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/revise`,
        headers: actorHeaders,
        payload: {}
      }).then((response) => {
        revisionSettled = true;
        return response;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(revisionSettled).toBe(false);
      expect((await store.listProductionDrafts({ businessId: "local" }))
        .some((candidate) => candidate.supersedesDraftId === draft.draftId)).toBe(false);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(0);

      releaseRecipeRead();
      const evidence = await evidenceRequest;
      expect(evidence.statusCode).toBe(201);
      const revision = await revisionRequest;
      expect(revision.statusCode).toBe(201);
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(1);
      const revisedDraft = revision.json<{ draft: ProductionDraft }>().draft;
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, revisedDraft.draftId, revisedDraft.revision)).toHaveLength(0);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(1);
    } finally {
      releaseRecipeRead();
      await revisionRequest?.catch(() => undefined);
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("rejects recovery when a newer competing draft revision exists in the same lineage", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);

      let failRevisionEventOnce = true;
      const originalPlanningScope = store.withPlanningEvidenceCriticalSection.bind(store);
      vi.spyOn(store, "withPlanningEvidenceCriticalSection").mockImplementation(
        async (context, scopedCaseId, scopedDraftId, scopedRevision, operation) => originalPlanningScope(
          context,
          scopedCaseId,
          scopedDraftId,
          scopedRevision,
          async (scope) => {
            const originalAppendRevisionEvent = scope.appendRevisionEvent;
            const wrappedScope = {
              ...scope,
              appendRevisionEvent: async (...args: Parameters<typeof originalAppendRevisionEvent>) => {
                if (failRevisionEventOnce) {
                  failRevisionEventOnce = false;
                  throw new Error("synthetic missing revision event");
                }
                return originalAppendRevisionEvent(...args);
              }
            };
            return operation(wrappedScope);
          }
        ) as any
      );
      const firstPrepare = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(firstPrepare.statusCode).toBe(500);
      vi.restoreAllMocks();

      const preparedDraft = (await store.listProductionDrafts({ businessId: "local" }))
        .find((candidate) => candidate.supersedesDraftId === draft.draftId);
      expect(preparedDraft).toBeDefined();
      const competingDraft = structuredClone(preparedDraft!);
      competingDraft.draftId = "production-draft-competing-r3";
      competingDraft.revision = preparedDraft!.revision + 1;
      competingDraft.supersedesDraftId = preparedDraft!.draftId;
      competingDraft.source = {
        ...competingDraft.source,
        sourceRef: "upload:competing-r3"
      };
      competingDraft.draftArtifacts = {
        ...competingDraft.draftArtifacts,
        eventSpec: {
          ...competingDraft.draftArtifacts.eventSpec!,
          specId: "spec-competing-r3"
        }
      };
      await store.saveProductionDraft({ businessId: "local" }, competingDraft);

      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(retry.statusCode).toBe(409);
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .filter((event) => event.kind === "revision_created")).toHaveLength(0);
    } finally {
      vi.restoreAllMocks();
      await app.close();
    }
  });

  it("rejects preparing a current revision without the required planning evidence", async () => {
    const { app, store, draft } = await productionFixture();
    try {
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect(prepared.json().message).toContain("Planungs-Evidenz");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("rejects a persisted insufficient approval aggregate before projecting it", async () => {
    const { app, store, draft, spec } = await productionFixture();
    try {
      const { sourceDraft, approval } = await persistInsufficientApprovedAggregate(store, draft, spec);
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${sourceDraft.draftId}/decision`,
        headers: actorHeaders,
        payload: { decision: "approved" }
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain("production readiness is insufficient");
      expect(await store.listApprovalsForTarget({ businessId: "local" }, approval.target)).toHaveLength(0);
      expect(await store.listApprovedProductionSpecs({ businessId: "local" })).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects evidence when a persisted decision already exists for the pending draft", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const { sourceDraft, approval } = await persistInsufficientApprovedAggregate(store, draft, spec);
      expect(sourceDraft.status).toBe("pending_review");
      expect(await store.insertApproval({ businessId: "local" }, approval)).toBe("created");

      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: sourceDraft.draftId, draftRevision: sourceDraft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(409);
      expect(evidence.json().message).toContain("Freigabeevidenz");
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, sourceDraft.draftId, sourceDraft.revision)).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects applying a persisted insufficient approved spec before any apply writes", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const { sourceDraft, approval, approvedProductionSpec } = await persistInsufficientApprovedAggregate(store, draft, spec);
      await store.insertApproval({ businessId: "local" }, approval);
      await store.insertApprovedProductionSpec({ businessId: "local" }, approvedProductionSpec);
      const currentCase = await store.getCase({ businessId: "local" }, caseId);
      expect(currentCase).toBeDefined();
      const caseUpdate = await store.updateCase({ businessId: "local" }, caseId, currentCase!.version, {
        ...currentCase!,
        approvedProductionSpecId: approvedProductionSpec.approvedProductionSpecId,
        version: currentCase!.version + 1,
        updatedAt: "2026-08-20T10:31:00.000Z"
      });
      expect(caseUpdate).toBe("updated");
      await store.appendEventForArtifactCase({ businessId: "local" }, sourceDraft.draftId, {
        at: "2026-08-20T10:31:00.000Z",
        role: "system",
        kind: "approval",
        text: "Historische unzureichende Produktionsfreigabe.",
        artifactId: approvedProductionSpec.approvedProductionSpecId
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpec.approvedProductionSpecId}/apply`,
        headers: actorHeaders,
        payload: {}
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().errors).toContain("production readiness is insufficient");
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects applying an approved spec whose review projection is incomplete", async () => {
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const spec = eventSpec();
    await intakeRecords.insertSpec({ businessId: "local" }, spec);
    const { app, store, repository, draft, caseId } = await productionFixture(spec, { intakeRecords });
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(201);
      const preparedResponse = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(preparedResponse.statusCode).toBe(201);
      const preparedDraft = preparedResponse.json<{ draft: ProductionDraft }>().draft;
      const { approvedProductionSpec, decidedDraft, missingCard } = await persistReadyApprovedAggregateWithoutOneReviewEvent(
        store,
        preparedDraft,
        caseId
      );
      expect(await store.getProductionDraft({ businessId: "local" }, approvedProductionSpec.sourceDraft.draftId))
        .toEqual(decidedDraft);
      const persistedAggregate = await productionDecisionRepositoryFor(store)
        .getDecisionAggregate({ businessId: "local" }, approvedProductionSpec.approvalRequestId);
      expect(persistedAggregate?.decidedDraft).toEqual(decidedDraft);
      const response = await app.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpec.approvedProductionSpecId}/apply`,
        headers: actorHeaders,
        payload: {}
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().errors, JSON.stringify(response.json())).toContain(
        "ProductionDraft besitzt nicht für jede persistierte Review-Entscheidung ein kanonisches Case-Ereignis."
      );
      expect((await store.listEvents({ businessId: "local" }, caseId))
        .some((event) => event.kind === "review_decision" && event.artifactId === draft.draftId &&
          event.at === missingCard.decidedAt)).toBe(false);
      expect(await store.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await store.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await repository.list({ businessId: "local" })).toHaveLength(1);
      expect(await store.listApprovedProductionSpecs({ businessId: "local" })).toHaveLength(1);
      expect(await store.listApplyManifests({ businessId: "local" })).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("keeps one binding identity and rejects conflicting human evidence", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const body = { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) };
      const first = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: body
      });
      expect(first.statusCode).toBe(201);
      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: body
      });
      expect(retry.statusCode).toBe(201);
      const conflicting = {
        ...body,
        quantityDecision: {
          ...body.quantityDecision,
          decisionId: "quantity-planning-evidence-conflict",
          perUnitAmount: 7 / 6,
          targetAmount: 70,
          rationale: "Abweichende zweite Mengenwahrheit"
        }
      };
      const second = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: conflicting
      });
      expect(second.statusCode).toBe(409);
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("rejects a second semantically bound evidence record under another evidenceId", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const first = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(first.statusCode).toBe(201);
      const existing = (await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision))[0]!;
      const duplicate = structuredClone(existing);
      duplicate.evidenceId = `${existing.evidenceId}-alternate`;
      duplicate.quantityDecision = {
        ...duplicate.quantityDecision,
        decisionId: "quantity-planning-evidence-alternate",
        perUnitAmount: 7 / 6,
        targetAmount: 70,
        rationale: "Abweichende zweite Mengenwahrheit"
      };
      duplicate.bridge = {
        ...duplicate.bridge,
        targetOutput: { amount: 70, unit: "servings" },
        targetServings: 70
      };
      await expect(
        store.insertProductionPlanningEvidence({ businessId: "local" }, duplicate)
      ).rejects.toThrow("evidenceId");

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(201);
      const drafts = await store.listProductionDrafts({ businessId: "local" });
      expect(drafts).toHaveLength(2);
      expect(drafts.find((item) => item.draftId === draft.draftId)?.status).toBe("superseded");
      expect(drafts.find((item) => item.supersedesDraftId === draft.draftId)?.status).toBe("pending_review");
    } finally {
      await app.close();
    }
  });

  it("rejects persisted evidence whose bridge no longer matches its human decisions", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);
      const existing = (await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision))[0]!;
      const tampered = structuredClone(existing);
      tampered.bridge = {
        ...tampered.bridge,
        targetOutput: { amount: 70, unit: "servings" },
        targetServings: 70
      };
      const evidenceCollection = store as unknown as {
        productionPlanningEvidence: { set: (context: { businessId: string }, value: typeof existing) => Promise<void> };
      };
      await evidenceCollection.productionPlanningEvidence.set({ businessId: "local" }, tampered);

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect(prepared.json().message).toContain("Mengen-Rezept-Evidenz");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("rejects persisted evidence when its reviewed output mapping drifts", async () => {
    const { app, store, draft, spec, caseId } = await productionFixture();
    try {
      const evidenceResponse = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidenceWithReviewedOutputMapping(spec) }
      });
      expect(evidenceResponse.statusCode).toBe(201);
      const existing = (await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision))[0]!;
      const tampered = structuredClone(existing);
      tampered.outputMapping = { ...tampered.outputMapping!, outputAmount: 2 };
      const evidenceCollection = store as unknown as {
        productionPlanningEvidence: { set: (context: { businessId: string }, value: typeof existing) => Promise<void> };
      };
      await evidenceCollection.productionPlanningEvidence.set({ businessId: "local" }, tampered);

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(409);
      expect(prepared.json().message).toContain("Mengen-Rezept-Evidenz");
      expect(await store.listProductionDrafts({ businessId: "local" })).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("keeps purchase-only components outside the planning-evidence requirement", async () => {
    const { app, store, draft } = await productionFixture(purchaseEventSpec());
    try {
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(201);
      const preparedDraft = prepared.json<{ draft: ProductionDraft }>().draft;
      expect(preparedDraft.draftArtifacts.productionPlan?.productionBatches).toHaveLength(0);
      expect(preparedDraft.draftArtifacts.purchaseList?.items.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it("rejects planning evidence for a purchase-only component even when it has a recipe override", async () => {
    const spec = purchaseEventSpec();
    spec.menuPlan = spec.menuPlan.map((component) => ({
      ...component,
      recipeOverrideId: "recipe-caesar-salad"
    }));
    const { app, store, draft, caseId } = await productionFixture(spec);
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode).toBe(422);
      expect(evidence.json().message).toContain("scratch");
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(0);

      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });

  it("rejects recipe drift and a stale evidence submission after a new draft revision", async () => {
    const { app, store, repository, draft, spec, caseId } = await productionFixture();
    try {
      const body = { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) };
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: body
      });
      expect(evidence.statusCode).toBe(201);
      await repository.save({ businessId: "local" }, {
        ...recipe(),
        ingredients: [{ ...recipe().ingredients[0]!, quantity: { amount: 2.5, unit: "kg" } }]
      });
      const driftedPrepare = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(driftedPrepare.statusCode).toBe(409);
      expect(driftedPrepare.json().message).toContain("Rezept-Snapshot");

      await repository.save({ businessId: "local" }, recipe());
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode).toBe(201);
      const stale = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: body
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json().message).toMatch(/aktuellen Produktionsrevision|offenen ProductionDraft/);
      expect(await store.listProductionPlanningEvidence({ businessId: "local" }, draft.draftId, draft.revision)).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("retries an approved canonical Decision idempotently without duplicate projections", async () => {
    const dataRoot = mkdtempSync(path.join(tmpdir(), "catering-planning-evidence-decision-retry-"));
    const secret = "planning-evidence-decision-retry-secret";
    const headers = (actorName: string) => ({
      "x-catering-trusted-secret": secret,
      "x-catering-actor-name": actorName,
      "x-catering-business-id": "local"
    });
    const appFetch = (app: any) =>
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = new URL(String(input));
        const response = await app.inject({
          method: init?.method ?? "GET",
          url: `${url.pathname}${url.search}`,
          headers: Object.fromEntries(new Headers(init?.headers).entries()),
          payload: typeof init?.body === "string" ? init.body : undefined
        });
        return new Response(response.body, {
          status: response.statusCode,
          headers: response.headers as HeadersInit
        });
      };
    const expectStatus = async <T>(response: { statusCode: number; body: string; json: () => unknown }, status: number): Promise<T> => {
      expect(response.statusCode, response.body).toBe(status);
      return response.json() as T;
    };

    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const intakeApp = buildIntakeApp({
      rootDir: dataRoot,
      store: intakeStore,
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const offerStore = new OfferStore({ rootDir: dataRoot });
    const offerApp = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      sourceDocumentReader: new HttpSourceDocumentMetadataReader({
        intakeServiceUrl: "http://intake.internal",
        trustedServiceSecret: secret,
        fetch: appFetch(intakeApp)
      }),
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    await repository.save({ businessId: "local" }, recipe());
    const store = new ProductionStore({ rootDir: dataRoot });
    const productionApp = buildProductionApp({
      dataRoot,
      store,
      repository,
      handoffReader: new HttpProductionHandoffReader({
        offerServiceUrl: "http://offer.internal",
        trustedServiceSecret: secret,
        fetch: appFetch(offerApp)
      }),
      intakeRecords: new HttpIntakeRecordsPort({
        intakeServiceUrl: "http://intake.internal",
        trustedServiceSecret: secret,
        fetch: appFetch(intakeApp)
      }),
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });

    try {
      const intakeHeaders = headers("Intake-Mitarbeiter");
      const offerHeaders = headers("Angebots-Mitarbeiter");
      const productionHeaders = headers("Produktions-Mitarbeiter");
      const intake = await expectStatus<{
        eventRequest: ReturnType<typeof createEventRequestFromText>;
        acceptedEventSpec: AcceptedEventSpec;
      }>(await intakeApp.inject({
        method: "POST",
        url: "/v1/intake/specs/manual",
        headers: intakeHeaders,
        payload: {
          customerName: "Synthetischer Retry-Fall",
          eventType: "Lunch",
          eventDate: "2026-09-22",
          attendeeCount: 60,
          serviceForm: "Buffet",
          menuItems: ["Caesar Salad"],
          notes: "Kanonischer idempotenter Decision-Test ohne Kundendaten."
        }
      }), 201);
      const intakeComponent = intake.acceptedEventSpec.menuPlan[0]!;
      const updated = await expectStatus<{ acceptedEventSpec: AcceptedEventSpec }>(await intakeApp.inject({
        method: "PATCH",
        url: `/v1/intake/specs/${intake.acceptedEventSpec.specId}`,
        headers: intakeHeaders,
        payload: {
          componentUpdates: [{
            componentId: intakeComponent.componentId,
            menuCategory: "classic",
            productionMode: "scratch",
            recipeOverrideId: recipe().recipeId,
            notes: "Menschliche Produktionsentscheidung für den Retry-Vertrag."
          }]
        }
      }), 200);
      const offerCase = await expectStatus<{ case: { caseId: string } }>(await offerApp.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: offerHeaders,
        payload: { eventTypeLabel: "Lunch", attendeeCount: 60 }
      }), 201);
      const offerDraft = await expectStatus<{
        draftId: string;
        revision: number;
        variantSet: Array<{ variantId: string }>;
      }>(await offerApp.inject({
        method: "POST",
        url: "/v1/offers/drafts",
        headers: offerHeaders,
        payload: {
          ...intake.eventRequest,
          caseId: offerCase.case.caseId,
          acceptedEventSpecId: updated.acceptedEventSpec.specId
        }
      }), 201);
      const offerApproval = await expectStatus<{ approvedOffer: { approvedOfferId: string } }>(await offerApp.inject({
        method: "POST",
        url: `/v1/offers/drafts/${offerDraft.draftId}/decision`,
        headers: offerHeaders,
        payload: {
          decision: "approved",
          revision: offerDraft.revision,
          variantId: offerDraft.variantSet[0]!.variantId
        }
      }), 201);
      const handoff = await expectStatus<{ handoff: { handoffId: string } }>(await offerApp.inject({
        method: "POST",
        url: `/v1/offers/approved/${offerApproval.approvedOffer.approvedOfferId}/handoffs`,
        headers: offerHeaders,
        payload: {}
      }), 201);
      const productionCase = await expectStatus<{ case: { caseId: string } }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/cases/from-handoff/${handoff.handoff.handoffId}`,
        headers: productionHeaders,
        payload: {}
      }), 201);
      const sourceDraft = await expectStatus<{ draft: ProductionDraft }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/from-handoff/${handoff.handoff.handoffId}`,
        headers: productionHeaders,
        payload: { caseId: productionCase.case.caseId }
      }), 201);
      const eventSpec = sourceDraft.draft.draftArtifacts.eventSpec!;
      const component = eventSpec.menuPlan[0]!;
      const evidence = await productionApp.inject({
        method: "POST",
        url: `/v1/production/cases/${productionCase.case.caseId}/planning-evidence`,
        headers: productionHeaders,
        payload: {
          draftId: sourceDraft.draft.draftId,
          draftRevision: sourceDraft.draft.revision,
          ...planningEvidence(eventSpec)
        }
      });
      expect(evidence.statusCode).toBe(201);
      const prepared = await expectStatus<{ draft: ProductionDraft }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${sourceDraft.draft.draftId}/prepare`,
        headers: productionHeaders,
        payload: {}
      }), 201);
      for (const card of prepared.draft.reviewCards) {
        const review = await productionApp.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${prepared.draft.draftId}/review-cards/${card.cardId}`,
          headers: productionHeaders,
          payload: { decision: "fits", operatorComment: "Kanonische Retry-Review." }
        });
        expect(review.statusCode).toBe(200);
      }
      const decisionBody = { decision: "approved" as const };
      const first = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${prepared.draft.draftId}/decision`,
        headers: productionHeaders,
        payload: decisionBody
      });
      expect(first.statusCode, first.body).toBe(201);
      const firstPayload = first.json() as { approvedProductionSpec: { approvedProductionSpecId: string } };
      const eventsAfterFirst = await store.listEvents({ businessId: "local" }, productionCase.case.caseId);
      const aggregatesAfterFirst = await productionDecisionRepositoryFor(store)
        .listDecisionAggregatesForDraft(trustedProductionActor, prepared.draft.draftId);
      const approvedSpecsAfterFirst = await store.listApprovedProductionSpecs({ businessId: "local" });
      const plansAfterFirst = await store.listPlans({ businessId: "local" });
      const purchaseListsAfterFirst = await store.listPurchaseLists({ businessId: "local" });
      const manifestsAfterFirst = await store.listApplyManifests({ businessId: "local" });
      const recipesAfterFirst = await repository.list({ businessId: "local" });

      const retry = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${prepared.draft.draftId}/decision`,
        headers: productionHeaders,
        payload: decisionBody
      });
      expect(retry.statusCode, retry.body).toBe(201);
      const retryPayload = retry.json() as { approvedProductionSpec: { approvedProductionSpecId: string } };
      expect(retryPayload.approvedProductionSpec.approvedProductionSpecId)
        .toBe(firstPayload.approvedProductionSpec.approvedProductionSpecId);
      const eventsAfterRetry = await store.listEvents({ businessId: "local" }, productionCase.case.caseId);
      expect(eventsAfterRetry).toEqual(eventsAfterFirst);
      expect(eventsAfterRetry.filter((event) => event.kind === "review_decision")).toHaveLength(
        prepared.draft.reviewCards.length + 1
      );
      expect(eventsAfterRetry.filter((event) => event.kind === "approval")).toHaveLength(1);
      expect(new Set(eventsAfterRetry.map((event) => event.eventId)).size).toBe(eventsAfterRetry.length);
      expect(await productionDecisionRepositoryFor(store).listDecisionAggregatesForDraft(
        trustedProductionActor,
        prepared.draft.draftId
      )).toHaveLength(1);
      expect(await store.listApprovedProductionSpecs({ businessId: "local" })).toEqual(approvedSpecsAfterFirst);
      expect(await store.listPlans({ businessId: "local" })).toEqual(plansAfterFirst);
      expect(await store.listPurchaseLists({ businessId: "local" })).toEqual(purchaseListsAfterFirst);
      expect(await store.listApplyManifests({ businessId: "local" })).toEqual(manifestsAfterFirst);
      expect(await repository.list({ businessId: "local" })).toEqual(recipesAfterFirst);
      expect(component.componentId).toBe(intakeComponent.componentId);
    } finally {
      await Promise.all([intakeApp.close(), offerApp.close(), productionApp.close()]);
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("recovers an approved Decision after approval projection fault without duplicate projections", async () => {
    let failOnce = true;
    const { app, store, repository, draft, spec, caseId } = await productionFixture(eventSpec(), {
      productionDecisionFaultInjector: (phase) => {
        if (failOnce && phase === "after_approval_insert") {
          failOnce = false;
          throw new Error("synthetic approval projection fault");
        }
      }
    });
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode, evidence.body).toBe(201);
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode, prepared.body).toBe(201);
      const preparedDraft = prepared.json<{ draft: ProductionDraft }>().draft;
      for (const card of preparedDraft.reviewCards) {
        const review = await app.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${card.cardId}`,
          headers: actorHeaders,
          payload: { decision: "fits", operatorComment: "Kanonische Fault-Recovery-Review." }
        });
        expect(review.statusCode, review.body).toBe(200);
      }

      const decisionBody = { decision: "approved" as const };
      const first = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: actorHeaders,
        payload: decisionBody
      });
      expect(first.statusCode, first.body).toBe(500);
      const approvalsAfterFault = await store.listApprovalsForTarget({ businessId: "local" }, {
        kind: "production_draft",
        artifactId: preparedDraft.draftId,
        revision: preparedDraft.revision
      });
      const aggregatesAfterFault = await productionDecisionRepositoryFor(store)
        .listDecisionAggregatesForDraft(trustedProductionActor, preparedDraft.draftId);
      const eventsAfterFault = await store.listEvents({ businessId: "local" }, caseId);
      const draftsAfterFault = await store.listProductionDrafts({ businessId: "local" });
      const approvedSpecsAfterFault = await store.listApprovedProductionSpecs({ businessId: "local" });
      const plansAfterFault = await store.listPlans({ businessId: "local" });
      const purchaseListsAfterFault = await store.listPurchaseLists({ businessId: "local" });
      const manifestsAfterFault = await store.listApplyManifests({ businessId: "local" });
      const recipesAfterFault = await repository.list({ businessId: "local" });
      expect(approvalsAfterFault).toHaveLength(1);
      expect(aggregatesAfterFault).toHaveLength(1);
      expect(await store.getProductionDraft({ businessId: "local" }, preparedDraft.draftId))
        .toMatchObject({ status: "pending_review" });
      expect(approvedSpecsAfterFault).toHaveLength(0);

      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: actorHeaders,
        payload: decisionBody
      });
      expect(retry.statusCode, retry.body).toBe(201);
      expect(await store.listApprovalsForTarget({ businessId: "local" }, {
        kind: "production_draft",
        artifactId: preparedDraft.draftId,
        revision: preparedDraft.revision
      })).toEqual(approvalsAfterFault);
      expect(await productionDecisionRepositoryFor(store)
        .listDecisionAggregatesForDraft(trustedProductionActor, preparedDraft.draftId))
        .toEqual(aggregatesAfterFault);
      expect(await store.listProductionDrafts({ businessId: "local" })).toEqual(draftsAfterFault.map((candidate) =>
        candidate.draftId === preparedDraft.draftId
          ? expect.objectContaining({ draftId: candidate.draftId, status: "approved" })
          : candidate
      ));
      expect(await store.listApprovedProductionSpecs({ businessId: "local" })).toHaveLength(1);
      const eventsAfterRetry = await store.listEvents({ businessId: "local" }, caseId);
      expect(new Set(eventsAfterRetry.map((event) => event.eventId)).size).toBe(eventsAfterRetry.length);
      expect(eventsAfterRetry.filter((event) => event.kind === "revision_created")).toHaveLength(1);
      expect(eventsAfterRetry.filter((event) => event.kind === "review_decision")).toHaveLength(preparedDraft.reviewCards.length + 1);
      expect(eventsAfterRetry.filter((event) => event.kind === "approval")).toHaveLength(1);
      expect(eventsAfterRetry.length).toBe(eventsAfterFault.length + 2);
      expect(await store.listPlans({ businessId: "local" })).toEqual(plansAfterFault);
      expect(await store.listPurchaseLists({ businessId: "local" })).toEqual(purchaseListsAfterFault);
      expect(await store.listApplyManifests({ businessId: "local" })).toEqual(manifestsAfterFault);
      expect(await repository.list({ businessId: "local" })).toEqual(recipesAfterFault);
    } finally {
      await app.close();
    }
  });

  it("rejects an idempotent Decision retry after a newer canonical draft continuation", async () => {
    const { app, store, repository, draft, spec, caseId } = await productionFixture();
    try {
      const evidence = await app.inject({
        method: "POST",
        url: `/v1/production/cases/${caseId}/planning-evidence`,
        headers: actorHeaders,
        payload: { draftId: draft.draftId, draftRevision: draft.revision, ...planningEvidence(spec) }
      });
      expect(evidence.statusCode, evidence.body).toBe(201);
      const prepared = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/prepare`,
        headers: actorHeaders,
        payload: {}
      });
      expect(prepared.statusCode, prepared.body).toBe(201);
      const preparedDraft = prepared.json<{ draft: ProductionDraft }>().draft;
      for (const card of preparedDraft.reviewCards) {
        const review = await app.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${card.cardId}`,
          headers: actorHeaders,
          payload: { decision: "fits", operatorComment: "Kanonische Fortsetzungsprüfung." }
        });
        expect(review.statusCode, review.body).toBe(200);
      }

      const decisionBody = { decision: "approved" as const };
      const first = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: actorHeaders,
        payload: decisionBody
      });
      expect(first.statusCode, first.body).toBe(201);
      const firstPayload = first.json() as { approvedProductionSpec: { approvedProductionSpecId: string } };
      const approvedDraft = await store.getProductionDraft({ businessId: "local" }, preparedDraft.draftId);
      expect(approvedDraft?.status).toBe("approved");

      const continuation = validateProductionDraft({
        ...structuredClone(approvedDraft!),
        draftId: `${approvedDraft!.draftId}-continuation`,
        revision: approvedDraft!.revision + 1,
        status: "pending_review",
        createdAt: "2026-08-25T12:00:00.000Z",
        supersedesDraftId: approvedDraft!.draftId,
        approvalRequestId: undefined,
        approvedBy: undefined,
        approvedAt: undefined
      });
      expect(await store.insertProductionDraft({ businessId: "local" }, continuation)).toBe("created");
      await store.appendEvent({ businessId: "local" }, caseId, {
        at: continuation.createdAt,
        role: "assistant",
        kind: "revision_created",
        text: "Neue kanonische Produktionsrevision erstellt.",
        artifactId: continuation.draftId,
        revisionRef: {
          artifactType: "ProductionDraft",
          artifactId: continuation.draftId,
          revision: continuation.revision,
          createdAt: continuation.createdAt,
          supersedesArtifactId: approvedDraft!.draftId
        }
      }, `revision:${continuation.draftId}`);
      expect(await store.reopenCaseForDraftContinuation(
        { businessId: "local" },
        caseId,
        continuation.draftId
      )).toBe("reopened");

      const eventsBeforeRetry = await store.listEvents({ businessId: "local" }, caseId);
      const aggregatesBeforeRetry = await productionDecisionRepositoryFor(store)
        .listDecisionAggregatesForDraft(trustedProductionActor, preparedDraft.draftId);
      const approvedSpecsBeforeRetry = await store.listApprovedProductionSpecs({ businessId: "local" });
      const plansBeforeRetry = await store.listPlans({ businessId: "local" });
      const purchaseListsBeforeRetry = await store.listPurchaseLists({ businessId: "local" });
      const manifestsBeforeRetry = await store.listApplyManifests({ businessId: "local" });
      const recipesBeforeRetry = await repository.list({ businessId: "local" });

      const retry = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: actorHeaders,
        payload: decisionBody
      });
      expect(retry.statusCode, retry.body).toBe(409);
      expect(retry.json().message).toContain("ProductionDraft");
      expect(await store.listEvents({ businessId: "local" }, caseId)).toEqual(eventsBeforeRetry);
      expect(await productionDecisionRepositoryFor(store)
        .listDecisionAggregatesForDraft(trustedProductionActor, preparedDraft.draftId))
        .toEqual(aggregatesBeforeRetry);
      expect(await store.listApprovedProductionSpecs({ businessId: "local" })).toEqual(approvedSpecsBeforeRetry);
      expect(await store.listPlans({ businessId: "local" })).toEqual(plansBeforeRetry);
      expect(await store.listPurchaseLists({ businessId: "local" })).toEqual(purchaseListsBeforeRetry);
      expect(await store.listApplyManifests({ businessId: "local" })).toEqual(manifestsBeforeRetry);
      expect(await repository.list({ businessId: "local" })).toEqual(recipesBeforeRetry);
      expect(firstPayload.approvedProductionSpec.approvedProductionSpecId).toBe(
        approvedSpecsBeforeRetry[0]?.approvedProductionSpecId
      );
    } finally {
      await app.close();
    }
  });
});
