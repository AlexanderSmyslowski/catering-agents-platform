import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  AuditLogStore,
  assertBusinessId,
  BoundaryGuardedLlmAdapter,
  buildBoundaryGuardedLlmAdapterFromEnv,
  loadByoLlmExternalProcessingApprovalFromEnv,
  createTrustedActorResolver,
  getDemoProductionSpecs,
  hostedMultiBusinessReady,
  internalRecipes,
  isDevAuthEnabled,
  resolveMinimalMvpRoleFromTrustedActor,
  type ByoLlmProviderDescriptor,
  type LlmReadinessProviderAdapter,
  type LlmReadinessDataMode,
  type Queryable,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";
import { DuckDuckGoRecipeSearchProvider } from "./recipe-discovery/duckduckgo-provider.js";
import type { WebRecipeSearchProvider } from "./recipe-discovery/provider.js";
import {
  RecipeDiscoveryService,
  type QuantityRecipeBridgeResolver
} from "./recipe-discovery/service.js";
import { InMemoryRecipeRepository } from "./repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "./repositories/production-store.js";
import { buildProductionArtifacts } from "./rules/planning.js";
import { registerProductionArtifactRoutes } from "./routes/artifact-routes.js";
import { registerProductionRecipeRoutes } from "./routes/recipe-routes.js";
import {
  registerProductionApprovalRoutes,
  type ProductionApplyFaultPhase,
  type ProductionDecisionFaultPhase
} from "./routes/approval-routes.js";
import type { ProductionHandoffReader } from "./ports/production-handoff-reader.js";
import { HttpProductionHandoffReader } from "./gateways/http-production-handoff-reader.js";
import { registerProductionCaseRoutes } from "./routes/case-routes.js";
import { registerProductionQuantityWorkflowRoutes } from "./routes/quantity-workflow-routes.js";
import { buildApprovedSnapshotQuantityRuntime } from "./quantity-workflow/default-runtime.js";
import { QuantityOverrideStore } from "./quantity-workflow/override-store.js";
import type { IntakeRecordsPort } from "./ports/intake-records-port.js";
import type { SourceDocumentReader } from "./ports/source-document-reader.js";
import { HttpIntakeRecordsPort } from "./gateways/http-intake-records-port.js";
import { HttpSourceDocumentReader } from "./gateways/http-source-document-reader.js";

const PRODUCTION_TARGET_LOCK_PROTOCOL = "canonical-v2";

export interface ProductionAppOptions {
  repository?: InMemoryRecipeRepository;
  discoveryService?: RecipeDiscoveryService;
  store?: ProductionStore;
  quantityOverrideStore?: QuantityOverrideStore;
  intakeRecords?: IntakeRecordsPort;
  sourceDocumentReader?: SourceDocumentReader;
  auditLog?: AuditLogStore;
  llmAdapter?: LlmReadinessProviderAdapter;
  buildLlmAdapter?: () => LlmReadinessProviderAdapter;
  llmProviderDescriptor?: ByoLlmProviderDescriptor;
  dataRoot?: string;
  databaseUrl?: string;
  pgPool?: Queryable;
  trustedActorSecret?: string;
  handoffReader?: ProductionHandoffReader;
  env?: Record<string, string | undefined>;
  productionDecisionFaultInjector?: (phase: ProductionDecisionFaultPhase) => void;
  productionApplyFaultInjector?: (phase: ProductionApplyFaultPhase) => void;
}

class DisabledWebRecipeSearchProvider implements WebRecipeSearchProvider {
  async searchRecipes(_query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    return [];
  }
}

class UnavailableIntakeRecordsPort implements IntakeRecordsPort {
  async getRequest() { return undefined; }
  async getSpec() { return undefined; }
  async insertSpec(): Promise<"created"> {
    throw new Error("Intake-Dienst ist nicht konfiguriert.");
  }
  async replaceSpec(): Promise<"updated"> {
    throw new Error("Intake-Dienst ist nicht konfiguriert.");
  }
}

export function isWebRecipeSearchEnabled(env: Record<string, string | undefined>): boolean {
  const value = env.CATERING_ENABLE_WEB_RECIPE_SEARCH?.trim().toLowerCase();
  return value === "1" || value === "true";
}

function productionDraftDataModeFromEnv(
  env: Record<string, string | undefined>
): LlmReadinessDataMode {
  const value = env.CATERING_PRODUCTION_DRAFT_DATA_MODE?.trim() || "synthetic_or_demo_only";
  if (value === "synthetic_or_demo_only" || value === "pseudonymized_approved") {
    return value;
  }

  throw new Error(
    'CATERING_PRODUCTION_DRAFT_DATA_MODE must be "synthetic_or_demo_only" or "pseudonymized_approved".'
  );
}

