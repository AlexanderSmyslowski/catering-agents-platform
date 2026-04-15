import Fastify, { type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import {
  actorNameFromHeaders,
  AuditLogStore,
  extractTextFromDocument,
  getDemoProductionSpecs,
  parseUploadedRecipeText,
  resolveMinimalMvpRoleFromActorName,
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type Queryable
} from "@catering/shared-core";
import { DuckDuckGoRecipeSearchProvider } from "./recipe-discovery/duckduckgo-provider.js";
import { RecipeDiscoveryService } from "./recipe-discovery/service.js";
import { InMemoryRecipeRepository } from "./repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "./repositories/production-store.js";
import { buildProductionArtifacts } from "./rules/planning.js";

interface RecipeTextImportBody {
  text: string;
  filename?: string;
  recipeName?: string;
  sourceRef?: string;
}

interface RecipeReviewBody {
  decision: "approve" | "verify" | "reject";
  note?: string;
}

function isOperationsAuditOperator(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  return resolveMinimalMvpRoleFromActorName(actorForRequest(request).name) === "operations_audit_operator";
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
    file: () => Promise<
      | {
          filename: string;
          mimetype: string;
          fields: Record<string, unknown>;
          toBuffer: () => Promise<Buffer>;
        }
      | undefined
    >;
  };

  if (!multipartRequest.isMultipart()) {
    throw new Error("Expected multipart upload.");
  }

  const file = await multipartRequest.file();
  if (!file) {
    throw new Error("No recipe file provided.");
  }

  const text = await extractTextFromDocument({
    filename: file.filename,
    mimeType: file.mimetype,
    content: await file.toBuffer()
  });

  return {
    text,
    filename: file.filename,
    recipeName: multipartFieldValue(file.fields, "recipeName"),
    sourceRef: multipartFieldValue(file.fields, "sourceRef")
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
}

function actorForRequest(request: { headers: Record<string, string | string[] | undefined> }) {
  return {
    name: actorNameFromHeaders(request.headers, "Produktions-Mitarbeiter"),
    source: request.headers["x-actor-name"] ? "header:x-actor-name" : "service-default"
  };
}

function isProductionOperator(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  return resolveMinimalMvpRoleFromActorName(actorForRequest(request).name) === "production_operator";
}

export function buildProductionApp(options: ProductionAppOptions = {}) {
  const repository =
    options.repository ??
    new InMemoryRecipeRepository(undefined, {
      rootDir: options.dataRoot,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const discoveryService =
    options.discoveryService ??
    new RecipeDiscoveryService(repository, new DuckDuckGoRecipeSearchProvider());
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
    const eventSpec = validateAcceptedEventSpec(request.body.eventSpec);
    const artifacts = await buildProductionArtifacts(eventSpec, discoveryService);
    await store.savePlan(artifacts.productionPlan);
    await store.savePurchaseList(artifacts.purchaseList);
    await auditLog.log({
      action: "production.plan_created",
      entityType: "ProductionPlan",
      entityId: artifacts.productionPlan.planId,
      actor: actorForRequest(request),
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
    if (!isOperationsAuditOperator(request)) {
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
      actor: actorForRequest(request),
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

  app.get("/v1/production/plans", async (_request, reply) => {
    return reply.send({
      items: await store.listPlans()
    });
  });

  app.get<{ Params: { planId: string } }>("/v1/production/plans/:planId", async (request, reply) => {
    const plan = await store.getPlan(request.params.planId);
    if (!plan) {
      return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
    }

    return reply.send(plan);
  });

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/production/purchase-lists/:purchaseListId",
    async (request, reply) => {
      const list = await store.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList nicht gefunden." });
      }

      return reply.send(list);
    }
  );

  app.get("/v1/production/purchase-lists", async (_request, reply) => {
    return reply.send({
      items: await store.listPurchaseLists()
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/v1/production/audit/events", async (request, reply) => {
    if (!isOperationsAuditOperator(request)) {
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

  app.get("/v1/production/recipes", async (_request, reply) => {
    return reply.send({
      items: await repository.list()
    });
  });

  app.get<{ Params: { recipeId: string } }>("/v1/production/recipes/:recipeId", async (request, reply) => {
    const recipe = await repository.get(request.params.recipeId);
    if (!recipe) {
      return reply.code(404).send({ message: "Rezept nicht gefunden." });
    }

    return reply.send(recipe);
  });

  app.post<{ Body: RecipeTextImportBody }>("/v1/production/recipes/import-text", async (request, reply) => {
    const recipe = parseUploadedRecipeText(request.body);
    await repository.save(recipe);
    await auditLog.log({
      action: "recipe.imported_text",
      entityType: "Recipe",
      entityId: recipe.recipeId,
      actor: actorForRequest(request),
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
    const payload = await recipeImportFromMultipart(request);
    const recipe = parseUploadedRecipeText(payload);
    await repository.save(recipe);
    await auditLog.log({
      action: "recipe.uploaded_file",
      entityType: "Recipe",
      entityId: recipe.recipeId,
      actor: actorForRequest(request),
      summary: `Rezeptdatei in gemeinsame Bibliothek hochgeladen: ${recipe.name}.`,
      details: {
        recipeName: recipe.name,
        filename: payload.filename,
        sourceTier: recipe.source.tier,
        approvalState: recipe.source.approvalState
      }
    });
    return reply.code(201).send({ recipe });
  });

  app.patch<{ Params: { recipeId: string }; Body: RecipeReviewBody }>(
    "/v1/production/recipes/:recipeId/review",
    async (request, reply) => {
      if (!isProductionOperator(request)) {
        return reply.code(403).send({
          message: "Produktions-Operator erforderlich."
        });
      }

      const recipe = await repository.reviewRecipe(request.params.recipeId, request.body);
      await auditLog.log({
        action: "recipe.reviewed",
        entityType: "Recipe",
        entityId: recipe.recipeId,
        actor: actorForRequest(request),
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
