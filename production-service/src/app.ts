import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  AuditLogStore,
  buildByoLlmAdapterFromEnv,
  createTrustedActorResolver,
  getDemoProductionSpecs,
  hostedMultiBusinessReady,
  isDevAuthEnabled,
  resolveMinimalMvpRoleFromTrustedActor,
  type LlmReadinessProviderAdapter,
  type LlmReadinessDataMode,
  type Queryable,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";
import { IntakeStore } from "@catering/intake-service";
import { DuckDuckGoRecipeSearchProvider } from "./recipe-discovery/duckduckgo-provider.js";
import type { WebRecipeSearchProvider } from "./recipe-discovery/provider.js";
import { RecipeDiscoveryService } from "./recipe-discovery/service.js";
import { InMemoryRecipeRepository } from "./repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "./repositories/production-store.js";
import { buildProductionArtifacts } from "./rules/planning.js";
import { registerProductionArtifactRoutes } from "./routes/artifact-routes.js";
import { registerProductionRecipeRoutes } from "./routes/recipe-routes.js";

export interface ProductionAppOptions {
  repository?: InMemoryRecipeRepository;
  discoveryService?: RecipeDiscoveryService;
  store?: ProductionStore;
  intakeStore?: IntakeStore;
  auditLog?: AuditLogStore;
  llmAdapter?: LlmReadinessProviderAdapter;
  buildLlmAdapter?: () => LlmReadinessProviderAdapter;
  dataRoot?: string;
  databaseUrl?: string;
  pgPool?: Queryable;
  trustedActorSecret?: string;
  env?: Record<string, string | undefined>;
}

class DisabledWebRecipeSearchProvider implements WebRecipeSearchProvider {
  async searchRecipes(_query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    return [];
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
    new InMemoryRecipeRepository(undefined, {
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
  const intakeStore =
    options.intakeStore ??
    new IntakeStore({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const auditLog =
    options.auditLog ??
    new AuditLogStore({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const buildLlmAdapter =
    options.buildLlmAdapter ??
    (options.llmAdapter
      ? () => options.llmAdapter as LlmReadinessProviderAdapter
      : () => buildByoLlmAdapterFromEnv(env));

  const app = Fastify({
    logger: false
  });

  app.addHook("onRequest", async (request) => {
    if (request.url.split("?", 1)[0] !== "/health") actorForRequest(request);
  });

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    if (hosted) {
      return reply.send({ service: "production-service", status: "ok", timestamp: new Date().toISOString() });
    }
    const [plans, purchaseLists, recipes, auditEvents] = await Promise.all([
      store.listPlans(),
      store.listPurchaseLists(),
      repository.list(),
      auditLog.countFor(defaultBusinessContext)
    ]);

    return reply.send({
      service: "production-service",
      status: "ok",
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
    intakeStore,
    repository,
    discoveryService,
    auditLog,
    buildLlmAdapter,
    productionDraftDataMode,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  });

  app.post("/v1/production/seed-demo", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Betriebs-/Audit-Operator erforderlich."
      });
    }

    const seeded = [];
    for (const spec of getDemoProductionSpecs()) {
      const artifacts = await buildProductionArtifacts(spec, discoveryService);
      await intakeStore.saveSpec(spec);
      await store.savePlan(artifacts.productionPlan);
      await store.savePurchaseList(artifacts.purchaseList);
      seeded.push({
        specId: spec.specId,
        planId: artifacts.productionPlan.planId,
        purchaseListId: artifacts.purchaseList.purchaseListId
      });
    }
    await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
      action: "production.seed_demo",
      entityType: "SeedBatch",
      entityId: `production-demo-${Date.now()}`,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: `${seeded.length} Produktions-Demoplaene angelegt.`,
      details: {
        seededCount: seeded.length
      }
    });

    return reply.code(201).send({
      seeded,
      counts: {
        productionPlans: (await store.listPlans()).length,
        purchaseLists: (await store.listPurchaseLists()).length
      }
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/v1/production/audit/events", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Betriebs-/Audit-Operator erforderlich."
      });
    }

    const limit = Number(request.query.limit ?? "50");
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.trunc(limit)))
      : 50;
    return reply.send({
      items: await auditLog.listRecentFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), safeLimit)
    });
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

  return app;
}
