import Fastify from "fastify";
import { OfferStore } from "@catering/offer-service";
import { ProductionStore } from "@catering/production-service";
import type {
  CollectionStorageOptions,
  OfferDraft,
  ProductionPlan,
  PurchaseList
} from "@catering/shared-core";

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function renderOfferHtml(draft: OfferDraft): string {
  return [
    "<html><body>",
    `<h1>Angebot ${draft.draftId}</h1>`,
    `<p>${draft.eventSummary}</p>`,
    "<ul>",
    ...draft.serviceModules.map((module) => `<li>${module.label}</li>`),
    "</ul>",
    `<p>Gesamt: ${draft.pricingSummary.subtotal.amount.toFixed(2)} ${draft.pricingSummary.subtotal.currency}</p>`,
    "<pre>",
    draft.customerFacingText,
    "</pre>",
    "</body></html>"
  ].join("");
}

export function renderProductionPlanHtml(plan: ProductionPlan): string {
  return [
    "<html><body>",
    `<h1>Produktionsplan ${plan.planId}</h1>`,
    `<p>Status: ${plan.readiness.status}</p>`,
    ...plan.productionBatches.map(
      (batch) =>
        `<section><h2>${batch.componentId}</h2><p>Station: ${batch.station}</p><ol>${batch.steps
          .map((step) => `<li>${step.instruction}</li>`)
          .join("")}</ol></section>`
    ),
    "</body></html>"
  ].join("");
}

export function renderPurchaseListCsv(list: PurchaseList): string {
  const header = [
    "group",
    "item",
    "normalizedQty",
    "normalizedUnit",
    "purchaseQty",
    "purchaseUnit",
    "supplierHint"
  ]
    .map(escapeCsv)
    .join(",");

  const rows = list.items.map((item) =>
    [
      item.group,
      item.displayName,
      item.normalizedQty,
      item.normalizedUnit,
      item.purchaseQty,
      item.purchaseUnit,
      item.supplierHint ?? ""
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [header, ...rows].join("\n");
}

export interface PrintExportAppOptions extends CollectionStorageOptions {}

export function buildPrintExportApp(options: PrintExportAppOptions = {}) {
  const app = Fastify({
    logger: false
  });
  const offerStore = new OfferStore({
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });
  const productionStore = new ProductionStore({
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });

  app.get<{ Params: { draftId: string } }>(
    "/v1/exports/offers/:draftId/html",
    async (request, reply) => {
      const draft = await offerStore.getDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "OfferDraft not found." });
      }

      reply.header(
        "content-disposition",
        `inline; filename="${request.params.draftId}.html"`
      );
      return reply
        .type("text/html; charset=utf-8")
        .send(renderOfferHtml(draft));
    }
  );

  app.get<{ Params: { planId: string } }>(
    "/v1/exports/production-plans/:planId/html",
    async (request, reply) => {
      const plan = await productionStore.getPlan(request.params.planId);
      if (!plan) {
        return reply.code(404).send({ message: "ProductionPlan not found." });
      }

      reply.header(
        "content-disposition",
        `inline; filename="${request.params.planId}.html"`
      );
      return reply
        .type("text/html; charset=utf-8")
        .send(renderProductionPlanHtml(plan));
    }
  );

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/exports/purchase-lists/:purchaseListId/csv",
    async (request, reply) => {
      const list = await productionStore.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList not found." });
      }

      reply.header(
        "content-disposition",
        `attachment; filename=\"${request.params.purchaseListId}.csv\"`
      );
      return reply
        .type("text/csv; charset=utf-8")
        .send(renderPurchaseListCsv(list));
    }
  );

  return app;
}
