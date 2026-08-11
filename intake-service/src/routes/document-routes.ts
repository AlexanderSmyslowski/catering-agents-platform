import { randomUUID } from "node:crypto";
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
  UploadValidationError,
  type AuditLogStore,
  type DocumentIngestionResult,
  type DocumentInput,
  type EventRequest,
  type TrustedActor
} from "@catering/shared-core";
import { IntakeStoreConflictError, type IntakeStore } from "../store.js";
import type {
  SourceDocumentStore,
  StoredSourceDocument
} from "../source-document-store.js";
import {
  insertRegisteredSourceDocument,
  SourceDocumentConflictError
} from "../source-document-store.js";

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
  sourceDocumentStore: SourceDocumentStore;
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
    throw new UploadValidationError("Es wurde kein Multipart-Upload gesendet.");
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
    throw new UploadValidationError("Es wurde keine Dokumentdatei mitgesendet.");
  }

  return {
    requestId,
    channel,
    documents
  };
}

function validatedUploadEnvelope(
  payload: {
    documents: DocumentInput[];
    requestId?: string;
    channel?: EventRequest["source"]["channel"];
  }
): Pick<EventRequest, "requestId" | "source"> {
  const envelope: EventRequest = {
    schemaVersion: "1.0.0",
    requestId: payload.requestId ?? `request-${Date.now()}`,
    source: {
      channel: payload.channel ?? "pdf_upload",
      receivedAt: new Date().toISOString()
    },
    rawInputs: payload.documents.map((document) => ({
      kind: rawInputKindForMimeType(document.mimeType),
      content: "",
      mimeType: document.mimeType
    }))
  };

  try {
    const validated = validateEventRequest(envelope);
    return {
      requestId: validated.requestId,
      source: validated.source
    };
  } catch {
    throw new UploadValidationError("Die Angaben zum Dokument-Upload sind ungültig.");
  }
}

function expectedDocumentRouteError(
  error: unknown
): { statusCode: number; message: string } | undefined {
  if (error instanceof IntakeStoreConflictError) {
    return {
      statusCode: 409,
      message: error.message
    };
  }
  if (error instanceof UploadValidationError || error instanceof SourceDocumentConflictError) {
    return {
      statusCode: error.statusCode,
      message: error.message
    };
  }

  const maybeError = error as { code?: string; statusCode?: number };
  if (maybeError?.code === "FST_REQ_FILE_TOO_LARGE" || maybeError?.statusCode === 413) {
    return uploadErrorResponse(error, "intake");
  }
  return undefined;
}

async function normalizeUploadedDocuments(
  payload: { documents: DocumentInput[]; requestId?: string; channel?: EventRequest["source"]["channel"] },
  actor: TrustedActor,
  sourceDocumentStore: SourceDocumentStore,
  auditLog: AuditLogStore
) {
  const envelope = validatedUploadEnvelope(payload);
  const ingested = await Promise.all(
    payload.documents.map(async (document) => {
      const sourceMetadata = document.sourceMetadata ?? createUploadSourceMetadata({
        filename: document.filename,
        mimeType: document.mimeType,
        content: document.content,
        uploadContext: "intake"
      });
      const metadata: StoredSourceDocument = {
        businessId: actor.businessId,
        documentId: randomUUID(),
        filename: sourceMetadata.filename,
        mimeType: sourceMetadata.mimeType,
        sizeBytes: sourceMetadata.sizeBytes,
        sha256: sourceMetadata.sha256,
        dataClass: "personal_confidential",
        createdAt: sourceMetadata.ingestedAt
      };

      // The original is the durable evidence. Extraction may fail later without losing that evidence.
      await insertRegisteredSourceDocument({
        store: sourceDocumentStore,
        auditLog,
        actor,
        metadata,
        content: document.content
      });
      return {
        documentId: metadata.documentId,
        mimeType: document.mimeType,
        ...(await ingestDocument({
          document,
          context: "intake"
        }))
      };
    })
  );

  const eventRequest: EventRequest = {
    schemaVersion: "1.0.0",
    requestId: envelope.requestId,
    source: envelope.source,
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
    sourceDocumentStore,
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
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
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
      }, actor, sourceDocumentStore, auditLog);

      await store.saveRequest(actor, normalized.eventRequest);
      await store.saveSpec(actor, normalized.acceptedEventSpec);
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
      const expected = expectedDocumentRouteError(error);
      if (expected) {
        return reply.code(expected.statusCode).send({ message: expected.message });
      }
      request.log.error(
        { errorType: error instanceof Error ? error.name : typeof error },
        "intake document processing failed"
      );
      return reply.code(500).send({ message: "Dokument konnte nicht verarbeitet werden." });
    }
  });

  app.post("/v1/intake/documents/upload", async (request, reply) => {
    if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Intake-Operator erforderlich."
      });
    }

    try {
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const upload = await extractMultipartDocuments(request);
      const normalized = await normalizeUploadedDocuments(upload, actor, sourceDocumentStore, auditLog);

      await store.saveRequest(actor, normalized.eventRequest);
      await store.saveSpec(actor, normalized.acceptedEventSpec);
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
      const expected = expectedDocumentRouteError(error);
      if (expected) {
        return reply.code(expected.statusCode).send({ message: expected.message });
      }
      request.log.error(
        { errorType: error instanceof Error ? error.name : typeof error },
        "intake document processing failed"
      );
      return reply.code(500).send({ message: "Dokument konnte nicht verarbeitet werden." });
    }
  });
}
