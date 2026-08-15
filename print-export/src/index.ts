import Fastify from "fastify";
import { IntakeStore } from "@catering/intake-service";
import { OfferStore } from "@catering/offer-service";
import { ProductionStore } from "@catering/production-service";
import type {
  AcceptedEventSpec,
  CollectionStorageOptions,
  OfferDraft,
  ProductionPlan,
  PurchaseList,
  Recipe,
  RecipeSourceExportMetadata
} from "@catering/shared-core";
import {
  formatDocumentIngestionStatusLabel,
  formatDocumentIngestionWarningLabel,
  assertBusinessId,
  assertTrustedActorConfiguration,
  createTrustedActorResolver,
  formatMetroGroupLabel,
  isDevAuthEnabled,
  hostedMultiBusinessReady,
  RecipeLibrary,
  recipeSourceOriginLabel,
  recipeSourceReferenceLabel,
  resolveMinimalMvpRoleFromTrustedActor,
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

function formatOfferReviewStatusLabel(value: unknown): string {
  const status = String(value ?? "review_required").trim();
  if (status === "verified") {
    return "geprüft";
  }
  if (status === "review_required") {
    return "Prüfung nötig";
  }
  return status || "Prüfung nötig";
}

function formatProductionReadinessStatusLabel(value: unknown): string {
  const status = String(value ?? "").trim();
  if (status === "complete") {
    return "vollständig";
  }
  if (status === "partial") {
    return "teilweise vollständig";
  }
  if (status === "insufficient") {
    return "nicht ausreichend";
  }
  return status || "offen";
}

function productionComponentLabel(
  componentId: string,
  plan: ProductionPlan,
  spec?: AcceptedEventSpec
): string {
  return (
    spec?.menuPlan.find((component) => component.componentId === componentId)?.label ??
    plan.componentReadiness?.find((component) => component.componentId === componentId)?.label ??
    componentId
  );
}

function compactLabelParts(parts: Array<string | undefined>): string[] {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

function formatProductionPlanRecipeSourceLabel(metadata?: RecipeSourceExportMetadata): string {
  if (!metadata) {
    return "Quelle offen";
  }

  const referenceLabel = recipeSourceReferenceLabel(metadata);
  const shouldShowReference =
    metadata.originType !== "internal_db" && referenceLabel !== "Quelle offen";

  return compactLabelParts([
    metadata.recipeName,
    recipeSourceOriginLabel(metadata),
    shouldShowReference ? referenceLabel : undefined
  ]).join(" · ");
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
        ingestionStatus ? `Lesbarkeit: ${formatDocumentIngestionStatusLabel(ingestionStatus)}` : undefined,
        ingestionWarnings.length > 0
          ? `Hinweise: ${ingestionWarnings.map(formatDocumentIngestionWarningLabel).join(", ")}`
          : undefined
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
          `<section><h2>Dokumentprüfungen</h2><ul>${warningRows
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
        `<li>Preis: ${escapeHtml(formatOfferReviewStatusLabel(draft.reviewStatus?.priceReviewStatus))}</li>`,
        `<li>MwSt.: ${escapeHtml(formatOfferReviewStatusLabel(draft.reviewStatus?.taxReviewStatus))}</li>`,
        `<li>Allergene: ${escapeHtml(formatOfferReviewStatusLabel(draft.reviewStatus?.allergenReviewStatus))}</li>`,
        `<li>Hygiene/Temperatur: ${escapeHtml(
          formatOfferReviewStatusLabel(draft.reviewStatus?.hygieneTemperatureReviewStatus)
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

export function renderProductionPlanHtml(plan: ProductionPlan, spec?: AcceptedEventSpec): string {
  const unresolvedSection =
    plan.unresolvedItems.length > 0
      ? [`<section><h2>Offene Punkte</h2><ul>${plan.unresolvedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`]
      : [];
  return [
    "<html><body>",
    "<h1>Produktionsplan</h1>",
    `<p>Status: ${escapeHtml(formatProductionReadinessStatusLabel(plan.readiness.status))}</p>`,
    `<p>Rezeptauswahl: ${plan.recipeSelections.length}</p>`,
    ...renderSourceAnchorsSection(plan as unknown as Record<string, unknown>),
    ...unresolvedSection,
    ...plan.productionBatches.map(
      (batch) => {
        const kitchenSheet = plan.kitchenSheets.find((sheet) =>
          sheet.componentId === batch.componentId && sheet.recipeId === batch.recipeId
        );
        const sourceLabel = formatProductionPlanRecipeSourceLabel(batch.recipeSource ?? kitchenSheet?.recipeSource);

        return `<section><h2>${escapeHtml(productionComponentLabel(batch.componentId, plan, spec))}</h2><p>Station: ${escapeHtml(batch.station)}</p><p>Rezeptquelle: ${escapeHtml(sourceLabel)}</p><ol>${batch.steps
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
        : [recipeSourceOriginLabel()]
      ).join("; "),
      (item.sourceRecipeMetadata && item.sourceRecipeMetadata.length > 0
        ? item.sourceRecipeMetadata.map(recipeSourceReferenceLabel)
        : [recipeSourceReferenceLabel()]
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

export function buildPrintExportApp(options: PrintExportAppOptions = {}) {
  const env = options.env ?? process.env;
  const hosted = env.CATERING_DEPLOYMENT_PROFILE === "hosted";
  if (hosted && !hostedMultiBusinessReady) {
    throw new Error("Hosted Multi-Business-Betrieb ist noch nicht bereit.");
  }
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
  assertTrustedActorConfiguration({ requireTrustedBusinessId: hosted, trustedActorSecret });
  const allowDevActorHeader = isDevAuthEnabled(env);
  const defaultBusinessId = env.CATERING_DEFAULT_BUSINESS_ID ?? "local";
  if (hosted) assertBusinessId(defaultBusinessId);
  const defaultBusinessContext = { businessId: defaultBusinessId };
  type PrintExportRequest = { headers: Record<string, string | string[] | undefined>; url?: string };
  const resolveActor = createTrustedActorResolver<PrintExportRequest>((request) => ({
    fallbackActorName: request.url?.startsWith("/v1/exports/offers/")
      ? "Angebots-Mitarbeiter"
      : "Produktions-Mitarbeiter",
    fallbackBusinessId: defaultBusinessId,
    requireTrustedBusinessId: hosted,
    trustedActorSecret,
    allowDevActorHeader
  }));
  const actorForRequest = (request: PrintExportRequest, ..._ignored: unknown[]) => resolveActor(request);
  const isOfferOperator = (request: PrintExportRequest, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "offer_operator";
  const isProductionOperator = (request: PrintExportRequest, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "production_operator";
  const requireOfferOperator = (
    request: PrintExportRequest,
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    ..._ignored: unknown[]
  ): unknown | undefined => isOfferOperator(request)
    ? undefined
    : reply.code(403).send({ message: "Angebots-Operator erforderlich." });
  const requireProductionOperator = (
    request: PrintExportRequest,
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    ..._ignored: unknown[]
  ): unknown | undefined => isProductionOperator(request)
    ? undefined
    : reply.code(403).send({ message: "Produktions-Operator erforderlich." });
  const app = Fastify({
    logger: false
  });
  app.addHook("onRequest", async (request) => {
    if (request.url.split("?", 1)[0] !== "/health") actorForRequest(request);
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
  const recipeLibrary = new RecipeLibrary({
    rootDir: options.rootDir,
    databaseUrl: options.databaseUrl,
    pgPool: options.pgPool
  });

  app.get("/health", async (_request, reply) => {
    if (hosted) {
      return reply.send({ service: "print-export", status: "ok", timestamp: new Date().toISOString() });
    }
    const [offerDrafts, productionPlans, purchaseLists] = await Promise.all([
      offerStore.listDrafts(defaultBusinessContext),
      productionStore.listPlans(defaultBusinessContext),
      productionStore.listPurchaseLists(defaultBusinessContext)
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

      const draft = await offerStore.getDraft(actorForRequest(request), request.params.draftId);
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

      const actor = actorForRequest(request);
      const plan = await productionStore.getPlan(actor, request.params.planId);
      if (!plan) {
        return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
      }

      const spec = await intakeStore.getSpec(actor, plan.eventSpecId);

      reply.header(
        "content-disposition",
        `inline; filename="${request.params.planId}.html"`
      );
      return reply
        .type("text/html; charset=utf-8")
        .send(renderProductionPlanHtml(plan, spec));
    }
  );

  app.get<{ Params: { planId: string } }>(
    "/v1/exports/production-folders/:planId/html",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const actor = actorForRequest(request);
      const plan = await productionStore.getPlan(actor, request.params.planId);
      if (!plan) {
        return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
      }

      const spec = await intakeStore.getSpec(actor, plan.eventSpecId);
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
        productionStore.listPurchaseLists(actor),
        Promise.all(recipeIds.map((recipeId) => recipeLibrary.get(actor, recipeId))),
        productionStore.listClarificationAnswers(actor)
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

      const list = await productionStore.getPurchaseList(actorForRequest(request), request.params.purchaseListId);
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
