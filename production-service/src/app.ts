import Fastify, { type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import {
  extractTextFromDocument,
  getDemoProductionSpecs,
  parseUploadedRecipeText,
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
  dataRoot?: string;
  databaseUrl?: string;
  pgPool?: Queryable;
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

  const app = Fastify({
    logger: false
  });

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    const [plans, purchaseLists, recipes] = await Promise.all([
      store.listPlans(),
      store.listPurchaseLists(),
      repository.list()
    ]);

    return reply.send({
      service: "production-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        productionPlans: plans.length,
        purchaseLists: purchaseLists.length,
        recipes: recipes.length
      }
    });
  });

  app.post<{ Body: { eventSpec: AcceptedEventSpec } }>("/v1/production/plans", async (request, reply) => {
    const eventSpec = validateAcceptedEventSpec(request.body.eventSpec);
    const artifacts = await buildProductionArtifacts(eventSpec, discoveryService);
    await store.savePlan(artifacts.productionPlan);
    await store.savePurchaseList(artifacts.purchaseList);
    return reply.code(201).send(artifacts);
  });

  app.post("/v1/production/seed-demo", async (_request, reply) => {
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
      return reply.code(404).send({ message: "ProductionPlan not found." });
    }

    return reply.send(plan);
  });

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/production/purchase-lists/:purchaseListId",
    async (request, reply) => {
      const list = await store.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList not found." });
      }

      return reply.send(list);
    }
  );

  app.get("/v1/production/purchase-lists", async (_request, reply) => {
    return reply.send({
      items: await store.listPurchaseLists()
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
      return reply.code(404).send({ message: "Recipe not found." });
    }

    return reply.send(recipe);
  });

  app.post<{ Body: RecipeTextImportBody }>("/v1/production/recipes/import-text", async (request, reply) => {
    const recipe = parseUploadedRecipeText(request.body);
    await repository.save(recipe);
    return reply.code(201).send({ recipe });
  });

  app.post("/v1/production/recipes/upload", async (request, reply) => {
    const payload = await recipeImportFromMultipart(request);
    const recipe = parseUploadedRecipeText(payload);
    await repository.save(recipe);
    return reply.code(201).send({ recipe });
  });

  return app;
}
