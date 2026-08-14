import Fastify, { type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import {
  AuditLogStore,
  createTrustedActorResolver,
  createOfferDraft,
  createUploadSourceMetadata,
  extractTextFromDocument,
  getDemoOfferRequests,
  hostedMultiBusinessReady,
  parseUploadedRecipeText,
  isDevAuthEnabled,
  RecipeLibrary,
  resolveMinimalMvpRoleFromTrustedActor,
  multipartLimitsForUpload,
  readLimitedUploadBuffer,
  uploadErrorResponse,
  validateUploadedDocument,
  validateUploadedDocumentMetadata,
  type CollectionStorageOptions,
  validateOfferDraft
} from "@catering/shared-core";
import { OfferStore } from "./store.js";
import { registerOfferApprovalRoutes } from "./routes/approval-routes.js";
import { registerOfferCaseRoutes } from "./routes/case-routes.js";
import { registerOfferDraftRoutes } from "./routes/draft-routes.js";
import { HttpSourceDocumentMetadataReader } from "./gateways/http-source-document-metadata-reader.js";
import type { SourceDocumentMetadataReader } from "./ports/source-document-reader.js";

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

export interface OfferAppOptions extends CollectionStorageOptions {
  store?: OfferStore;
  recipeLibrary?: RecipeLibrary;
  auditLog?: AuditLogStore;
  trustedActorSecret?: string;
  sourceDocumentReader?: SourceDocumentMetadataReader;
  env?: Record<string, string | undefined>;
}

function isOfferStore(value: OfferStore | OfferAppOptions | undefined): value is OfferStore {
  return value instanceof OfferStore;
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
      uploadContext: "offer"
    })
  };
}

