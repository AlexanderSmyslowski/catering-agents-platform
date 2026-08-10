import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createUploadSourceMetadata,
  DOCUMENT_UPLOAD_LIMITS,
  ingestDocument,
  multipartLimitsForUpload,
  normalizeEventRequestToSpec,
  readLimitedUploadBuffer,
  uploadErrorResponse,
  validateAcceptedEventSpec,
  validateEventRequest,
  validateUploadedDocument,
  validateUploadedDocumentMetadata,
  type AuditLogStore,
  type DocumentIngestionResult,
  type DocumentInput,
  type EventRequest,
  type TrustedActor
} from "@catering/shared-core";
import type { IntakeStore } from "../store.js";

interface DocumentBody {
  documents: {
    filename: string;
    mimeType: string;
    contentBase64: string;
  }[];
  channel?: EventRequest["source"]["channel"];
  requestId?: string;
}

interface MultipartDocumentUpload {
  requestId?: string;
  channel?: EventRequest["source"]["channel"];
  documents: DocumentInput[];
}

export interface IntakeDocumentRouteDependencies {
  store: IntakeStore;
  auditLog: AuditLogStore;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  isIntakeOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  actorForRequest: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => TrustedActor;
}

function safeDocumentIngestionSummary(
  results: Array<DocumentIngestionResult & { documentId: string }>
) {
  return {
    documents: results.map((result) => ({
      documentId: result.documentId,
      ingestionStatus: result.status,
      warnings: result.warnings,
      sourceMetadata: result.sourceMetadata
    }))
  };
}

function rawInputKindForMimeType(
  mimeType: string
): EventRequest["rawInputs"][number]["kind"] {
  if (mimeType.includes("pdf")) {
    return "pdf";
  }
  if (mimeType.includes("message/rfc822")) {
    return "email";
  }
  if (mimeType.includes("json")) {
    return "json";
  }
  return "text";
}

async function extractMultipartDocuments(
  request: FastifyRequest
): Promise<MultipartDocumentUpload> {
  const multipartRequest = request as FastifyRequest & {
    isMultipart: () => boolean;
    parts: (options?: { limits?: { fileSize?: number; files?: number; fields?: number; parts?: number } }) => AsyncIterable<{
      type: "file" | "field";
      fieldname: string;
      filename?: string;
      mimetype?: string;
      value?: string;
      file?: AsyncIterable<Buffer | Uint8Array>;
      toBuffer?: () => Promise<Buffer>;
    }>;
  };

  if (!multipartRequest.isMultipart()) {
    throw new Error("Es wurde kein Multipart-Upload gesendet.");
  }

  const documents: DocumentInput[] = [];
  let channel: EventRequest["source"]["channel"] | undefined;
  let requestId: string | undefined;

  for await (const part of multipartRequest.parts({ limits: multipartLimitsForUpload("intake") })) {
    if (part.type === "file") {
      if (!part.toBuffer || !part.filename) {
        continue;
      }

      const mimeType = part.mimetype ?? "application/octet-stream";
      validateUploadedDocumentMetadata({ filename: part.filename, mimeType });
      const content = part.file
        ? await readLimitedUploadBuffer(part.file, "intake")
        : await part.toBuffer();
      const document = {
        filename: part.filename,
        mimeType,
        content,
        sourceMetadata: createUploadSourceMetadata({
          filename: part.filename,
          mimeType,
          content,
          uploadContext: "intake"
        })
      };
      validateUploadedDocument(document, "intake");
      documents.push(document);
      continue;
    }

    if (part.fieldname === "channel" && typeof part.value === "string") {
      channel = part.value as EventRequest["source"]["channel"];
    }
    if (part.fieldname === "requestId" && typeof part.value === "string") {
      requestId = part.value;
    }
  }

  if (documents.length === 0) {
    throw new Error("Es wurde keine Dokumentdatei mitgesendet.");
  }

  return {
    requestId,
    channel,
    documents
  };
}

