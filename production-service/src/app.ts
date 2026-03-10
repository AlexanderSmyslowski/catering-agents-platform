import Fastify from "fastify";
import { validateAcceptedEventSpec, type AcceptedEventSpec } from "@catering/shared-core";
import { DuckDuckGoRecipeSearchProvider } from "./recipe-discovery/duckduckgo-provider.js";
import { RecipeDiscoveryService } from "./recipe-discovery/service.js";
import { InMemoryRecipeRepository } from "./repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "./repositories/production-store.js";
import { buildProductionArtifacts } from "./rules/planning.js";

export interface ProductionAppOptions {
  repository?: InMemoryRecipeRepository;
  discoveryService?: RecipeDiscoveryService;
  store?: ProductionStore;
}

export function buildProductionApp(options: ProductionAppOptions = {}) {
  const repository = options.repository ?? new InMemoryRecipeRepository();
  const discoveryService =
    options.discoveryService ??
    new RecipeDiscoveryService(repository, new DuckDuckGoRecipeSearchProvider());
  const store = options.store ?? new ProductionStore();

  const app = Fastify({
    logger: false
  });

  app.post<{ Body: { eventSpec: AcceptedEventSpec } }>("/v1/production/plans", async (request, reply) => {
    const eventSpec = validateAcceptedEventSpec(request.body.eventSpec);
    const artifacts = await buildProductionArtifacts(eventSpec, discoveryService);
    store.savePlan(artifacts.productionPlan);
    store.savePurchaseList(artifacts.purchaseList);
    return reply.code(201).send(artifacts);
  });

  app.get<{ Params: { planId: string } }>("/v1/production/plans/:planId", async (request, reply) => {
    const plan = store.getPlan(request.params.planId);
    if (!plan) {
      return reply.code(404).send({ message: "ProductionPlan not found." });
    }

    return reply.send(plan);
  });

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/production/purchase-lists/:purchaseListId",
    async (request, reply) => {
      const list = store.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList not found." });
      }

      return reply.send(list);
    }
  );

  return app;
}