function defaultWebRecipeSearchProvider(env: Record<string, string | undefined>): WebRecipeSearchProvider {
  if (isWebRecipeSearchEnabled(env)) {
    return new DuckDuckGoRecipeSearchProvider();
  }

  return new DisabledWebRecipeSearchProvider();
}

export function buildProductionApp(options: ProductionAppOptions = {}) {
  const env = options.env ?? process.env;
  const defaultBusinessContext = { businessId: env.CATERING_DEFAULT_BUSINESS_ID ?? "local" };
  const hosted = env.CATERING_DEPLOYMENT_PROFILE === "hosted";
  if (hosted) assertBusinessId(defaultBusinessContext.businessId);
  if (hosted && !hostedMultiBusinessReady) {
    throw new Error("Hosted Multi-Business-Betrieb ist noch nicht bereit.");
  }
  const productionDraftDataMode = productionDraftDataModeFromEnv(env);
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
  const allowDevActorHeader = isDevAuthEnabled(env);
  const resolveActor = createTrustedActorResolver({
    fallbackActorName: "Produktions-Mitarbeiter", fallbackBusinessId: defaultBusinessContext.businessId, requireTrustedBusinessId: hosted, trustedActorSecret, allowDevActorHeader
  });
  const actorForRequest = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) => resolveActor(request);
  const isProductionOperator = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "production_operator";
  const requireProductionOperator = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    ..._ignored: unknown[]
  ): unknown | undefined => isProductionOperator(request)
    ? undefined
    : reply.code(403).send({ message: "Produktions-Operator erforderlich." });
  const isOperationsAuditOperator = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "operations_audit_operator";
  const repository =
    options.repository ??
    new InMemoryRecipeRepository({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const discoveryService =
    options.discoveryService ??
    new RecipeDiscoveryService(repository, defaultWebRecipeSearchProvider(env));
  const store =
    options.store ??
    new ProductionStore({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const quantityOverrideStore = options.quantityOverrideStore ?? new QuantityOverrideStore({
    rootDir: options.dataRoot,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });
  const intakeRecords = options.intakeRecords ?? (env.CATERING_INTAKE_SERVICE_URL
    ? new HttpIntakeRecordsPort({
        intakeServiceUrl: env.CATERING_INTAKE_SERVICE_URL,
        trustedServiceSecret: trustedActorSecret
      })
    : new UnavailableIntakeRecordsPort());
  const sourceDocumentReader = options.sourceDocumentReader ?? (env.CATERING_INTAKE_SERVICE_URL
    ? new HttpSourceDocumentReader({
        intakeServiceUrl: env.CATERING_INTAKE_SERVICE_URL,
        trustedServiceSecret: trustedActorSecret
      })
    : undefined);
  const auditLog =
    options.auditLog ??
    new AuditLogStore({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const injectedAdapter = options.buildLlmAdapter ?? (options.llmAdapter ? () => options.llmAdapter as LlmReadinessProviderAdapter : undefined);
  if (injectedAdapter && !options.llmProviderDescriptor) {
    throw new Error("Injected BYO LLM adapters require an explicit server-owned llmProviderDescriptor.");
  }
  const buildLlmAdapter = (): BoundaryGuardedLlmAdapter => injectedAdapter && options.llmProviderDescriptor
    ? new BoundaryGuardedLlmAdapter({
        descriptor: options.llmProviderDescriptor,
        delegate: injectedAdapter(),
        approvalResolver: () => loadByoLlmExternalProcessingApprovalFromEnv(env),
        env
      })
    : buildBoundaryGuardedLlmAdapterFromEnv(env);
  const handoffReader = options.handoffReader ?? (env.CATERING_OFFER_SERVICE_URL
    ? new HttpProductionHandoffReader({ offerServiceUrl: env.CATERING_OFFER_SERVICE_URL, trustedServiceSecret: trustedActorSecret })
    : undefined);

  const app = Fastify({ logger: false });
  const appWithBridgeResolver = app as typeof app & {
    setQuantityRecipeBridgeResolver: (resolver: QuantityRecipeBridgeResolver | undefined) => void;
  };
  appWithBridgeResolver.setQuantityRecipeBridgeResolver = (resolver) => {
    discoveryService.setQuantityRecipeBridgeResolver(resolver);
  };

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.split("?", 1)[0] === "/health") return;
    const actor = actorForRequest(request);
    if (!hosted && actor.businessId !== defaultBusinessContext.businessId) {
      return reply.code(403).send({ message: "Der vertrauenswürdige Betriebskontext passt nicht zum konfigurierten Betrieb dieses lokalen Dienstes." });
    }
  });

  app.register(multipart);

  registerProductionCaseRoutes(app, { store, handoffReader, trustedActorSecret, allowDevActorHeader, requireProductionOperator, actorForRequest });

  registerProductionQuantityWorkflowRoutes(app, {
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    requireProductionOperator,
    actorForRequest,
    persistConfirmedOverride: (actor, override) => quantityOverrideStore.save(actor, override),
    resolveRuntime: async (actor, caseId) => {
      const productionCase = await store.getCase(actor, caseId);
      if (!productionCase?.approvedProductionSpecId) return [];
      const approvedSpec = await store.getApprovedProductionSpec(actor, productionCase.approvedProductionSpecId);
      if (!approvedSpec) return [];
      const runtimes = await buildApprovedSnapshotQuantityRuntime({ actor, caseId, approvedSpec });
      return Promise.all(runtimes.map(async (runtime) => {
        const latest = await quantityOverrideStore.latestFor(actor, runtime.previewInput.eventSpecId, runtime.componentId);
        if (!latest) return runtime;
        const currentAuthority = {
          ...latest.newAuthority,
          decisionId: latest.overrideId,
          evidence: { kind: "operator_instruction" as const, reference: latest.overrideId },
          reviewStatus: "kitchen_review_required" as const,
          rationale: "Bestätigte Mengenänderung; Küchenfreigabe ausstehend."
        };
        return {
          ...runtime,
          revision: `${runtime.revision}:override:${latest.overrideId}`,
          projectionInput: {
            ...runtime.projectionInput,
            currentAuthority,
            purchaseRows: runtime.projectionInput.purchaseRows.map((row) => ({
              ...row,
              lineage: undefined
            }))
          },
          previewInput: { ...runtime.previewInput, currentAuthority }
        };
      }));
    }
  });

  app.get("/health", async (_request, reply) => {
    if (hosted) {
      return reply.send({
        service: "production-service",
        status: "ok",
        targetLockProtocol: PRODUCTION_TARGET_LOCK_PROTOCOL,
        startupToken: env.CATERING_PRODUCTION_START_TOKEN ?? null,
        timestamp: new Date().toISOString()
      });
    }
    const [plans, purchaseLists, recipes, auditEvents] = await Promise.all([
      store.listPlans(defaultBusinessContext),
      store.listPurchaseLists(defaultBusinessContext),
      repository.list(defaultBusinessContext),
      auditLog.countFor(defaultBusinessContext)
    ]);

    return reply.send({
      service: "production-service",
      status: "ok",
      targetLockProtocol: PRODUCTION_TARGET_LOCK_PROTOCOL,
      startupToken: env.CATERING_PRODUCTION_START_TOKEN ?? null,
      timestamp: new Date().toISOString(),
      counts: {
        productionPlans: plans.length,
        purchaseLists: purchaseLists.length,
        recipes: recipes.length,
        auditEvents
      }
    });
  });

  registerProductionArtifactRoutes(app, {
    store,
    intakeRecords,
    sourceDocumentReader,
    discoveryService,
    auditLog,
    buildLlmAdapter,
    productionDraftDataMode,
    handoffReader,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  });

  registerProductionApprovalRoutes(app, {
    store,
    intakeRecords,
    repository,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    requireProductionOperator,
    actorForRequest,
    decisionFaultInjector: options.productionDecisionFaultInjector,
    applyFaultInjector: options.productionApplyFaultInjector
  });

  app.post("/v1/production/seed-demo", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({ message: "Betriebs-/Audit-Operator erforderlich." });
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    await repository.seed(actor, internalRecipes);
    const seeded = [];
    for (const spec of getDemoProductionSpecs()) {
      const artifacts = await buildProductionArtifacts(spec, discoveryService, { context: actor });
      await intakeRecords.insertSpec(actor, spec);
      await store.savePlan(actor, artifacts.productionPlan);
      await store.savePurchaseList(actor, artifacts.purchaseList);
      seeded.push({ specId: spec.specId, planId: artifacts.productionPlan.planId, purchaseListId: artifacts.purchaseList.purchaseListId });
    }
    await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
      action: "production.seed_demo",
      entityType: "SeedBatch",
      entityId: `production-demo-${Date.now()}`,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: `${seeded.length} Produktions-Demoplaene angelegt.`,
      details: { seededCount: seeded.length }
    });

    return reply.code(201).send({
      seeded,
      counts: {
        productionPlans: (await store.listPlans(actor)).length,
        purchaseLists: (await store.listPurchaseLists(actor)).length
      }
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/v1/production/audit/events", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({ message: "Betriebs-/Audit-Operator erforderlich." });
    }

    const limit = Number(request.query.limit ?? "50");
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.trunc(limit))) : 50;
    return reply.send({ items: await auditLog.listRecentFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), safeLimit) });
  });

  registerProductionRecipeRoutes(app, {
    repository,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  });

  return appWithBridgeResolver;
}