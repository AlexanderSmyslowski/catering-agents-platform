import Fastify from "fastify";
import { IntakeStore } from "@catering/intake-service";
import { OfferStore } from "@catering/offer-service";
import { ProductionStore } from "@catering/production-service";
import type {
  CollectionStorageOptions,
  OfferDraft,
  ProductionPlan,
  PurchaseList,
  Recipe
} from "@catering/shared-core";
import {
  formatMetroGroupLabel,
  formatRecipeSourceEvidenceLabel,
  isDevAuthEnabled,
  RecipeLibrary,
  recipeSourceOriginLabel,
  recipeSourceReferenceLabel,
  resolveMinimalMvpRoleFromTrustedActor,
  trustedActorFromHeaders
} from "@catering/shared-core";
import { renderProductionFolderHtml } from "./production-folder.js";

export { renderProductionFolderHtml } from "./production-folder.js";

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
  const warningRows = sourceAnchors.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const anchor = item as Record<string, unknown>;
    const filename = String(anchor.filename ?? "").trim();
    const ingestionStatus = String(anchor.ingestionStatus ?? "").trim();
    const ingestionWarnings = Array.isArray(anchor.ingestionWarnings)
      ? anchor.ingestionWarnings.map((warning) => String(warning).trim()).filter(Boolean)
      : [];
    if (!filename || (!ingestionStatus && ingestionWarnings.length === 0)) {
      return [];
    }

    return [
      [
        filename,
        ingestionStatus ? `Status: ${ingestionStatus}` : undefined,
        ingestionWarnings.length > 0 ? `Warnungen: ${ingestionWarnings.join(",")}` : undefined
      ]
        .filter(Boolean)
        .join(" · ")
    ];
  });

  return [
    ...(rows.length > 0
      ? [`<section><h2>Quellenanker</h2><ul>${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}</ul></section>`]
      : []),
    ...(warningRows.length > 0
      ? [
          `<section><h2>Ingestion-Warnungen</h2><ul>${warningRows
            .map((row) => `<li>${escapeHtml(row)}</li>`)
            .join("")}</ul></section>`
        ]
      : [])
  ];
}

export function renderOfferHtml(draft: OfferDraft): string {
  const publishApproved = draft.reviewStatus?.publishApproved === true;
  const openQuestionsSection =
    draft.openQuestions.length > 0
      ? [
          `<section><h2>Offene Punkte</h2><ul>${draft.openQuestions
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul></section>`
        ]
      : ["<p>Offene Punkte: keine</p>"];
  const reviewStatusSection = publishApproved
    ? []
    : [
        "<section><h2>Interne Prüfung</h2>",
        "<p>Kundentext erst nach Publish-Freigabe exportieren.</p>",
        "<ul>",
        `<li>Preis: ${escapeHtml(draft.reviewStatus?.priceReviewStatus ?? "review_required")}</li>`,
        `<li>MwSt.: ${escapeHtml(draft.reviewStatus?.taxReviewStatus ?? "review_required")}</li>`,
        `<li>Allergene: ${escapeHtml(draft.reviewStatus?.allergenReviewStatus ?? "review_required")}</li>`,
        `<li>Hygiene/Temperatur: ${escapeHtml(
          draft.reviewStatus?.hygieneTemperatureReviewStatus ?? "review_required"
        )}</li>`,
        "</ul>",
        "</section>"
      ];
  const customerTextSection = publishApproved
    ? ["<pre>", escapeHtml(draft.customerFacingText), "</pre>"]
    : [];

  return [
    "<html><body>",
    "<h1>Angebot</h1>",
    `<p>${escapeHtml(draft.eventSummary)}</p>`,
    `<p>Varianten: ${draft.variantSet.length}</p>`,
    `<p>Offene Punkte: ${draft.openQuestions.length}</p>`,
    ...openQuestionsSection,
    "<ul>",
    ...draft.serviceModules.map((module) => `<li>${escapeHtml(module.label)}</li>`),
    "</ul>",
    `<p>Gesamt: ${draft.pricingSummary.subtotal.amount.toFixed(2)} ${escapeHtml(draft.pricingSummary.subtotal.currency)}</p>`,
    ...reviewStatusSection,
    ...customerTextSection,
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
    "<h1>Produktionsplan</h1>",
    `<p>Status: ${escapeHtml(plan.readiness.status)}</p>`,
    `<p>Rezeptauswahl: ${plan.recipeSelections.length}</p>`,
    ...renderSourceAnchorsSection(plan as unknown as Record<string, unknown>),
    ...unresolvedSection,
    ...plan.productionBatches.map(
      (batch) => {
        const kitchenSheet = plan.kitchenSheets.find((sheet) =>
          sheet.componentId === batch.componentId && sheet.recipeId === batch.recipeId
        );
        const sourceLabel = formatRecipeSourceEvidenceLabel(
          batch.recipeSource ?? kitchenSheet?.recipeSource,
          batch.recipeId
        );

        return `<section><h2>${escapeHtml(batch.componentId)}</h2><p>Station: ${escapeHtml(batch.station)}</p><p>Rezeptquelle: ${escapeHtml(sourceLabel)}</p><ol>${batch.steps
          .map((step) => `<li>${escapeHtml(step.instruction)}</li>`)
          .join("")}</ol></section>`;
      }
    ),
    "<footer>Arbeitsdokument – Mengen, Allergene und Preise vor Produktion prüfen.</footer>",
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
    "supplierHint",
    "source_recipes",
    "source_recipe_origins",
    "source_recipe_references"
  ]
    .map(escapeCsv)
    .join(",");

  const rows = list.items.map((item) =>
    [
      formatMetroGroupLabel(item.group),
      item.displayName,
      item.normalizedQty,
      item.normalizedUnit,
      item.purchaseQty,
      item.purchaseUnit,
      item.supplierHint ?? "",
      item.sourceRecipes.join("; "),
      (item.sourceRecipeMetadata && item.sourceRecipeMetadata.length > 0
        ? item.sourceRecipeMetadata.map(recipeSourceOriginLabel)
        : ["source unknown"]
      ).join("; "),
      (item.sourceRecipeMetadata && item.sourceRecipeMetadata.length > 0
        ? item.sourceRecipeMetadata.map(recipeSourceReferenceLabel)
        : ["source unknown"]
      ).join("; ")
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [header, ...rows].join("\n");
}

export interface PrintExportAppOptions extends CollectionStorageOptions {
  trustedActorSecret?: string;
  env?: Record<string, string | undefined>;
}

function actorForRequest(
  request: { headers: Record<string, string | string[] | undefined> },
  fallbackActorName: string,
  trustedActorSecret?: string,
  allowDevActorHeader = false
) {
  return trustedActorFromHeaders(request.headers, {
    fallbackActorName,
    trustedActorSecret,
    allowDevActorHeader
  });
}

function isOfferOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, "Angebots-Mitarbeiter", trustedActorSecret, allowDevActorHeader)
  ) === "offer_operator";
}

function isProductionOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): boolean {
  return resolveMinimalMvpRoleFromTrustedActor(
    actorForRequest(request, "Produktions-Mitarbeiter", trustedActorSecret, allowDevActorHeader)
  ) === "production_operator";
}

function requireOfferOperator(
  request: { headers: Record<string, string | string[] | undefined> },
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  trustedActorSecret?: string,
  allowDevActorHeader = false
): unknown | undefined {
  if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
    return reply.code(403).send({
      message: "Angebots-Operator erforderlich."
    });
  }

  return undefined;
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

export function buildPrintExportApp(options: PrintExportAppOptions = {}) {
  const env = options.env ?? process.env;
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
  const allowDevActorHeader = isDevAuthEnabled(env);
  const app = Fastify({
    logger: false
  });
  const offerStore = new OfferStore({
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });
  const intakeStore = new IntakeStore({
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });
  const productionStore = new ProductionStore({
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });
  const recipeLibrary = new RecipeLibrary(undefined, {
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
      const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
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
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
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

  app.get<{ Params: { planId: string } }>(
    "/v1/exports/production-folders/:planId/html",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const plan = await productionStore.getPlan(request.params.planId);
      if (!plan) {
        return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
      }

      const spec = await intakeStore.getSpec(plan.eventSpecId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec zum ProductionPlan nicht gefunden." });
      }

      const recipeIds = [
        ...new Set([
          ...plan.kitchenSheets.flatMap((sheet) => sheet.recipeId ?? []),
          ...plan.recipeSelections.flatMap((selection) => selection.recipeId ?? [])
        ])
      ];
      const [purchaseLists, recipes, clarificationAnswers] = await Promise.all([
        productionStore.listPurchaseLists(),
        Promise.all(recipeIds.map((recipeId) => recipeLibrary.get(recipeId))),
        productionStore.listClarificationAnswers()
      ]);
      const linkedRecipes = recipes.filter((recipe): recipe is Recipe => Boolean(recipe));

      reply.header(
        "content-disposition",
        `inline; filename="${request.params.planId}-produktionsmappe.html"`
      );
      return reply
        .type("text/html; charset=utf-8")
        .send(renderProductionFolderHtml({
          plan,
          spec,
          purchaseLists: purchaseLists.filter((list) => list.eventSpecId === spec.specId),
          recipes: linkedRecipes,
          clarificationAnswers: clarificationAnswers.filter((answer) => answer.context.specId === spec.specId)
        }));
    }
  );

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/exports/purchase-lists/:purchaseListId/csv",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
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
