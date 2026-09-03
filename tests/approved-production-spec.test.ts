import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
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
  auditIdFor,
  approvalRequestIdForTarget,
  llmReadinessContractVersion,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  createBusinessScopedPersistentCollection,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
  type AuditEntry,
  type ProductionCase,
  type ProductionDraft,
  type ProductionHandoff,
  type Recipe
} from "@catering/shared-core";

const TRUSTED_SECRET = "approved-production-spec-secret";
const context = { businessId: "local" } as const;
const headers = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};
const roots: string[] = [];
const canonicalHandoffsByStore = new WeakMap<ProductionStore, Map<string, ProductionHandoff>>();
const externalTestProviderDescriptor = {
  providerKind: "openai" as const,
  dataLeavesInstallation: true,
  providerModel: "approved-production-spec-test-model",
  capability: "structured_output" as const,
  actualRegion: "test-region",
  maximumEstimatedCostEur: 0,
  retentionPolicy: "test-zero-retention",
  trainingUse: "contractually_excluded" as const,
  endpoint: "https://provider.test/approved-production-spec",
  metadataVerified: true
};

type PgMemPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  connect: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
    release: () => void;
  }>;
  end: () => Promise<void>;
};

function decisionReadbackConflictPgMemPool(): PgMemPool {
  const database = newDb();
  // pg-mem accepts the production migration's DO wrapper without executing it;
  // create the two transaction-local relations explicitly for this harness.
  database.public.none("CREATE TABLE catering_schema_migrations (unit_name TEXT PRIMARY KEY, version_number INTEGER NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  database.public.none("CREATE TABLE catering_business_records (business_id TEXT NOT NULL, collection_name TEXT NOT NULL, record_id TEXT NOT NULL, payload JSONB NOT NULL, version_number INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (business_id, collection_name, record_id))");
  const { Pool } = database.adapters.createPg();
  const base = new Pool();
  const query = (sql: string, params?: unknown[]) => base.query(sql, params) as Promise<{ rows: Array<Record<string, unknown>> }>;
  return {
    query,
    async connect() {
      const client = await base.connect();
      let transactionBackup: ReturnType<typeof database.backup> | undefined;
      let corruptDecisionReadback = false;
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
          const result = await client.query(sql, params) as { rows: Array<Record<string, unknown>> };
          if (
            sql.includes("INSERT INTO catering_business_records") &&
            params?.[1] === "production/decision-aggregates" &&
            result.rows.length === 1
          ) {
            corruptDecisionReadback = true;
          }
          if (
            corruptDecisionReadback &&
            sql.includes("SELECT payload FROM catering_business_records") &&
            params?.[1] === "production/decision-aggregates" &&
            result.rows.length === 1
          ) {
            const payload = typeof result.rows[0].payload === "string"
              ? JSON.parse(result.rows[0].payload)
              : result.rows[0].payload;
            result.rows[0].payload = {
              ...(payload as Record<string, unknown>),
              approval: {
                ...((payload as { approval: Record<string, unknown> }).approval),
                comment: "readback-conflict"
              }
            };
          }
          return result;
        },
        release: () => client.release()
      };
    },
    end: () => base.end()
  };
}