export function buildOfferApp(input: OfferStore | OfferAppOptions = {}) {
  const options = isOfferStore(input) ? { store: input } : input;
  const env = options.env ?? process.env;
  const defaultBusinessContext = { businessId: env.CATERING_DEFAULT_BUSINESS_ID ?? "local" };
  const hosted = env.CATERING_DEPLOYMENT_PROFILE === "hosted";
  if (hosted && !hostedMultiBusinessReady) {
    throw new Error("Hosted Multi-Business-Betrieb ist noch nicht bereit.");
  }
  const trustedActorSecret = options.trustedActorSecret ?? env.CATERING_TRUSTED_ACTOR_SECRET;
  const allowDevActorHeader = isDevAuthEnabled(env);
  const resolveActor = createTrustedActorResolver({
    fallbackActorName: "Angebots-Mitarbeiter", fallbackBusinessId: defaultBusinessContext.businessId, requireTrustedBusinessId: hosted, trustedActorSecret, allowDevActorHeader
  });
  const actorForRequest = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) => resolveActor(request);
  const isOfferOperator = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "offer_operator";
  const requireOfferOperator = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    ..._ignored: unknown[]
  ): unknown | undefined => isOfferOperator(request)
    ? undefined
    : reply.code(403).send({ message: "Angebots-Operator erforderlich." });
  const requireHandoffReader = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ): unknown | undefined => {
    const actor = actorForRequest(request);
    const role = resolveMinimalMvpRoleFromTrustedActor(actor);
    return role === "offer_operator" ||
      (actor.trusted && (actor.name === "Production-Service" || role === "production_operator"))
      ? undefined
      : reply.code(403).send({ message: "Leseberechtigung für Produktionsübergaben erforderlich." });
  };
  const isOperationsAuditOperator = (request: { headers: Record<string, string | string[] | undefined> }, ..._ignored: unknown[]) =>
    resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "operations_audit_operator";
  const storageOptions = isOfferStore(input) ? input.storageOptions : options;
  const store =
    options.store ??
    new OfferStore({
      rootDir: options.rootDir,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const recipeLibrary =
    options.recipeLibrary ??
    new RecipeLibrary({
      rootDir: storageOptions?.rootDir,
      databaseUrl: storageOptions?.databaseUrl,
      pgPool: storageOptions?.pgPool
    });
  const auditLog =
    options.auditLog ??
    new AuditLogStore({
      rootDir: storageOptions?.rootDir,
      databaseUrl: storageOptions?.databaseUrl,
      pgPool: storageOptions?.pgPool
    });
  const sourceDocumentReader = options.sourceDocumentReader ?? (env.CATERING_INTAKE_SERVICE_URL
    ? new HttpSourceDocumentMetadataReader({
        intakeServiceUrl: env.CATERING_INTAKE_SERVICE_URL,
        trustedServiceSecret: trustedActorSecret
      })
    : undefined);

  const app = Fastify({
    logger: false
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.split("?", 1)[0] === "/health") return;
    const actor = actorForRequest(request);
    if (!hosted && actor.businessId !== defaultBusinessContext.businessId) {
      return reply.code(403).send({
        message: "Der vertrauenswürdige Betriebskontext passt nicht zum konfigurierten Betrieb dieses lokalen Dienstes."
      });
    }
  });

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    if (hosted) {
      return reply.send({ service: "offer-service", status: "ok", timestamp: new Date().toISOString() });
    }
    const [drafts, recipes, auditEvents] = await Promise.all([
      store.listDrafts(defaultBusinessContext),
      recipeLibrary.list(defaultBusinessContext),
      auditLog.countFor(defaultBusinessContext)
    ]);
    return reply.send({
      service: "offer-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        offerDrafts: drafts.length,
        recipes: recipes.length,
        auditEvents
      }
    });
  });

  registerOfferDraftRoutes(app, {
    store,
    auditLog,
    sourceDocumentReader,
    trustedActorSecret,
    allowDevActorHeader,
    isOfferOperator,
    requireOfferOperator,
    actorForRequest
  });
  registerOfferCaseRoutes(app, {
    store,
    trustedActorSecret,
    allowDevActorHeader,
    requireOfferOperator,
    actorForRequest
  });
  registerOfferApprovalRoutes(app, { store, auditLog, requireOfferOperator, requireHandoffReader, actorForRequest });

  app.post("/v1/offers/seed-demo", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Betriebs-/Audit-Operator erforderlich."
      });
    }

    const seeded = [];
    for (const eventRequest of getDemoOfferRequests()) {
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft = validateOfferDraft({ ...createOfferDraft(eventRequest), businessId: actor.businessId, revision: 1 });
      await store.saveDraft(actor, draft);
      seeded.push({
        requestId: eventRequest.requestId,
        draftId: draft.draftId
      });
    }
    await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
      action: "offer.seed_demo",
      entityType: "SeedBatch",
      entityId: `offer-demo-${Date.now()}`,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: `${seeded.length} Angebotsentwuerfe als Demo angelegt.`,
      details: {
        seededCount: seeded.length
      }
    });

    return reply.code(201).send({
      seeded,
      counts: {
        offerDrafts: (await store.listDrafts(actorForRequest(request, trustedActorSecret, allowDevActorHeader))).length
      }
    });
  });

  app.get("/v1/offers/recipes", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await recipeLibrary.list(actorForRequest(request, trustedActorSecret, allowDevActorHeader))
    });
  });

  app.get<{ Params: { recipeId: string } }>("/v1/offers/recipes/:recipeId", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const recipe = await recipeLibrary.get(
      actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      request.params.recipeId
    );
    if (!recipe) {
      return reply.code(404).send({ message: "Rezept nicht gefunden." });
    }

    return reply.send(recipe);
  });

  app.post<{ Body: RecipeTextImportBody }>("/v1/offers/recipes/import-text", async (request, reply) => {
    if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Angebots-Operator erforderlich."
      });
    }

    const recipe = parseUploadedRecipeText(request.body);
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    await recipeLibrary.save(actor, recipe);
    await auditLog.logFor(actor, {
      action: "recipe.imported_text",
      entityType: "Recipe",
      entityId: recipe.recipeId,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: `Rezepttext in gemeinsame Bibliothek importiert: ${recipe.name}.`,
      details: {
        recipeName: recipe.name,
        sourceTier: recipe.source.tier,
        approvalState: recipe.source.approvalState
      }
    });
    return reply.code(201).send({ recipe });
  });

  app.post("/v1/offers/recipes/upload", async (request, reply) => {
    if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Angebots-Operator erforderlich."
      });
    }

    try {
      const payload = await recipeImportFromMultipart(request);
      const recipe = parseUploadedRecipeText(payload);
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      await recipeLibrary.save(actor, recipe);
      await auditLog.logFor(actor, {
        action: "recipe.uploaded_file",
        entityType: "Recipe",
        entityId: recipe.recipeId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
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
      const uploadError = uploadErrorResponse(error, "recipe");
      return reply.code(uploadError.statusCode).send({ message: uploadError.message });
    }
  });

  app.patch<{ Params: { recipeId: string }; Body: RecipeReviewBody }>(
    "/v1/offers/recipes/:recipeId/review",
    async (request, reply) => {
      if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Angebots-Operator erforderlich."
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const recipe = await recipeLibrary.reviewRecipe(actor, request.params.recipeId, request.body);
      await auditLog.logFor(actor, {
        action: "recipe.reviewed",
        entityType: "Recipe",
        entityId: recipe.recipeId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: `Rezept ${recipe.name} über den Angebots-Workflow geprüft.`,
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
