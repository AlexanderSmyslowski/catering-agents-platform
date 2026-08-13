import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  UploadValidationError,
  createUploadSourceMetadata,
  multipartLimitsForUpload,
  readLimitedUploadBuffer,
  uploadErrorResponse,
  validateUploadedDocument,
  validateUploadedDocumentMetadata,
  validateUploadedDocumentSize,
  type AuditLogStore,
  type TrustedActor
} from "@catering/shared-core";
import {
  insertRegisteredSourceDocument,
  SourceDocumentConflictError,
  type SourceDocumentStore,
  type StoredSourceDocument
} from "../source-document-store.js";

interface MultipartFileStream extends AsyncIterable<Buffer | Uint8Array> {
  truncated?: boolean;
}

interface MultipartPart {
  type: "file" | "field";
  filename?: string;
  mimetype?: string;
  file?: MultipartFileStream;
  toBuffer?: () => Promise<Buffer>;
}

interface MultipartSourceRequest {
  isMultipart: () => boolean;
  parts: (options?: {
    limits?: {
      fileSize?: number;
      files?: number;
      fields?: number;
      parts?: number;
    };
  }) => AsyncIterable<MultipartPart>;
}

interface ReplyGate {
  code: (statusCode: number) => { send: (payload: unknown) => unknown };
}

export interface SourceDocumentRouteDependencies {
  sourceDocumentStore: SourceDocumentStore;
  auditLog: Pick<AuditLogStore, "logFor">;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  requireIntakeOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: ReplyGate,
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => unknown | undefined;
  actorForRequest: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => TrustedActor;
}

async function extractSingleSource(request: FastifyRequest): Promise<{
  filename: string;
  mimeType: string;
  content: Buffer;
}> {
  const multipartRequest = request as unknown as MultipartSourceRequest;
  if (!multipartRequest.isMultipart()) {
    throw new UploadValidationError("Es wurde kein Multipart-Upload gesendet.");
  }

  let uploaded:
    | { filename: string; mimeType: string; content: Buffer }
    | undefined;

  for await (const part of multipartRequest.parts({
    limits: multipartLimitsForUpload("intake")
  })) {
    if (part.type !== "file") {
      // Upload metadata is intentionally ignored; classification and ownership are server-authored.
      continue;
    }
    if (uploaded) {
      throw new UploadValidationError("Pro Quelldokument-Upload ist genau eine Datei erlaubt.");
    }
    if (!part.filename || !part.toBuffer) {
      throw new UploadValidationError("Die Dokumentdatei ist unvollständig.");
    }

    const mimeType = part.mimetype ?? "application/octet-stream";
    validateUploadedDocumentMetadata({ filename: part.filename, mimeType });
    const content = part.file
      ? await readLimitedUploadBuffer(part.file, "intake")
      : await part.toBuffer();
    if (part.file?.truncated) {
      validateUploadedDocumentSize(content.byteLength + 1, "intake");
    }
    validateUploadedDocument(
      {
        filename: part.filename,
        mimeType,
        content
      },
      "intake"
    );
    uploaded = { filename: part.filename, mimeType, content };
  }

  if (!uploaded) {
    throw new UploadValidationError("Es wurde keine Dokumentdatei mitgesendet.");
  }
  return uploaded;
}

