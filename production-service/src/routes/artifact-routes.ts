import type { FastifyInstance } from "fastify";
import {
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type AuditLogStore,
  type TrustedActor
} from "@catering/shared-core";
import type { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import type { ProductionStore } from "../repositories/production-store.js";
import { buildProductionArtifacts } from "../rules/planning.js";

export interface ProductionArtifactRouteDependencies {
  store: ProductionStore;
  discoveryService: RecipeDiscoveryService;
  auditLog: AuditLogStore;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  isProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  requireProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => unknown | undefined;
  actorForRequest: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => TrustedActor;
}

export function registerProductionArtifactRoutes(
  app: FastifyInstance,
  deps: ProductionArtifactRouteDependencies
) {
  const {
    store,
    discoveryService,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  } = deps;

  app.post<{ Body: { eventSpec: AcceptedEventSpec } }>("/v1/production/plans", async (request, reply) => {
    if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
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
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
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

  app.get("/v1/production/plans", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPlans()
    });
  });

  app.get<{ Params: { planId: string } }>("/v1/production/plans/:planId", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
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
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
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
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPurchaseLists()
    });
  });
}
