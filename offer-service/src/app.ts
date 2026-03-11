import Fastify, { type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import {
  createEventRequestFromText,
  createOfferDraft,
  extractTextFromDocument,
  getDemoOfferRequests,
  parseUploadedRecipeText,
  RecipeLibrary,
  promoteOfferVariant,
  type CollectionStorageOptions,
  validateAcceptedEventSpec,
  validateEventRequest,
  validateOfferDraft,
  type EventRequest
} from "@catering/shared-core";
import { OfferStore } from "./store.js";

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

export interface OfferAppOptions extends CollectionStorageOptions {
  store?: OfferStore;
  recipeLibrary?: RecipeLibrary;
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

export function buildOfferApp(input: OfferStore | OfferAppOptions = {}) {
  const options = isOfferStore(input) ? { store: input } : input;
  const store =
    options.store ??
    new OfferStore({
      rootDir: options.rootDir,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });
  const recipeLibrary =
    options.recipeLibrary ??
    new RecipeLibrary(undefined, {
      rootDir: options.rootDir,
      databaseUrl: options.databaseUrl,
      pgPool: options.pgPool
    });

  const app = Fastify({
    logger: false
  });

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    const [drafts, recipes] = await Promise.all([
      store.listDrafts(),
      recipeLibrary.list()
    ]);
    return reply.send({
      service: "offer-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        offerDrafts: drafts.length,
        recipes: recipes.length
      }
    });
  });

  app.post<{ Body: EventRequest }>("/v1/offers/drafts", async (request, reply) => {
    const eventRequest = validateEventRequest(request.body);
    const draft = validateOfferDraft(createOfferDraft(eventRequest));
    await store.saveDraft(draft);
    return reply.code(201).send(draft);
  });

  app.post<{ Body: { text: string; requestId?: string } }>("/v1/offers/from-text", async (request, reply) => {
    const eventRequest = createEventRequestFromText({
      requestId: request.body.requestId ?? `request-${Date.now()}`,
      channel: "text",
      rawText: request.body.text
    });
    const draft = validateOfferDraft(createOfferDraft(eventRequest));
    await store.saveDraft(draft);
    return reply.code(201).send(draft);
  });

  app.post("/v1/offers/seed-demo", async (_request, reply) => {
    const seeded = [];
    for (const eventRequest of getDemoOfferRequests()) {
      const draft = validateOfferDraft(createOfferDraft(eventRequest));
      await store.saveDraft(draft);
      seeded.push({
        requestId: eventRequest.requestId,
        draftId: draft.draftId
      });
    }

    return reply.code(201).send({
      seeded,
      counts: {
        offerDrafts: (await store.listDrafts()).length
      }
    });
  });

  app.get("/v1/offers/drafts", async (_request, reply) => {
    return reply.send({
      items: await store.listDrafts()
    });
  });

  app.get("/v1/offers/recipes", async (_request, reply) => {
    return reply.send({
      items: await recipeLibrary.list()
    });
  });

  app.get<{ Params: { recipeId: string } }>("/v1/offers/recipes/:recipeId", async (request, reply) => {
    const recipe = await recipeLibrary.get(request.params.recipeId);
    if (!recipe) {
      return reply.code(404).send({ message: "Recipe not found." });
    }

    return reply.send(recipe);
  });

  app.post<{ Body: RecipeTextImportBody }>("/v1/offers/recipes/import-text", async (request, reply) => {
    const recipe = parseUploadedRecipeText(request.body);
    await recipeLibrary.save(recipe);
    return reply.code(201).send({ recipe });
  });

  app.post("/v1/offers/recipes/upload", async (request, reply) => {
    const payload = await recipeImportFromMultipart(request);
    const recipe = parseUploadedRecipeText(payload);
    await recipeLibrary.save(recipe);
    return reply.code(201).send({ recipe });
  });

  app.patch<{ Params: { recipeId: string }; Body: RecipeReviewBody }>(
    "/v1/offers/recipes/:recipeId/review",
    async (request, reply) => {
      const recipe = await recipeLibrary.reviewRecipe(request.params.recipeId, request.body);
      return reply.send({ recipe });
    }
  );

  app.get<{ Params: { draftId: string } }>("/v1/offers/drafts/:draftId", async (request, reply) => {
    const draft = await store.getDraft(request.params.draftId);
    if (!draft) {
      return reply.code(404).send({ message: "OfferDraft not found." });
    }

    return reply.send(draft);
  });

  app.post<{ Params: { draftId: string }; Body: { variantId?: string } }>(
    "/v1/offers/drafts/:draftId/promote",
    async (request, reply) => {
      const draft = await store.getDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "OfferDraft not found." });
      }

      const promoted = validateAcceptedEventSpec(
        promoteOfferVariant(draft, request.body?.variantId)
      );

      return reply.code(201).send(promoted);
    }
  );

  return app;
}