function encodedDispositionFilename(filename: string): string {
  return encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function asciiDispositionFilename(filename: string): string {
  const safe = filename
    .replace(/[\r\n]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return safe || "source-document";
}

function contentDisposition(filename: string): string {
  return `inline; filename="${asciiDispositionFilename(filename)}"; filename*=UTF-8''${encodedDispositionFilename(filename)}`;
}

export function registerSourceDocumentRoutes(
  app: FastifyInstance,
  deps: SourceDocumentRouteDependencies
): void {
  const {
    sourceDocumentStore,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    requireIntakeOperator,
    actorForRequest
  } = deps;

  const trustedSourceServiceActor = (
    request: { headers: Record<string, string | string[] | undefined> }
  ): TrustedActor | undefined => {
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return actor.trusted && (actor.name === "Production-Service" || actor.name === "Offer-Service")
      ? actor
      : undefined;
  };

  app.get<{ Params: { documentId: string } }>(
    "/v1/intake/internal/source-documents/:documentId",
    async (request, reply) => {
      const actor = trustedSourceServiceActor(request);
      if (!actor) return reply.code(403).send({ message: "Interner Quelldokument-Dienst erforderlich." });
      const sourceDocument = await sourceDocumentStore.getMetadata(
        actor,
        request.params.documentId
      );
      if (!sourceDocument) {
        return reply.code(404).send({ message: "Quelldokument nicht gefunden." });
      }
      reply.header("cache-control", "private, no-store");
      reply.header("x-content-type-options", "nosniff");
      return reply.send({ sourceDocument });
    }
  );

  app.get<{ Params: { documentId: string } }>(
    "/v1/intake/internal/source-documents/:documentId/content",
    async (request, reply) => {
      const actor = trustedSourceServiceActor(request);
      if (!actor) return reply.code(403).send({ message: "Interner Quelldokument-Dienst erforderlich." });
      const [metadata, content] = await Promise.all([
        sourceDocumentStore.getMetadata(actor, request.params.documentId),
        sourceDocumentStore.getContent(actor, request.params.documentId)
      ]);
      if (!metadata || !content) {
        return reply.code(404).send({ message: "Quelldokument nicht gefunden." });
      }
      reply.header("cache-control", "private, no-store");
      reply.header("x-content-type-options", "nosniff");
      reply.header("x-catering-business-id", actor.businessId);
      reply.header("x-catering-source-document-id", metadata.documentId);
      reply.header("content-length", String(content.byteLength));
      return reply.type(metadata.mimeType).send(Buffer.from(content));
    }
  );

  app.post("/v1/intake/source-documents", async (request, reply) => {
    const forbidden = requireIntakeOperator(
      request,
      reply,
      trustedActorSecret,
      allowDevActorHeader
    );
    if (forbidden) {
      return forbidden;
    }

    let source: Awaited<ReturnType<typeof extractSingleSource>>;
    try {
      source = await extractSingleSource(request);
    } catch (error) {
      const uploadError = uploadErrorResponse(error, "intake");
      return reply.code(uploadError.statusCode).send({ message: uploadError.message });
    }

    const actor = actorForRequest(
      request,
      trustedActorSecret,
      allowDevActorHeader
    );
    const sourceMetadata = createUploadSourceMetadata({
      filename: source.filename,
      mimeType: source.mimeType,
      content: source.content,
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

    try {
      await insertRegisteredSourceDocument({
        store: sourceDocumentStore,
        auditLog,
        actor,
        metadata,
        content: source.content
      });
    } catch (error) {
      if (error instanceof SourceDocumentConflictError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      request.log.error(
        { errorType: error instanceof Error ? error.name : typeof error },
        "source document registration or storage failed"
      );
      return reply.code(500).send({ message: "Quelldokument konnte nicht gespeichert werden." });
    }

    return reply.code(201).send(metadata);
  });

  app.get<{ Params: { documentId: string } }>(
    "/v1/intake/source-documents/:documentId",
    async (request, reply) => {
      const forbidden = requireIntakeOperator(
        request,
        reply,
        trustedActorSecret,
        allowDevActorHeader
      );
      if (forbidden) {
        return forbidden;
      }

      const actor = actorForRequest(
        request,
        trustedActorSecret,
        allowDevActorHeader
      );
      reply.header("cache-control", "private, no-store");
      reply.header("x-content-type-options", "nosniff");
      try {
        const metadata = await sourceDocumentStore.getMetadata(
          actor,
          request.params.documentId
        );
        if (!metadata) {
          return reply.code(404).send({ message: "Quelldokument nicht gefunden." });
        }
        return reply.send(metadata);
      } catch (error) {
        request.log.error(
          { errorType: error instanceof Error ? error.name : typeof error },
          "source document metadata retrieval failed"
        );
        return reply.code(500).send({ message: "Quelldokument konnte nicht gelesen werden." });
      }
    }
  );

  app.get<{ Params: { documentId: string } }>(
    "/v1/intake/source-documents/:documentId/content",
    async (request, reply) => {
      const forbidden = requireIntakeOperator(
        request,
        reply,
        trustedActorSecret,
        allowDevActorHeader
      );
      if (forbidden) {
        return forbidden;
      }

      const actor = actorForRequest(
        request,
        trustedActorSecret,
        allowDevActorHeader
      );
      reply.header("cache-control", "private, no-store");
      reply.header("x-content-type-options", "nosniff");
      try {
        const metadata = await sourceDocumentStore.getMetadata(
          actor,
          request.params.documentId
        );
        if (!metadata) {
          return reply.code(404).send({ message: "Quelldokument nicht gefunden." });
        }
        const content = await sourceDocumentStore.getContent(
          actor,
          request.params.documentId
        );
        if (!content) {
          return reply.code(404).send({ message: "Quelldokument nicht gefunden." });
        }

        // Both filename parameters are emitted: ASCII clients remain usable while UTF-8 names round-trip exactly.
        reply.header("content-disposition", contentDisposition(metadata.filename));
        reply.header("content-length", String(content.byteLength));
        return reply.type(metadata.mimeType).send(Buffer.from(content));
      } catch (error) {
        request.log.error(
          { errorType: error instanceof Error ? error.name : typeof error },
          "source document content retrieval failed"
        );
        return reply.code(500).send({ message: "Quelldokument konnte nicht gelesen werden." });
      }
    }
  );
}