function writeProcessingApproval(rootDir: string): string {
  const approvalPath = path.join(rootDir, "llm-processing-approval.json");
  writeFileSync(approvalPath, JSON.stringify({
    approvalId: "approved-production-spec-test-approval",
    businessId: "local",
    providerKind: "openai",
    allowedDataClasses: ["personal_confidential"],
    allowedPurposes: ["production_draft_revision"],
    allowedModels: [externalTestProviderDescriptor.providerModel],
    allowedCapabilities: [externalTestProviderDescriptor.capability],
    allowedRegions: [externalTestProviderDescriptor.actualRegion],
    allowedEndpoints: [externalTestProviderDescriptor.endpoint],
    maxCostEurPerCall: 0,
    retentionPolicy: externalTestProviderDescriptor.retentionPolicy,
    trainingUse: "contractually_excluded",
    legalBasisReference: "test-only",
    approvedBy: "test-operator",
    approvedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-12-31T00:00:00.000Z"
  }));
  chmodSync(approvalPath, 0o600);
  return approvalPath;
}

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
  const baseEventSpec = normalizeEventRequestToSpec(createEventRequestFromText({
    requestId: `request-${draftId}`,
    channel: "text",
    rawText: "Synthetisches Buffet fuer 20 Personen am 18.09.2026."
  }));
  const eventSpec = {
    ...baseEventSpec,
    budgetContext: {
      ...(baseEventSpec.budgetContext ?? {}),
      pricingSummary: {
        subtotal: { amount: 100, currency: "EUR" },
        perPerson: { amount: 5, currency: "EUR" }
      }
    },
    menuPlan: baseEventSpec.menuPlan.map((component) => ({
      ...component,
      menuCategory: "classic" as const,
      recipeOverrideId: approvedRecipe().recipeId,
      productionDecision: { mode: "scratch" as const }
    }))
  };
  const repository = new InMemoryRecipeRepository();
  await repository.seed(context, [approvedRecipe()]);
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
  auditFileFaultInjector?: (phase:
    | "before_record_publish"
    | "after_record_publish"
    | "before_record_replace"
    | "after_record_replace"
  ) => void;
  llmAdapter?: LlmReadinessProviderAdapter;
  pgPool?: PgMemPool;
} = {}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "approved-production-spec-"));
  roots.push(rootDir);
  const store = new ProductionStore({ rootDir, pgPool: options.pgPool });
  const repository = new InMemoryRecipeRepository({ rootDir, pgPool: options.pgPool });
  const intakeStore = new InMemoryIntakeRecordsPort();
  const auditLog = new AuditLogStore({ rootDir, pgPool: options.pgPool });
  if (options.auditFileFaultInjector && !options.pgPool) {
    // Keep the fault at the real business-scoped atomicInsert boundary; the
    // production route must learn ownership from this writer, not from a spy.
    (auditLog as any).entries = createBusinessScopedPersistentCollection<AuditEntry>({
      collectionName: "audit/events",
      getId: (entry) => entry.auditId,
      rootDir,
      fileFaultInjector: options.auditFileFaultInjector
    });
  }
  const canonicalHandoffs = new Map<string, ProductionHandoff>();
  canonicalHandoffsByStore.set(store, canonicalHandoffs);
  const approvalPath = options.llmAdapter ? writeProcessingApproval(rootDir) : undefined;
  const app = buildProductionApp({
    dataRoot: rootDir,
    store,
    repository,
    pgPool: options.pgPool,
    intakeRecords: intakeStore,
    auditLog,
    llmAdapter: options.llmAdapter,
    llmProviderDescriptor: options.llmAdapter ? externalTestProviderDescriptor : undefined,
    trustedActorSecret: TRUSTED_SECRET,
    productionApplyFaultInjector: options.applyFaultInjector,
    productionDecisionFaultInjector: options.decisionFaultInjector,
    handoffReader: {
      get: async (_context, handoffId) => canonicalHandoffs.get(handoffId)
    },
    env: approvalPath
      ? {
          CATERING_DEV_AUTH: "1",
          CATERING_SYNTHETIC_LLM_SLICE: "1",
          CATERING_LLM_PROCESSING_APPROVAL_FILE: approvalPath
        }
      : { CATERING_DEV_AUTH: "1" }
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
        operatorCommentVisibility: "operational",
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

async function importDraft(store: ProductionStore, draft: ProductionDraft, includeHandoff = true) {
  const eventSpec = draft.draftArtifacts.eventSpec;
  if (!eventSpec) throw new Error("Kanonischer Test-Draft benötigt eine EventSpec.");
  const handoffId = `handoff-approved-production-spec-${draft.draftId}`;
  const handoff: ProductionHandoff = {
    schemaVersion: "1.0",
    businessId: context.businessId,
    handoffId,
    approvedOfferId: `approved-offer-${draft.draftId}`,
    approvalRequestId: `approval-offer-${draft.draftId}`,
    createdAt: draft.createdAt,
    eventSpecSnapshot: structuredClone(eventSpec),
    pricingSnapshot: structuredClone(eventSpec.budgetContext?.pricingSummary ?? {
      subtotal: { amount: 100, currency: "EUR" },
      perPerson: { amount: 5, currency: "EUR" }
    }),
    source: {
      draftId: `offer-draft-${draft.draftId}`,
      revision: 1,
      selectedVariantId: `variant-approved-production-spec-${draft.draftId}`
    }
  };
  const handoffs = canonicalHandoffsByStore.get(store);
  if (!handoffs) throw new Error("Kanonischer Test-Handoff ist nicht am Store gebunden.");
  handoffs.set(handoffId, handoff);

  const canonicalDraft: ProductionDraft = {
    ...draft,
    source: {
      ...draft.source,
      kind: "manual_import",
      sourceRef: includeHandoff ? `offer-handoff:${handoffId}` : `fixture:${draft.draftId}`
    }
  };
  await store.saveProductionDraft(context, canonicalDraft);
  const caseId = `production-case-${draft.draftId}`;
  const productionCase: ProductionCase = {
    schemaVersion: "1.0",
    businessId: context.businessId,
    caseId,
    product: "production",
    displayName: `Kanonischer Testfall ${draft.draftId}`,
    status: "open",
    version: 1,
    createdAt: draft.createdAt,
    updatedAt: draft.createdAt,
    ...(includeHandoff ? { productionHandoffId: handoffId } : {}),
    sourceSpecId: eventSpec.specId
  };
  await store.createCase(context, productionCase);
  await store.appendEvent(context, caseId, {
    at: draft.createdAt,
    role: "assistant",
    kind: "draft_created",
    text: "Produktionsentwurf erstellt.",
    artifactId: draft.draftId,
    revisionRef: {
      artifactType: "ProductionDraft",
      artifactId: draft.draftId,
      revision: draft.revision,
      createdAt: draft.createdAt
    }
  }, draft.draftId);
  for (const card of canonicalDraft.reviewCards) {
    if (!card.decidedAt) continue;
    const decisionLabel = {
      pending: "Offen",
      fits: "Passt",
      change_requested: "Änderung nötig",
      unclear: "Unklar",
      blocked: "Blockiert"
    }[card.decision];
    const eventIdentity = `review:${canonicalDraft.draftId}:${card.cardId}:${card.decidedAt}`;
    await store.appendEvent(context, caseId, {
      at: card.decidedAt,
      role: "user",
      kind: "review_decision",
      text: `Prüfpunkt als „${decisionLabel}“ bewertet.`,
      artifactId: canonicalDraft.draftId
    }, eventIdentity);
  }
  return { statusCode: 201, body: "" };
}

async function seedAcceptedEventSpec(
  intakeStore: InMemoryIntakeRecordsPort,
  draft: ProductionDraft
): Promise<void> {
  const eventSpec = draft.draftArtifacts.eventSpec;
  if (!eventSpec) throw new Error("Test-Draft benötigt eine AcceptedEventSpec.");
  await intakeStore.insertSpec(context, eventSpec);
}

async function seedPlanningEvidenceForDraft(
  app: ReturnType<typeof buildProductionApp>,
  store: ProductionStore,
  intakeStore: InMemoryIntakeRecordsPort,
  repository: InMemoryRecipeRepository,
  draft: ProductionDraft
): Promise<void> {
  const eventSpec = draft.draftArtifacts.eventSpec;
  if (!eventSpec) throw new Error("Planungs-Evidenz benötigt eine EventSpec.");
  const caseId = await store.findCaseIdForArtifact(context, draft.draftId);
  if (!caseId) throw new Error("Planungs-Evidenz benötigt einen kanonischen Produktionsauftrag.");
  await seedAcceptedEventSpec(intakeStore, draft);
  await repository.seed(context, [approvedRecipe()]);
  for (const component of eventSpec.menuPlan) {
    const guestCount = component.servings ?? eventSpec.attendees.expected ?? 0;
    const response = await app.inject({
      method: "POST",
      url: `/v1/production/cases/${caseId}/planning-evidence`,
      headers,
      payload: {
        draftId: draft.draftId,
        draftRevision: draft.revision,
        componentId: component.componentId,
        recipeId: approvedRecipe().recipeId,
        quantityDecision: {
          decisionId: `quantity-review-${draft.draftId}-${component.componentId}`,
          eventSpecId: eventSpec.specId,
          componentId: component.componentId,
          guestCount,
          serviceFormat: component.serviceStyle ?? "buffet",
          dishRole: "other",
          basis: "servings_per_person",
          perUnitAmount: 1,
          perUnitUnit: "servings",
          targetAmount: guestCount,
          targetUnit: "servings",
          rationale: "Menschlich bestätigte Portionsentscheidung für den Testpfad.",
          evidence: { kind: "operator_instruction", reference: "approved-production-spec-test" },
          reviewStatus: "approved"
        },
        recipeEventUseReview: {
          eventSpecId: eventSpec.specId,
          recipeId: approvedRecipe().recipeId,
          reviewedBy: "Produktions-Mitarbeiter",
          reviewedAt: "2026-08-10T12:04:00.000Z",
          decision: "accepted_for_event",
          confirmations: {
            quantitiesAndYield: true,
            methodAndEquipment: true,
            allergensAndDiet: true,
            holdingAndRegeneration: true
          }
        }
      }
    });
    expect(response.statusCode, response.body).toBe(201);
  }
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

  it("rejects a foreign same-ID Decision audit before publishing any decision projection", async () => {
    const { app, auditLog, store } = buildHarness();
    const draft = await completeDraft("draft-decision-conflicting-audit");
    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      const expectedSpec = createApprovedProductionSpec({
        draft,
        approval: createApprovalRequestRecord({
          actor: {
            businessId: context.businessId,
            name: "Produktions-Mitarbeiter",
            source: "trusted-proxy:x-catering-actor-name",
            trusted: true
          },
          role: "production_operator",
          target: { kind: "production_draft", artifactId: draft.draftId, revision: draft.revision },
          decision: "approved"
        })
      });
      const conflictingAuditInput = {
        action: "production.production_spec_approved" as const,
        entityType: "ApprovedProductionSpec" as const,
        entityId: expectedSpec.approvedProductionSpecId,
        actor: { name: "Fremder-Akteur", source: "trusted-proxy:foreign" as const },
        at: "2026-08-30T00:00:00.000Z",
        idempotencyKey: `production-decision:${expectedSpec.approvedProductionSpecId}`,
        summary: "Fremder Entscheidungs-Audit mit gleicher deterministischer ID.",
        details: {
          draftId: draft.draftId,
          revision: draft.revision,
          approvalRequestId: "foreign-approval",
          writesProductObject: false
        }
      } as const;
      const foreignDecisionAudit = await auditLog.logFor(context, conflictingAuditInput);
      const expectedDecisionAuditId = auditIdFor({
        action: "production.production_spec_approved",
        entityType: "ApprovedProductionSpec",
        entityId: expectedSpec.approvedProductionSpecId,
        actor: { name: "Produktions-Mitarbeiter", source: "trusted-proxy:x-catering-actor-name" },
        at: "2026-08-30T00:00:00.000Z",
        summary: "Fremder Entscheidungs-Audit mit gleicher deterministischer ID.",
        details: conflictingAuditInput.details,
        businessId: context.businessId
      }, conflictingAuditInput.idempotencyKey);
      expect(foreignDecisionAudit.auditId).toBe(expectedDecisionAuditId);
      const before = {
        approvals: await store.listApprovalsForTarget(context, {
          kind: "production_draft",
          artifactId: draft.draftId,
          revision: draft.revision
        }),
        aggregate: await productionDecisionRepositoryFor(store).getDecisionAggregate(
          context,
          approvalRequestIdForTarget({
            businessId: context.businessId,
            target: { kind: "production_draft", artifactId: draft.draftId, revision: draft.revision }
          })
        ),
        approvedSpecs: await store.listApprovedProductionSpecs(context),
        persistedDraft: await store.getProductionDraft(context, draft.draftId),
        events: await store.listEvents(context, (await store.findCaseIdForArtifact(context, draft.draftId))!),
        audits: await auditLog.listRecentFor(context, 100)
      };

      const response = await decide(app, draft.draftId, "approved");
      expect(response.statusCode, response.body).toBe(409);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toEqual(before.approvals);
      expect(await productionDecisionRepositoryFor(store).getDecisionAggregate(
        context,
        approvalRequestIdForTarget({
          businessId: context.businessId,
          target: { kind: "production_draft", artifactId: draft.draftId, revision: draft.revision }
        })
      )).toEqual(before.aggregate);
      expect(await store.listApprovedProductionSpecs(context)).toEqual(before.approvedSpecs);
      expect(await store.getProductionDraft(context, draft.draftId)).toEqual(before.persistedDraft);
      expect(await store.listEvents(context, (await store.findCaseIdForArtifact(context, draft.draftId))!)).toEqual(before.events);
      expect(await auditLog.listRecentFor(context, 100)).toEqual(before.audits);
      expect(await auditLog.getFor(context, expectedDecisionAuditId)).toEqual(foreignDecisionAudit);
    } finally {
      await app.close();
    }
  });

  it("rejects a foreign same-ID rejected-Decision audit before publishing the rejection", async () => {
    const { app, auditLog, store } = buildHarness();
    const draft = await completeDraft("draft-rejected-conflicting-audit");
    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      const actor = {
        businessId: context.businessId,
        name: "Produktions-Mitarbeiter",
        source: "trusted-proxy:x-catering-actor-name" as const,
        trusted: true as const
      };
      const expectedApproval = createApprovalRequestRecord({
        actor,
        role: "production_operator",
        target: { kind: "production_draft", artifactId: draft.draftId, revision: draft.revision },
        decision: "rejected"
      });
      const conflictingAuditInput = {
        action: "production.production_draft_rejected" as const,
        entityType: "ProductionDraft" as const,
        entityId: draft.draftId,
        actor: { name: "Fremder-Akteur", source: "trusted-proxy:foreign" as const },
        at: "2026-08-30T00:00:00.000Z",
        idempotencyKey: `production-decision:${expectedApproval.approvalRequestId}`,
        summary: "Fremder Ablehnungs-Audit mit gleicher deterministischer ID.",
        details: {
          draftId: draft.draftId,
          revision: draft.revision,
          approvalRequestId: "foreign-approval",
          writesProductObject: false
        }
      } as const;
      const foreignAudit = await auditLog.logFor(context, conflictingAuditInput);
      const expectedAuditId = auditIdFor({
        ...conflictingAuditInput,
        businessId: context.businessId,
        actor: { name: "Produktions-Mitarbeiter", source: "trusted-proxy:x-catering-actor-name" }
      }, conflictingAuditInput.idempotencyKey);
      expect(foreignAudit.auditId).toBe(expectedAuditId);
      const caseId = await store.findCaseIdForArtifact(context, draft.draftId);
      if (!caseId) throw new Error("Kanonischer Test-Draft besitzt keinen Case.");
      const before = {
        approvals: await store.listApprovalsForTarget(context, {
          kind: "production_draft",
          artifactId: draft.draftId,
          revision: draft.revision
        }),
        aggregate: await productionDecisionRepositoryFor(store).getDecisionAggregate(
          context,
          expectedApproval.approvalRequestId
        ),
        approvedSpecs: await store.listApprovedProductionSpecs(context),
        persistedDraft: await store.getProductionDraft(context, draft.draftId),
        events: await store.listEvents(context, caseId),
        audits: await auditLog.listRecentFor(context, 100)
      };

      const response = await decide(app, draft.draftId, "rejected");
      expect(response.statusCode, response.body).toBe(409);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toEqual(before.approvals);
      expect(await productionDecisionRepositoryFor(store).getDecisionAggregate(
        context,
        expectedApproval.approvalRequestId
      )).toEqual(before.aggregate);
      expect(await store.listApprovedProductionSpecs(context)).toEqual(before.approvedSpecs);
      expect(await store.getProductionDraft(context, draft.draftId)).toEqual(before.persistedDraft);
      expect(await store.listEvents(context, caseId)).toEqual(before.events);
      expect(await auditLog.listRecentFor(context, 100)).toEqual(before.audits);
      expect(await auditLog.getFor(context, expectedAuditId)).toEqual(foreignAudit);
    } finally {
      await app.close();
    }
  });

  it("rolls back a PostgreSQL Decision audit when aggregate read-back conflicts", async () => {
    const pgPool = decisionReadbackConflictPgMemPool();
    const { app, auditLog, store } = buildHarness({ pgPool });
    const draft = await completeDraft("draft-decision-pg-readback-conflict");
    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      const caseId = await store.findCaseIdForArtifact(context, draft.draftId);
      if (!caseId) throw new Error("Kanonischer Test-Draft besitzt keinen Case.");
      const before = {
        aggregates: await productionDecisionRepositoryFor(store).listDecisionAggregatesForDraft(context, draft.draftId),
        approvals: await store.listApprovalsForTarget(context, {
          kind: "production_draft",
          artifactId: draft.draftId,
          revision: draft.revision
        }),
        specs: await store.listApprovedProductionSpecs(context),
        drafts: await store.listProductionDrafts(context),
        events: await store.listEvents(context, caseId),
        audits: await auditLog.listRecentFor(context, 100)
      };

      const response = await decide(app, draft.draftId, "approved");

      expect(response.statusCode, response.body).toBe(409);
      expect(await productionDecisionRepositoryFor(store).listDecisionAggregatesForDraft(context, draft.draftId))
        .toEqual(before.aggregates);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toEqual(before.approvals);
      expect(await store.listApprovedProductionSpecs(context)).toEqual(before.specs);
      expect(await store.listProductionDrafts(context)).toEqual(before.drafts);
      expect(await store.listEvents(context, caseId)).toEqual(before.events);
      expect(await auditLog.listRecentFor(context, 100)).toEqual(before.audits);
    } finally {
      await app.close();
      await pgPool.end();
    }
  });

  it.each([
    {
      label: "review_decision",
      eventIdentity: "review",
      eventKind: "review_decision" as const,
      eventArtifactId: (draft: ProductionDraft, approvalRequestId: string) => approvalRequestId,
      eventText: "Fremdes Review-Ereignis"
    },
    {
      label: "approval",
      eventIdentity: "approval",
      eventKind: "approval" as const,
      eventArtifactId: (draft: ProductionDraft, _approvalRequestId: string) =>
        createApprovedProductionSpec({
          draft,
          approval: createApprovalRequestRecord({
            actor: {
              businessId: context.businessId,
              name: "Produktions-Mitarbeiter",
              source: "trusted-proxy:x-catering-actor-name",
              trusted: true
            },
            role: "production_operator",
            target: { kind: "production_draft", artifactId: draft.draftId, revision: draft.revision },
            decision: "approved"
          })
        }).approvedProductionSpecId,
      eventText: "Fremdes Approval-Ereignis"
    }
  ])("rejects a foreign same-ID $label event before publishing Decision projections", async ({
    eventIdentity,
    eventKind,
    eventArtifactId,
    eventText
  }) => {
    const { app, auditLog, store } = buildHarness();
    const draft = await completeDraft(`draft-decision-conflicting-${eventIdentity}-event`);
    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      const caseId = await store.findCaseIdForArtifact(context, draft.draftId);
      if (!caseId) throw new Error("Kanonischer Test-Draft besitzt keinen Case.");
      const approvalRequestId = approvalRequestIdForTarget({
        businessId: context.businessId,
        target: { kind: "production_draft", artifactId: draft.draftId, revision: draft.revision }
      });
      await store.appendEvent(context, caseId, {
        at: "2026-08-30T00:00:00.000Z",
        role: "user",
        kind: eventKind,
        text: eventText,
        artifactId: eventArtifactId(draft, approvalRequestId)
      }, eventIdentity === "review" ? approvalRequestId : eventArtifactId(draft, approvalRequestId));
      const before = {
        approvals: await store.listApprovalsForTarget(context, {
          kind: "production_draft",
          artifactId: draft.draftId,
          revision: draft.revision
        }),
        aggregate: await productionDecisionRepositoryFor(store).getDecisionAggregate(context, approvalRequestId),
        specs: await store.listApprovedProductionSpecs(context),
        persistedDraft: await store.getProductionDraft(context, draft.draftId),
        events: await store.listEvents(context, caseId),
        audits: await auditLog.listRecentFor(context, 100)
      };

      const response = await decide(app, draft.draftId, "approved");

      expect(response.statusCode, response.body).toBe(409);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toEqual(before.approvals);
      expect(await productionDecisionRepositoryFor(store).getDecisionAggregate(context, approvalRequestId))
        .toEqual(before.aggregate);
      expect(await store.listApprovedProductionSpecs(context)).toEqual(before.specs);
      expect(await store.getProductionDraft(context, draft.draftId)).toEqual(before.persistedDraft);
      expect(await store.listEvents(context, caseId)).toEqual(before.events);
      expect(await auditLog.listRecentFor(context, 100)).toEqual(before.audits);
    } finally {
      await app.close();
    }
  });

  it("uses the case decision scope for a linked case without a production handoff", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-decision-linked-case-without-handoff");
    try {
      expect((await importDraft(store, draft, false)).statusCode).toBe(201);
      const caseId = await store.findCaseIdForArtifact(context, draft.draftId);
      if (!caseId) throw new Error("Kanonischer Test-Draft besitzt keinen Case.");

      const original = store.withCaseDecisionCriticalSection.bind(store);
      let calls = 0;
      store.withCaseDecisionCriticalSection = async (...args) => {
        calls += 1;
        return original(...args);
      };

      const response = await decide(app, draft.draftId, "approved");

      expect(response.statusCode, response.body).toBe(201);
      expect(calls).toBe(1);
    } finally {
      await app.close();
    }
  });

  it("rejects a Handoff-less Case with a different approved production snapshot before Decision writes", async () => {
    const { app, auditLog, store } = buildHarness();
    const draft = await completeDraft("draft-decision-case-foreign-approved-spec");
    try {
      expect((await importDraft(store, draft, false)).statusCode).toBe(201);
      const caseId = await store.findCaseIdForArtifact(context, draft.draftId);
      if (!caseId) throw new Error("Kanonischer Test-Draft besitzt keinen Case.");
      const current = await store.getCase(context, caseId);
      if (!current) throw new Error("Kanonischer Test-Case fehlt.");
      expect(await store.updateCase(context, caseId, current.version, {
        ...current,
        approvedProductionSpecId: "approved-production-spec-foreign",
        version: current.version + 1
      })).toBe("updated");
      const before = {
        aggregate: await productionDecisionRepositoryFor(store).listDecisionAggregatesForDraft(context, draft.draftId),
        approvals: await store.listApprovalsForTarget(context, {
          kind: "production_draft",
          artifactId: draft.draftId,
          revision: draft.revision
        }),
        specs: await store.listApprovedProductionSpecs(context),
        draft: await store.getProductionDraft(context, draft.draftId),
        case: await store.getCase(context, caseId),
        events: await store.listEvents(context, caseId),
        audits: await auditLog.listRecentFor(context, 100)
      };

      const response = await decide(app, draft.draftId, "approved");

      expect(response.statusCode, response.body).toBe(409);
      expect(await productionDecisionRepositoryFor(store).listDecisionAggregatesForDraft(context, draft.draftId))
        .toEqual(before.aggregate);
      expect(await store.listApprovalsForTarget(context, {
        kind: "production_draft",
        artifactId: draft.draftId,
        revision: draft.revision
      })).toEqual(before.approvals);
      expect(await store.listApprovedProductionSpecs(context)).toEqual(before.specs);
      expect(await store.getProductionDraft(context, draft.draftId)).toEqual(before.draft);
      expect(await store.getCase(context, caseId)).toEqual(before.case);
      expect(await store.listEvents(context, caseId)).toEqual(before.events);
      expect(await auditLog.listRecentFor(context, 100)).toEqual(before.audits);
    } finally {
      await app.close();
    }
  });

  it("serializes legacy review mutations with a Handoff-less linked Case Decision", async () => {
    const { app, store } = buildHarness();
    const draft = await completeDraft("draft-decision-legacy-case-lock-race");
    const decisionRepository = productionDecisionRepositoryFor(store);
    const originalCaseScope = store.withCaseDecisionCriticalSection.bind(store);
    const originalTargetScope = decisionRepository.withTargetCriticalSection.bind(decisionRepository);
    let releaseDecision!: () => void;
    const decisionGate = new Promise<void>((resolve) => { releaseDecision = resolve; });
    let decisionReadEntered!: () => void;
    const decisionReadStarted = new Promise<void>((resolve) => { decisionReadEntered = resolve; });
    let legacyLockRequested!: () => void;
    const legacyLockRequest = new Promise<void>((resolve) => { legacyLockRequested = resolve; });
    let legacySetDraftEntered = false;

    try {
      expect((await importDraft(store, draft, false)).statusCode).toBe(201);
      (store as any).withCaseDecisionCriticalSection = (
        businessContext: typeof context,
        caseId: string,
        target: any,
        operation: (current: any, scope: any, transactionalQueryable?: unknown) => Promise<unknown>
      ) => originalCaseScope(
        businessContext,
        caseId,
        target,
        (current: any, scope: any, transactionalQueryable?: unknown) => operation(
          current,
          {
            ...scope,
            getDraft: async (draftId: string) => {
              const value = await scope.getDraft(draftId);
              if (draftId === draft.draftId) decisionReadEntered();
              await decisionGate;
              return value;
            }
          },
          transactionalQueryable
        )
      );
      (decisionRepository as any).withTargetCriticalSection = (
        businessContext: typeof context,
        target: any,
        operation: (scope: any, transactionalQueryable?: unknown) => Promise<unknown>,
        caseId?: string
      ) => {
        legacyLockRequested();
        return originalTargetScope(
          businessContext,
          target,
          async (scope: any, transactionalQueryable?: unknown) => operation({
            ...scope,
            setDraft: async (value: ProductionDraft) => {
              legacySetDraftEntered = true;
              return scope.setDraft(value);
            }
          }, transactionalQueryable),
          caseId
        );
      };

      const decision = decide(app, draft.draftId, "approved");
      await decisionReadStarted;
      const mutation = app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${draft.draftId}/review-cards/${draft.reviewCards[0]!.cardId}`,
        headers,
        payload: { decision: "blocked", operatorComment: "Legacy mutation" }
      });
      await legacyLockRequest;
      expect(legacySetDraftEntered).toBe(false);
      releaseDecision();

      expect((await mutation).statusCode).toBe(409);
      expect(legacySetDraftEntered).toBe(false);
      expect((await decision).statusCode).toBe(201);
      await expect(store.getProductionDraft(context, draft.draftId)).resolves.toMatchObject({
        status: "approved",
        reviewCards: expect.arrayContaining([
          expect.objectContaining({ cardId: draft.reviewCards[0]!.cardId, decision: "fits" })
        ])
      });
    } finally {
      releaseDecision();
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

    const originalCriticalSection = store.withCaseDecisionCriticalSection.bind(store);
    let entered!: () => void;
    let release!: () => void;
    const aggregateEntered = new Promise<void>((resolve) => { entered = resolve; });
    const continueDecision = new Promise<void>((resolve) => { release = resolve; });
    (store as any).withCaseDecisionCriticalSection = (
      businessContext: typeof context,
      caseId: string,
      target: any,
      operation: (current: any, scope: any, transactionalQueryable?: unknown) => Promise<unknown>
    ) => originalCriticalSection(businessContext, caseId, target, (current, scope, transactionalQueryable) => operation(
      current,
      {
        ...scope,
        insertDecisionAggregate: async (aggregate: any) => {
          entered();
          await continueDecision;
          return scope.insertDecisionAggregate(aggregate);
        }
      },
      transactionalQueryable
    ));

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

    const originalCriticalSection = store.withCaseDecisionCriticalSection.bind(store);
    let entered!: () => void;
    let release!: () => void;
    const aggregateEntered = new Promise<void>((resolve) => { entered = resolve; });
    const continueDecision = new Promise<void>((resolve) => { release = resolve; });
    (store as any).withCaseDecisionCriticalSection = (
      businessContext: typeof context,
      caseId: string,
      target: any,
      operation: (current: any, scope: any, transactionalQueryable?: unknown) => Promise<unknown>
    ) => originalCriticalSection(businessContext, caseId, target, (current, scope, transactionalQueryable) => operation(
      current,
      {
        ...scope,
        insertDecisionAggregate: async (aggregate: any) => {
          entered();
          await continueDecision;
          return scope.insertDecisionAggregate(aggregate);
        }
      },
      transactionalQueryable
    ));

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
    name,
    expectedDecisionStatus,
    request,
    transform
  }) => {
    const { app, intakeStore, repository: recipeRepository, store } = buildHarness({ llmAdapter: revisionAdapter() });
    const source = await completeDraft("draft-mutation-decision-race");
    const draft = transform ? transform(source) : source;
    expect((await importDraft(store, draft)).statusCode).toBe(201);
    if (name === "Prepare") {
      await seedPlanningEvidenceForDraft(app, store, intakeStore, recipeRepository, draft);
    }

    const repository = productionDecisionRepositoryFor(store);
    const originalCriticalSection = repository.withTargetCriticalSection.bind(repository);
    let entered!: () => void;
    let release!: () => void;
    let pauseOnce = true;
    const mutationEntered = new Promise<void>((resolve) => { entered = resolve; });
    const continueMutation = new Promise<void>((resolve) => { release = resolve; });
    const pauseMutation = async (): Promise<void> => {
      if (!pauseOnce) return;
      pauseOnce = false;
      entered();
      await continueMutation;
    };
    repository.withTargetCriticalSection = (businessContext, target, operation) =>
      originalCriticalSection(businessContext, target, (scope) => operation({
        ...scope,
        setDraft: async (value) => {
          await pauseMutation();
          return scope.setDraft(value);
        }
      }));
    const originalPlanningCriticalSection = store.withPlanningEvidenceCriticalSection.bind(store);
    store.withPlanningEvidenceCriticalSection = (businessContext, caseId, draftId, draftRevision, operation) =>
      originalPlanningCriticalSection(
        businessContext,
        caseId,
        draftId,
        draftRevision,
        (scope) => operation({
          ...scope,
          setReviewDraft: async (value) => {
            await pauseMutation();
            return scope.setReviewDraft(value);
          },
          insertDraft: async (value) => {
            await pauseMutation();
            return scope.insertDraft(value);
          },
          commitPreparedDraft: async (sourceDraft, preparedDraft) => {
            await pauseMutation();
            return scope.commitPreparedDraft(sourceDraft, preparedDraft);
          }
        })
      );

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
    "after_plan_write",
    "after_purchase_list_write",
    "after_recipe_write",
    "before_manifest_publish",
    "after_manifest_publish",
    "after_case_cas",
    "after_result_event",
    "after_audit"
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
      await seedAcceptedEventSpec(intakeStore, draft);
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

  it.each([
    "after_plan_write",
    "after_purchase_list_write",
    "after_recipe_write",
    "after_manifest_publish",
    "after_case_cas",
    "after_result_event",
    "after_audit"
  ] as const)("does not invoke the %s hook on an idempotent Apply retry", async (faultPhase) => {
    let armed = false;
    let hookCalls = 0;
    const { app, intakeStore, store } = buildHarness({
      applyFaultInjector(phase) {
        if (phase !== faultPhase || !armed) return;
        hookCalls += 1;
        throw new Error(`post-write hook must not run for an idempotent retry: ${phase}`);
      }
    });
    const draft = await completeDraft(`draft-apply-idempotent-hook-${faultPhase}`);

    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      await seedAcceptedEventSpec(intakeStore, draft);
      const decision = await decide(app, draft.draftId, "approved");
      expect(decision.statusCode, decision.body).toBe(201);
      const approvedProductionSpecId = decision.json().approvedProductionSpec.approvedProductionSpecId;
      const applyUrl = `/v1/production/approved-specs/${approvedProductionSpecId}/apply`;

      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(200);
      armed = true;
      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(200);
      expect(hookCalls).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("rolls back Apply after its audit fault and retries with one authoritative audit", async () => {
    let auditFaultCalls = 0;
    const { app, auditLog, intakeStore, store } = buildHarness({
      applyFaultInjector(phase) {
        if (phase === "after_audit" && auditFaultCalls === 0) {
          auditFaultCalls += 1;
          throw new Error("injected after apply audit publication");
        }
      }
    });
    const firstActorHeaders = {
      "x-catering-actor-name": "PRODUKTIONS-MITARBEITER",
      "x-catering-trusted-secret": TRUSTED_SECRET
    };
    const retryActorHeaders = headers;
    const draft = await completeDraft("draft-apply-audit-first-actor");

    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      await seedAcceptedEventSpec(intakeStore, draft);
      const decision = await app.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/decision`,
        headers: firstActorHeaders,
        payload: { decision: "approved" }
      });
      expect(decision.statusCode, decision.body).toBe(201);
      const approvedProductionSpecId = decision.json().approvedProductionSpec.approvedProductionSpecId;
      const applyUrl = `/v1/production/approved-specs/${approvedProductionSpecId}/apply`;
      const auditsBeforeApply = await auditLog.listRecentFor(context, 100);

      expect((await app.inject({ method: "POST", url: applyUrl, headers: firstActorHeaders })).statusCode).toBe(500);
      expect(auditFaultCalls).toBe(1);
      expect(await store.getApplyManifest(context, approvedProductionSpecId)).toBeUndefined();
      expect(await auditLog.listRecentFor(context, 100)).toEqual(auditsBeforeApply);

      expect((await app.inject({ method: "POST", url: applyUrl, headers: retryActorHeaders })).statusCode).toBe(200);
      const applyAudits = (await auditLog.listRecentFor(context, 100))
        .filter((entry) => entry.action === "production.approved_spec_applied");
      const manifest = await store.getApplyManifest(context, approvedProductionSpecId);

      expect(manifest?.appliedBy).toEqual({
        name: "Produktions-Mitarbeiter",
        source: "trusted-proxy:x-catering-actor-name"
      });
      expect(applyAudits).toHaveLength(1);
      expect(applyAudits[0].actor).toEqual(manifest?.appliedBy);
      expect(applyAudits[0].at).toBe(manifest?.appliedAt);
    } finally {
      await app.close();
    }
  });

  it("rolls back Apply when the audit is linked before its File post-publish fault", async () => {
    let auditFaultCalls = 0;
    let armed = false;
    const { app, auditLog, intakeStore, repository, store } = buildHarness({
      auditFileFaultInjector(phase) {
        if (armed && phase === "after_record_publish" && auditFaultCalls === 0) {
          auditFaultCalls += 1;
          throw new Error("injected after Apply audit File publication");
        }
      }
    });
    const draft = await completeDraft("draft-apply-audit-file-post-publish");

    try {
      expect((await importDraft(store, draft)).statusCode).toBe(201);
      await seedAcceptedEventSpec(intakeStore, draft);
      const decision = await decide(app, draft.draftId, "approved");
      expect(decision.statusCode, decision.body).toBe(201);
      const approvedProductionSpecId = decision.json().approvedProductionSpec.approvedProductionSpecId;
      const applyUrl = `/v1/production/approved-specs/${approvedProductionSpecId}/apply`;
      const caseId = await store.findCaseIdForArtifact(context, draft.draftId);
      if (!caseId) throw new Error("Kanonischer Test-Draft besitzt keinen Case.");
      const before = {
        plans: await store.listPlans(context),
        purchaseLists: await store.listPurchaseLists(context),
        recipes: await repository.list(context),
        manifest: await store.getApplyManifest(context, approvedProductionSpecId),
        case: await store.getCase(context, caseId),
        events: await store.listEvents(context, caseId),
        audits: await auditLog.listRecentFor(context, 100)
      };
      armed = true;

      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(500);
      expect(auditFaultCalls).toBe(1);
      expect({
        plans: await store.listPlans(context),
        purchaseLists: await store.listPurchaseLists(context),
        recipes: await repository.list(context),
        manifest: await store.getApplyManifest(context, approvedProductionSpecId),
        case: await store.getCase(context, caseId),
        events: await store.listEvents(context, caseId),
        audits: await auditLog.listRecentFor(context, 100)
      }).toEqual(before);

      expect((await app.inject({ method: "POST", url: applyUrl, headers })).statusCode).toBe(200);
      const applyAudits = (await auditLog.listRecentFor(context, 100))
        .filter((entry) => entry.action === "production.approved_spec_applied");
      expect(applyAudits).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("applies only the immutable approved snapshot and removes draft apply", async () => {
    const { app, intakeStore, store } = buildHarness();
    const draft = await completeDraft("draft-immutable");
    try {
      const imported = await importDraft(store, draft);
      expect(imported.statusCode, imported.body).toBe(201);
      await seedAcceptedEventSpec(intakeStore, draft);
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
