import Fastify from "fastify";
import { OfferStore } from "@catering/offer-service";
import { ProductionStore } from "@catering/production-service";
import type {
  CollectionStorageOptions,
  OfferDraft,
  ProductionPlan,
  PurchaseList
} from "@catering/shared-core";
import {
  resolveMinimalMvpRoleFromTrustedActor,
  trustedActorFromHeaders
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

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function renderSourceAnchorsSection(record: Record<string, unknown>): string[] {
  const sourceAnchors = Array.isArray(record.sourceAnchors) ? record.sourceAnchors : [];
  const rows = sourceAnchors.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const anchor = item as Record<string, unknown>;
    const filename = String(anchor.filename ?? "").trim();
    const mimeType = String(anchor.mimeType ?? "").trim();
    const sizeBytes = anchor.sizeBytes;
    const sha256Short = String(anchor.sha256Short ?? "").trim();
    const uploadContext = String(anchor.uploadContext ?? "").trim();
    const ingestedAt = String(anchor.ingestedAt ?? "").trim();

    if (!filename || !mimeType || typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || !sha256Short || !uploadContext) {
      return [];
    }

    return [
      [filename, mimeType, formatBytes(sizeBytes), `sha256:${sha256Short.slice(0, 12)}`, uploadContext, ingestedAt]
        .filter(Boolean)
        .join(" · ")
    ];
  });

  if (rows.length === 0) {
    return [];
  }

  return [`<section><h2>Quellenanker</h2><ul>${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}</ul></section>`];
}

export function renderOfferHtml(draft: OfferDraft): string {
  const openQuestionsSection =
    draft.openQuestions.length > 0
      ? [
          `<section><h2>Offene Punkte</h2><ul>${draft.openQuestions
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul></section>`
        ]
      : ["<p>Offene Punkte: keine</p>"];

  return [
    "<html><body>",
    `<h1>Angebot ${escapeHtml(draft.draftId)}</h1>`,
    `<p>${escapeHtml(draft.eventSummary)}</p>`,
    `<p>Varianten: ${draft.variantSet.length}</p>`,
    `<p>Offene Punkte: ${draft.openQuestions.length}</p>`,
    ...openQuestionsSection,
    "<ul>",
    ...draft.serviceModules.map((module) => `<li>${escapeHtml(module.label)}</li>`),
    "</ul>",
    `<p>Gesamt: ${draft.pricingSummary.subtotal.amount.toFixed(2)} ${escapeHtml(draft.pricingSummary.subtotal.currency)}</p>`,
    "<pre>",
    escapeHtml(draft.customerFacingText),
    "</pre>",
    "</body></html>"
  ].join("");
}

export function renderProductionPlanHtml(plan: ProductionPlan): string {
  const unresolvedSection =
    plan.unresolvedItems.length > 0
      ? [`<section><h2>Offene Punkte</h2><ul>${plan.unresolvedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`]
      : [];
  return [
    "<html><body>",
    `<h1>Produktionsplan ${escapeHtml(plan.planId)}</h1>`,
    `<p>Status: ${escapeHtml(plan.readiness.status)}</p>`,
    `<p>Rezeptauswahl: ${plan.recipeSelections.length}</p>`,
    ...renderSourceAnchorsSection(plan as unknown as Record<string, unknown>),
    ...unresolvedSection,
    ...plan.productionBatches.map(
      (batch) =>
        `<section><h2>${escapeHtml(batch.componentId)}</h2><p>Station: ${escapeHtml(batch.station)}</p><ol>${batch.steps
          .map((step) => `<li>${escapeHtml(step.instruction)}</li>`)
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

export interface PrintExportAppOptions extends CollectionStorageOptions {
  trustedActorSecret?: string;
}

function actorForRequest(
  request: { headers: Record<string, string | string[] | undefined> },
  fallbackActorName: string,
  trustedActorSecret?: string
) {
  return trustedActorFromHeaders(request.headers, {
    fallbackActorName,
    trustedActorSecret
  });
}

function isOfferOperator(request: { headers: Record<string, string | string[] | undefined> }, trustedActorSecret?: string): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, "Angebots-Mitarbeiter", trustedActorSecret)
  ) === "offer_operator";
}

function isProductionOperator(request: { headers: Record<string, string | string[] | undefined> }, trustedActorSecret?: string): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, "Produktions-Mitarbeiter", trustedActorSecret)
  ) === "production_operator";
}

function requireOfferOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  trustedActorSecret?: string
): unknown | undefined {
  if (!isOfferOperator(request, trustedActorSecret)) {
    return reply.code(403).send({
      message: "Angebots-Operator erforderlich."
    });
  }

  return undefined;
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

export function buildPrintExportApp(options: PrintExportAppOptions = {}) {
  const trustedActorSecret = options.trustedActorSecret ?? process.env.CATERING_TRUSTED_ACTOR_SECRET;
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
      const forbidden = requireOfferOperator(request, reply, trustedActorSecret);
      if (forbidden) {
        return forbidden;
      }

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
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
      if (forbidden) {
        return forbidden;
      }

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
    "/v1/exports/purchase-lists/:purchaseListId/csv",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret);
      if (forbidden) {
        return forbidden;
      }

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
