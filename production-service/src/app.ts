import Fastify, { type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import {
  AuditLogStore,
  createUploadSourceMetadata,
  extractTextFromDocument,
  getDemoProductionSpecs,
  parseUploadedRecipeText,
  resolveMinimalMvpRoleFromTrustedActor,
  trustedActorFromHeaders,
  multipartLimitsForUpload,
  readLimitedUploadBuffer,
  uploadErrorResponse,
  validateAcceptedEventSpec,
  validateUploadedDocument,
  validateUploadedDocumentMetadata,
  type AcceptedEventSpec,
  type Queryable,
  type RecipeSearchQuery,
  type WebRecipeCandidate
} from "@catering/shared-core";
import { DuckDuckGoRecipeSearchProvider } from "./recipe-discovery/duckduckgo-provider.js";
import type { WebRecipeSearchProvider } from "./recipe-discovery/provider.js";
import { RecipeDiscoveryService } from "./recipe-discovery/service.js";
import { InMemoryRecipeRepository } from "./repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "./repositories/production-store.js";
import { buildProductionArtifacts } from "./rules/planning.js";

interface RecipeTextImportBody {
  text: string;
  filename?: string;
  recipeName?: string;
  sourceRef?: string;
  sourceMetadata?: ReturnType<typeof createUploadSourceMetadata>;
}

interface RecipeReviewBody {
  decision: "approve" | "verify" | "reject";
  note?: string;
}

function isOperationsAuditOperator(request: { headers: Record<string, string | string[] | undefined> }, trustedActorSecret?: string): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request, trustedActorSecret)) === "operations_audit_operator";
}

function multipartFieldValue(
  fields: Record<string, unknown>,
  fieldName: string
): string | undefined {
  const field = fields[fieldName] as { value?: string } | Array<{ value?: string }> | undefined;
  if (Array.isArray(field)) {
    return field[0]?.value;
  }

  return field?.value;
}

async function recipeImportFromMultipart(
  request: FastifyRequest
): Promise<RecipeTextImportBody> {
  const multipartRequest = request as FastifyRequest & {
    isMultipart: () => boolean;
    file: (options?: { limits?: { fileSize?: number; files?: number; fields?: number; parts?: number } }) => Promise<
      | {
          filename: string;
          mimetype: string;
          fields: Record<string, unknown>;
          file: AsyncIterable<Buffer | Uint8Array>;
          toBuffer: () => Promise<Buffer>;
        }
      | undefined
    >;
  };

  if (!multipartRequest.isMultipart()) {
    throw new Error("Expected multipart upload.");
  }

  const file = await multipartRequest.file({ limits: multipartLimitsForUpload("recipe") });
  if (!file) {
    throw new Error("No recipe file provided.");
  }

  validateUploadedDocumentMetadata({ filename: file.filename, mimeType: file.mimetype });
  const content = await readLimitedUploadBuffer(file.file, "recipe");
  const document = {
    filename: file.filename,
    mimeType: file.mimetype,
    content
  };
  validateUploadedDocument(document, "recipe");
  const text = await extractTextFromDocument(document);

  return {
    text,
    filename: file.filename,
    recipeName: multipartFieldValue(file.fields, "recipeName"),
    sourceRef: multipartFieldValue(file.fields, "sourceRef"),
    sourceMetadata: createUploadSourceMetadata({
      filename: file.filename,
      mimeType: file.mimetype,
      content,
      uploadContext: "production"
    })
  };
}

export interface ProductionAppOptions {
  repository?: InMemoryRecipeRepository;
  discoveryService?: RecipeDiscoveryService;
  store?: ProductionStore;
  auditLog?: AuditLogStore;
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

function actorForRequest(request: { headers: Record<string, string | string[] | undefined> }, trustedActorSecret?: string) {
  return trustedActorFromHeaders(request.headers, {
    fallbackActorName: "Produktions-Mitarbeiter",
    trustedActorSecret
  });
}

function isProductionOperator(request: { headers: Record<string, string | string[] | undefined> }, trustedActorSecret?: string): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request, trustedActorSecret)) === "production_operator";
}

function requireProductionOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  trustedActorSecret?: string
): unknown | undefined {
  if (!isProductionOperator(request, trustedActorSecret)) {
    return reply.code(403).send({
      message: "Produktions-Operator erforderlich."
    });
  }

  return undefined;
}

