import path from "node:path";
import type { DocumentInput } from "./types.js";

export const DOCUMENT_UPLOAD_LIMITS = {
  intake: {
    maxFileSizeBytes: 8 * 1024 * 1024,
    maxFiles: 3,
    maxFields: 4,
    maxParts: 7
  },
  recipe: {
    maxFileSizeBytes: 5 * 1024 * 1024,
    maxFiles: 1,
    maxFields: 3,
    maxParts: 4
  }
} as const;

type UploadKind = keyof typeof DOCUMENT_UPLOAD_LIMITS;

const ALLOWED_DOCUMENT_TYPES = [
  { extension: ".pdf", mimeTypes: ["application/pdf"] },
  { extension: ".txt", mimeTypes: ["text/plain"] },
  { extension: ".md", mimeTypes: ["text/markdown", "text/plain"] },
  { extension: ".eml", mimeTypes: ["message/rfc822", "text/plain"] },
  { extension: ".pages", mimeTypes: ["application/vnd.apple.pages", "application/zip", "application/octet-stream"] }
] as const;

export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function multipartLimitsForUpload(kind: UploadKind) {
  const limits = DOCUMENT_UPLOAD_LIMITS[kind];
  return {
    fileSize: limits.maxFileSizeBytes,
    files: limits.maxFiles,
    fields: limits.maxFields,
    parts: limits.maxParts
  };
}

function normalizedExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function normalizedMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
}

export function validateUploadedDocumentMetadata(input: Pick<DocumentInput, "filename" | "mimeType">): void {
  const extension = normalizedExtension(input.filename);
  const mimeType = normalizedMimeType(input.mimeType);
  const allowed = ALLOWED_DOCUMENT_TYPES.find((item) => item.extension === extension);

  if (!allowed) {
    throw new UploadValidationError(`Dateityp ${extension || "ohne Erweiterung"} ist nicht erlaubt.`);
  }

  if (!allowed.mimeTypes.includes(mimeType as never)) {
    throw new UploadValidationError(`MIME-Typ ${input.mimeType || "unbekannt"} ist fuer ${extension} nicht erlaubt.`);
  }
}

export function validateUploadedDocumentSize(sizeBytes: number, kind: UploadKind): void {
  const maxFileSizeBytes = DOCUMENT_UPLOAD_LIMITS[kind].maxFileSizeBytes;
  if (sizeBytes > maxFileSizeBytes) {
    throw new UploadValidationError(
      `Datei ist zu gross. Maximal erlaubt sind ${maxFileSizeBytes} Bytes.`,
      413
    );
  }
}

export function validateUploadedDocument(input: DocumentInput, kind: UploadKind): void {
  validateUploadedDocumentMetadata(input);
  validateUploadedDocumentSize(input.content.length, kind);
}

export async function readLimitedUploadBuffer(
  stream: AsyncIterable<Buffer | Uint8Array>,
  kind: UploadKind
): Promise<Buffer> {
  const maxFileSizeBytes = DOCUMENT_UPLOAD_LIMITS[kind].maxFileSizeBytes;
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxFileSizeBytes) {
      const destroyable = stream as { destroy?: () => void };
      destroyable.destroy?.();
      validateUploadedDocumentSize(totalBytes, kind);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

export function isUploadValidationError(error: unknown): error is UploadValidationError {
  return error instanceof UploadValidationError;
}

export function uploadErrorResponse(error: unknown): { statusCode: number; message: string } {
  if (isUploadValidationError(error)) {
    return {
      statusCode: error.statusCode,
      message: error.message
    };
  }

  const maybeError = error as { code?: string; message?: string; statusCode?: number };
  if (maybeError?.code === "FST_REQ_FILE_TOO_LARGE" || maybeError?.statusCode === 413) {
    return {
      statusCode: 413,
      message: "Datei ist zu gross. Upload wurde abgelehnt."
    };
  }

  return {
    statusCode: 400,
    message: maybeError?.message ?? "Upload konnte nicht verarbeitet werden."
  };
}
