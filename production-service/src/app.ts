import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  AuditLogStore,
  buildByoLlmAdapterFromEnv,
  getDemoProductionSpecs,
  isDevAuthEnabled,
  resolveMinimalMvpRoleFromTrustedActor,
  trustedActorFromHeaders,
  type LlmReadinessProviderAdapter,
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

function isOperationsAuditOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, trustedActorSecret, allowDevActorHeader)
  ) === "operations_audit_operator";
}

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

function defaultWebRecipeSearchProvider(env: Record<string, string | undefined>): WebRecipeSearchProvider {
  if (isWebRecipeSearchEnabled(env)) {
    return new DuckDuckGoRecipeSearchProvider();
  }

  return new DisabledWebRecipeSearchProvider();
}

function actorForRequest(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
) {
  return trustedActorFromHeaders(request.headers, {
    fallbackActorName: "Produktions-Mitarbeiter",
    trustedActorSecret,
    allowDevActorHeader
  });
}

function isProductionOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, trustedActorSecret, allowDevActorHeader)
  ) === "production_operator";
}

function requireProductionOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): unknown | undefined {
  if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
    return reply.code(403).send({
      message: "Produktions-Operator erforderlich."
    });
  }

  return undefined;
}

export function buildProductionApp(options: ProductionAppOptions = {}) {
  const env = options.env ?? process.env;
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
  const allowDevActorHeader = isDevAuthEnabled(env);
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

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    const [plans, purchaseLists, recipes, auditEvents] = await Promise.all([
      store.listPlans(),
      store.listPurchaseLists(),
      repository.list(),
      auditLog.count()
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
    await auditLog.log({
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
      items: await auditLog.listRecent(safeLimit)
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