export function buildProductionApp(options: ProductionAppOptions = {}) {
  const env = options.env ?? process.env;
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
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
  const auditLog =
    options.auditLog ??
    new AuditLogStore({
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });

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

  app.post<{ Body: { eventSpec: AcceptedEventSpec } }>("/v1/production/plans", async (request, reply) => {
    if (!isProductionOperator(request, trustedActorSecret)) {
      return reply.code(403).send({
        message: "Produktions-Operator erforderlich."
      });
    }

    const eventSpec = validateAcceptedEventSpec(request.body.eventSpec);
    const artifacts = await buildProductionArtifacts(eventSpec, discoveryService);
    await store.savePlan(artifacts.productionPlan);
    await store.savePurchaseList(artifacts.purchaseList);
    await auditLog.log({
      action: "production.plan_created",
      entityType: "ProductionPlan",
      entityId: artifacts.productionPlan.planId,
      actor: actorForRequest(request, trustedActorSecret),
      summary: `Produktionsplan fuer ${eventSpec.specId} erstellt.`,
      details: {
        specId: eventSpec.specId,
        purchaseListId: artifacts.purchaseList.purchaseListId,
        readiness: artifacts.productionPlan.readiness.status,
        recipeSelections: artifacts.productionPlan.recipeSelections.length
      }
    });
    return reply.code(201).send(artifacts);
  });

  app.post("/v1/production/seed-demo", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret)) {
      return reply.code(403).send({
        message: "Betriebs-/Audit-Operator erforderlich."
      });
    }

    const seeded = [];
    for (const spec of getDemoProductionSpecs()) {
      const artifacts = await buildProductionArtifacts(spec, discoveryService);
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
      actor: actorForRequest(request, trustedActorSecret),
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

  app.get("/v1/production/plans", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPlans()
    });
  });

  app.get<{ Params: { planId: string } }>("/v1/production/plans/:planId", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
    if (forbidden) {
      return forbidden;
    }

    const plan = await store.getPlan(request.params.planId);
    if (!plan) {
      return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
    }

    return reply.send(plan);
  });

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/production/purchase-lists/:purchaseListId",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
      if (forbidden) {
        return forbidden;
      }

      const list = await store.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList nicht gefunden." });
      }

      return reply.send(list);
    }
  );

  app.get("/v1/production/purchase-lists", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPurchaseLists()
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/v1/production/audit/events", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret)) {
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

  app.get("/v1/production/recipes", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await repository.list()
    });
  });

  app.get<{ Params: { recipeId: string } }>("/v1/production/recipes/:recipeId", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
    if (forbidden) {
      return forbidden;
    }

    const recipe = await repository.get(request.params.recipeId);
    if (!recipe) {
      return reply.code(404).send({ message: "Rezept nicht gefunden." });
    }

    return reply.send(recipe);
  });

  app.post<{ Body: RecipeTextImportBody }>("/v1/production/recipes/import-text", async (request, reply) => {
    if (!isProductionOperator(request, trustedActorSecret)) {
      return reply.code(403).send({
        message: "Produktions-Operator erforderlich."
      });
    }

    const recipe = parseUploadedRecipeText(request.body);
    await repository.save(recipe);
    await auditLog.log({
      action: "recipe.imported_text",
      entityType: "Recipe",
      entityId: recipe.recipeId,
      actor: actorForRequest(request, trustedActorSecret),
      summary: `Rezepttext in gemeinsame Bibliothek importiert: ${recipe.name}.`,
      details: {
        recipeName: recipe.name,
        sourceTier: recipe.source.tier,
        approvalState: recipe.source.approvalState
      }
    });
    return reply.code(201).send({ recipe });
  });

  app.post("/v1/production/recipes/upload", async (request, reply) => {
    if (!isProductionOperator(request, trustedActorSecret)) {
      return reply.code(403).send({
        message: "Produktions-Operator erforderlich."
      });
    }

    try {
      const payload = await recipeImportFromMultipart(request);
      const recipe = parseUploadedRecipeText(payload);
      await repository.save(recipe);
      await auditLog.log({
        action: "recipe.uploaded_file",
        entityType: "Recipe",
        entityId: recipe.recipeId,
        actor: actorForRequest(request, trustedActorSecret),
        summary: `Rezeptdatei in gemeinsame Bibliothek hochgeladen: ${recipe.name}.`,
        details: {
          recipeName: recipe.name,
          filename: payload.filename,
          sourceTier: recipe.source.tier,
          approvalState: recipe.source.approvalState
        }
      });
      return reply.code(201).send({ recipe });
    } catch (error) {
      const uploadError = uploadErrorResponse(error);
      return reply.code(uploadError.statusCode).send({ message: uploadError.message });
    }
  });

  app.patch<{ Params: { recipeId: string }; Body: RecipeReviewBody }>(
    "/v1/production/recipes/:recipeId/review",
    async (request, reply) => {
      if (!isProductionOperator(request, trustedActorSecret)) {
        return reply.code(403).send({
          message: "Produktions-Operator erforderlich."
        });
      }

      const recipe = await repository.reviewRecipe(request.params.recipeId, request.body);
      await auditLog.log({
        action: "recipe.reviewed",
        entityType: "Recipe",
        entityId: recipe.recipeId,
        actor: actorForRequest(request, trustedActorSecret),
        summary: `Rezept ${recipe.name} ueber den Produktions-Workflow geprueft.`,
        details: {
          decision: request.body.decision,
          approvalState: recipe.source.approvalState,
          sourceTier: recipe.source.tier
        }
      });
      return reply.send({ recipe });
    }
  );

  return app;
}