async function normalizeUploadedDocuments(
  payload: { documents: DocumentInput[]; requestId?: string; channel?: EventRequest["source"]["channel"] }
) {
  const ingested = await Promise.all(
    payload.documents.map(async (document, index) => ({
      documentId: `${payload.requestId ?? "document"}-${index + 1}`,
      mimeType: document.mimeType,
      ...(await ingestDocument({
        document,
        context: "intake"
      }))
    }))
  );

  const eventRequest: EventRequest = {
    schemaVersion: "1.0.0",
    requestId: payload.requestId ?? `request-${Date.now()}`,
    source: {
      channel: payload.channel ?? "pdf_upload",
      receivedAt: new Date().toISOString()
    },
    rawInputs: ingested.map((item) => ({
      kind: rawInputKindForMimeType(item.mimeType),
      content: item.extractedText ?? "",
      mimeType: item.mimeType,
      documentId: item.documentId,
      sourceMetadata: item.sourceMetadata,
      documentIngestion: {
        status: item.status,
        warnings: item.warnings
      }
    }))
  };

  const validatedRequest = validateEventRequest(eventRequest);
  const spec = validateAcceptedEventSpec(
    normalizeEventRequestToSpec(validatedRequest, {
      sourceType:
        validatedRequest.source.channel === "email"
          ? "email"
          : validatedRequest.source.channel === "pdf_upload"
            ? "pdf"
            : "manual_input",
      reference: validatedRequest.requestId,
      commercialState: "manual"
    })
  );

  return {
    eventRequest: validatedRequest,
    acceptedEventSpec: spec,
    documentIngestion: safeDocumentIngestionSummary(ingested)
  };
}

export const intakeDocumentJsonRouteOptions = {
  bodyLimit: DOCUMENT_UPLOAD_LIMITS.intake.maxJsonBodyBytes
} as const;

export function registerIntakeDocumentRoutes(
  app: FastifyInstance,
  deps: IntakeDocumentRouteDependencies
) {
  const {
    store,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    isIntakeOperator,
    actorForRequest
  } = deps;

  app.post<{ Body: DocumentBody }>("/v1/intake/documents", intakeDocumentJsonRouteOptions, async (request, reply) => {
    if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Intake-Operator erforderlich."
      });
    }

    const body = request.body;
    try {
      const documents: DocumentInput[] = body.documents.map((document) => {
        const content = Buffer.from(document.contentBase64, "base64");
        const decodedDocument = {
          filename: document.filename,
          mimeType: document.mimeType,
          content,
          sourceMetadata: createUploadSourceMetadata({
            filename: document.filename,
            mimeType: document.mimeType,
            content,
            uploadContext: "intake"
          })
        };
        validateUploadedDocument(decodedDocument, "intake");
        return decodedDocument;
      });
      const normalized = await normalizeUploadedDocuments({
        documents,
        requestId: body.requestId,
        channel: body.channel
      });

      await store.saveRequest(normalized.eventRequest);
      await store.saveSpec(normalized.acceptedEventSpec);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "intake.documents_normalized",
        entityType: "AcceptedEventSpec",
        entityId: normalized.acceptedEventSpec.specId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: `${documents.length} hochgeladene(s) Dokument(e) in AcceptedEventSpec normalisiert.`,
        details: {
          requestId: normalized.eventRequest.requestId,
          documentCount: documents.length,
          readiness: normalized.acceptedEventSpec.readiness.status,
          uploadMode: "json_base64",
          ingestionStatuses: normalized.documentIngestion.documents.map((document) => document.ingestionStatus).join(","),
          warnings: normalized.documentIngestion.documents.flatMap((document) => document.warnings).join(",")
        }
      });

      return reply.code(201).send(normalized);
    } catch (error) {
      const uploadError = uploadErrorResponse(error, "intake");
      return reply.code(uploadError.statusCode).send({ message: uploadError.message });
    }
  });

  app.post("/v1/intake/documents/upload", async (request, reply) => {
    if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Intake-Operator erforderlich."
      });
    }

    try {
      const upload = await extractMultipartDocuments(request);
      const normalized = await normalizeUploadedDocuments(upload);

      await store.saveRequest(normalized.eventRequest);
      await store.saveSpec(normalized.acceptedEventSpec);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "intake.documents_normalized",
        entityType: "AcceptedEventSpec",
        entityId: normalized.acceptedEventSpec.specId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: `${upload.documents.length} hochgeladene(s) Dokument(e) per Direkt-Upload in AcceptedEventSpec normalisiert.`,
        details: {
          requestId: normalized.eventRequest.requestId,
          documentCount: upload.documents.length,
          readiness: normalized.acceptedEventSpec.readiness.status,
          uploadMode: "multipart",
          ingestionStatuses: normalized.documentIngestion.documents.map((document) => document.ingestionStatus).join(","),
          warnings: normalized.documentIngestion.documents.flatMap((document) => document.warnings).join(",")
        }
      });

      return reply.code(201).send(normalized);
    } catch (error) {
      const uploadError = uploadErrorResponse(error, "intake");
      return reply.code(uploadError.statusCode).send({ message: uploadError.message });
    }
  });
}
