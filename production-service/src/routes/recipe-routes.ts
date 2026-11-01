import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createUploadSourceMetadata,
  recipeVisionCapability,
  transcribeRecipeVision,
  validateUploadedDocumentSize,
  extractTextFromDocument,
  multipartLimitsForUpload,
  parseUploadedRecipeText,
  parseRecipeUploadReview,
  prepareRecipeImportPreview,
  type RecipeImportReview,
  readLimitedUploadBuffer,
  uploadErrorResponse,
  validateUploadedDocument,
  validateUploadedDocumentMetadata,
  type AuditLogStore,
  type TrustedActor
} from "@catering/shared-core";
import { imageDimensions, signRecipePreview, verifyRecipePreview } from "../recipe-vision.js";
import type { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";

interface RecipeTextImportBody {
  text: string;
  filename?: string;
  recipeName?: string;
  sourceRef?: string;
  sourceMetadata?: ReturnType<typeof createUploadSourceMetadata>;
  numberFormat?: "de" | "en";
  review?: RecipeImportReview;
}

interface RecipeReviewBody {
  decision: "approve" | "verify" | "reject";
  note?: string;
}

export interface ProductionRecipeRouteDependencies {
  repository: InMemoryRecipeRepository;
  auditLog: AuditLogStore;
  trustedActorSecret?: string;
  visionEnv: Record<string, string | undefined>;
  previewActorBinding: (request:FastifyRequest)=>string;
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
  request: FastifyRequest, skipPdfExtraction = false
): Promise<RecipeTextImportBody & { content:Buffer; mimeType:string }> {
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

  const isImage = /\.(?:png|jpe?g)$/i.test(file.filename) && ["image/png", "image/jpeg"].includes(file.mimetype);
  if (!isImage) validateUploadedDocumentMetadata({ filename: file.filename, mimeType: file.mimetype });
  else if (!((/\.png$/i.test(file.filename) && file.mimetype === "image/png") || (/\.jpe?g$/i.test(file.filename) && file.mimetype === "image/jpeg"))) throw Object.assign(new Error("Dateiendung und Bildformat stimmen nicht überein."),{statusCode:422});
  const content = await readLimitedUploadBuffer(file.file, "recipe");
  const document = {
    filename: file.filename,
    mimeType: file.mimetype,
    content
  };
  validateUploadedDocumentSize(content.length, "recipe");
  if (isImage) imageDimensions(content,file.mimetype);
  else validateUploadedDocument(document, "recipe");
  const review = parseRecipeUploadReview(multipartFieldValue(file.fields, "review"));
  const skipPdf = file.mimetype === "application/pdf" && (skipPdfExtraction || Boolean(review?.previewToken));
  const text = isImage || skipPdf ? "" : await extractTextFromDocument(document);

  return {
    text, content, mimeType:file.mimetype,
    filename: file.filename,
    recipeName: multipartFieldValue(file.fields, "recipeName"),
    numberFormat: multipartFieldValue(file.fields, "numberFormat") as "de" | "en" | undefined,
    sourceRef: multipartFieldValue(file.fields, "sourceRef"),
    review,
    sourceMetadata: createUploadSourceMetadata({
      filename: file.filename,
      mimeType: file.mimetype,
      content,
      uploadContext: "production"
    })
  };
}

export function registerProductionRecipeRoutes(
  app: FastifyInstance,
  deps: ProductionRecipeRouteDependencies
) {
  const {
    repository,
    auditLog,
    trustedActorSecret,
    visionEnv,
    previewActorBinding,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  } = deps;

  app.get("/v1/production/recipes/vision-capability", async (request,reply) => {
    if (!isProductionOperator(request,trustedActorSecret,allowDevActorHeader)) return reply.code(403).send({message:"Produktions-Operator erforderlich."});
    const actor=actorForRequest(request,trustedActorSecret,allowDevActorHeader);
    return reply.send(recipeVisionCapability(visionEnv,actor.businessId));
  });

  app.get("/v1/production/recipes", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return reply.send({
      items: await repository.list(actor)
    });
  });

  app.get<{ Params: { recipeId: string } }>("/v1/production/recipes/:recipeId", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const recipe = await repository.get(
      actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      request.params.recipeId
    );
    if (!recipe) {
      return reply.code(404).send({ message: "Rezept nicht gefunden." });
    }

    return reply.send(recipe);
  });

  app.post<{ Body: RecipeTextImportBody }>("/v1/production/recipes/import-text", async (request, reply) => {
    if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Produktions-Operator erforderlich."
      });
    }

    const recipe = parseUploadedRecipeText(request.body);
    if (!request.body.review) return reply.code(422).send({ message: "Bitte Rezepttext, Mengen und Originalportionen vor dem Speichern prüfen und bestätigen." });
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    await repository.save(actor, recipe);
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

  app.post("/v1/production/recipes/upload", async (request, reply) => {
    if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Produktions-Operator erforderlich."
      });
    }

    try {
      const query = request.query as { preview?: string; vision?:string; manual?:string };
      if (query.preview !== undefined && query.preview !== "true") {
        return reply.code(422).send({ message: "Unbekannter Vorschauauftrag. Bitte die Datei erneut einlesen." });
      }
      if (query.vision !== undefined && (query.vision !== "true" || query.preview !== "true")) return reply.code(422).send({message:"Ungültiger Bildauftrag."});
      if (query.manual !== undefined && (query.manual !== "true" || query.preview !== "true" || query.vision !== undefined)) return reply.code(422).send({message:"Ungültiger manueller Auftrag."});
      const payload = await recipeImportFromMultipart(request, query.vision === "true" || query.manual === "true");
      const actor=actorForRequest(request,trustedActorSecret,allowDevActorHeader);
      const isImage=payload.mimeType === "image/png" || payload.mimeType === "image/jpeg";
      if (query.preview === "true") {
        if (query.manual === "true") {
          if (!isImage && payload.mimeType !== "application/pdf") return reply.code(422).send({message:"Manuelle Bildübertragung nur für JPEG, PNG oder PDF."});
          if (!visionEnv.CATERING_TRUSTED_ACTOR_SECRET) return reply.code(422).send({message:"Manuelle Bildübertragung ist nicht konfiguriert. Bitte den Rezepttext als Textdatei einlesen."});
          const text="Manuelle Übertragung aus der Originaldatei. Keine automatische Texterkennung.";
          const preview=prepareRecipeImportPreview({...payload,text});
          preview.previewToken=signRecipePreview({businessId:actor.businessId,fileHash:payload.sourceMetadata!.sha256,actorBinding:previewActorBinding(request),text,now:Date.now()},visionEnv.CATERING_TRUSTED_ACTOR_SECRET);
          return reply.send({preview});
        }
        if (query.vision === "true") {
          if (!isImage) return reply.code(422).send({message:"Gescannte PDFs werden noch nicht automatisch gelesen. Bitte als Foto einreichen oder manuell übertragen."});
          if (!recipeVisionCapability(visionEnv,actor.businessId).available) return reply.code(422).send({message:"Bildverarbeitung ist nicht freigegeben. Bitte Rezepttext manuell eingeben."});
          const dimensions=imageDimensions(payload.content,payload.mimeType);
          previewActorBinding(request);
          const text=await transcribeRecipeVision({content:payload.content,mimeType:payload.mimeType as "image/png"|"image/jpeg",businessId:actor.businessId,...dimensions},visionEnv);
          const preview=prepareRecipeImportPreview({...payload,text});
          preview.previewToken=signRecipePreview({businessId:actor.businessId,fileHash:payload.sourceMetadata!.sha256,actorBinding:previewActorBinding(request),text,now:Date.now()},visionEnv.CATERING_TRUSTED_ACTOR_SECRET!);
          return reply.send({preview});
        }
        if (isImage) return reply.code(422).send({message:"Zum Lesen eines Bildes bitte Bildverarbeitung ausdrücklich starten."});
        return reply.send({ preview: prepareRecipeImportPreview(payload) });
      }
      if (payload.review?.previewToken) payload.text=verifyRecipePreview(payload.review.previewToken,{businessId:actor.businessId,fileHash:payload.sourceMetadata!.sha256,actorBinding:previewActorBinding(request),now:Date.now()},visionEnv.CATERING_TRUSTED_ACTOR_SECRET ?? "");
      else if (isImage) return reply.code(422).send({message:"Bitte Bild zuerst einlesen und die Vorschau bestätigen."});
      const recipe = parseUploadedRecipeText(payload);
      if (!payload.review) return reply.code(422).send({ message: "Bitte zuerst die Vorschau prüfen und Mengen sowie Originalportionen bestätigen." });
      await repository.save(actor, recipe);
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
    "/v1/production/recipes/:recipeId/review",
    async (request, reply) => {
      if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Produktions-Operator erforderlich."
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const recipe = await repository.reviewRecipe(actor, request.params.recipeId, request.body);
      await auditLog.logFor(actor, {
        action: "recipe.reviewed",
        entityType: "Recipe",
        entityId: recipe.recipeId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: `Rezept ${recipe.name} über den Produktions-Workflow geprüft.`,
        details: {
          decision: request.body.decision,
          approvalState: recipe.source.approvalState,
          sourceTier: recipe.source.tier
        }
      });
      return reply.send({ recipe });
    }
  );
}
