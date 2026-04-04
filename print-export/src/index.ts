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

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export function renderPurchaseListHtml(list: PurchaseList): string {
  const groupedItems = new Map<string, PurchaseList["items"]>();

  for (const item of list.items) {
    const groupItems = groupedItems.get(item.group) ?? [];
    groupItems.push(item);
    groupedItems.set(item.group, groupItems);
  }

  const sections = [...groupedItems.entries()].map(
    ([group, items]) => `
      <section>
        <h2>${escapeHtml(group)}</h2>
        <table>
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Menge</th>
              <th>Einkauf</th>
              <th>Lieferhinweis</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
                  <tr>
                    <td>${escapeHtml(item.displayName)}</td>
                    <td>${escapeHtml(item.normalizedQty)} ${escapeHtml(item.normalizedUnit)}</td>
                    <td>${escapeHtml(item.purchaseQty)} ${escapeHtml(item.purchaseUnit)}</td>
                    <td>${escapeHtml(item.supplierHint ?? "-")}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>
    `
  );

  return [
    "<html><head><meta charset=\"utf-8\" /><title>Einkaufsliste</title><style>",
    "body{font-family:Arial,sans-serif;margin:32px;color:#1f2937;}",
    "h1,h2{margin:0 0 12px;}",
    "p{margin:4px 0 16px;}",
    "section{margin-top:24px;break-inside:avoid;}",
    "table{width:100%;border-collapse:collapse;font-size:14px;}",
    "th,td{border-bottom:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top;}",
    "thead th{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#4b5563;}",
    ".meta{color:#6b7280;font-size:13px;}",
    "</style></head><body>",
    `<h1>Einkaufsliste ${escapeHtml(list.purchaseListId)}</h1>`,
    `<p class="meta">Vorgang: ${escapeHtml(list.eventSpecId)} · Positionen: ${escapeHtml(list.totals.itemCount)}</p>`,
    ...sections,
    "</body></html>"
  ].join("");
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

  app.get("/health", async (_request, reply) => {
    const [offerDrafts, productionPlans, purchaseLists] = await Promise.all([
      offerStore.listDrafts(),
      productionStore.listPlans(),
      productionStore.listPurchaseLists()
    ]);

    return reply.send({
      service: "print-export",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        offerDrafts: offerDrafts.length,
        productionPlans: productionPlans.length,
        purchaseLists: purchaseLists.length
      }
    });
  });

  app.get<{ Params: { draftId: string } }>(
    "/v1/exports/offers/:draftId/html",
    async (request, reply) => {
      const draft = await offerStore.getDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
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
        return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
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
    "/v1/exports/purchase-lists/:purchaseListId/html",
    async (request, reply) => {
      const list = await productionStore.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList nicht gefunden." });
      }

      reply.header(
        "content-disposition",
        `inline; filename="${request.params.purchaseListId}.html"`
      );
      return reply
        .type("text/html; charset=utf-8")
        .send(renderPurchaseListHtml(list));
    }
  );

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/exports/purchase-lists/:purchaseListId/csv",
    async (request, reply) => {
      const list = await productionStore.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList nicht gefunden." });
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
