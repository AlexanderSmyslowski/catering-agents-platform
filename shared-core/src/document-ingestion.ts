import type { DocumentInput, UploadSourceMetadata } from "./types.js";
import { extractTextFromDocument } from "./document-text.js";
import { createUploadSourceMetadata, isUploadValidationError, type UploadContext } from "./upload-security.js";

export type DocumentIngestionContext = UploadContext;
export type DocumentIngestionStatus = "accepted" | "extracted" | "fallback" | "failed";
export type DocumentIngestionWarning =
  | "document_text_extraction_fallback"
  | "document_text_extraction_empty"
  | "document_upload_validation_failed"
  | "document_ingestion_failed";

export interface DocumentIngestionResult {
  context: DocumentIngestionContext;
  status: DocumentIngestionStatus;
  sourceMetadata: UploadSourceMetadata;
  extractedText?: string;
  extractedTextLength: number;
  warnings: DocumentIngestionWarning[];
  ingestedAt: string;
}

interface DocumentIngestionInput {
  document: DocumentInput;
  context: DocumentIngestionContext;
  ingestedAt?: string;
}

function sourceMetadataFor(input: DocumentIngestionInput): UploadSourceMetadata {
  return input.document.sourceMetadata ?? createUploadSourceMetadata({
    filename: input.document.filename,
    mimeType: input.document.mimeType,
    content: input.document.content,
    uploadContext: input.context,
    ingestedAt: input.ingestedAt
  });
}

function looksLikePdfFallback(text: string): boolean {
  return text.trim().startsWith("%PDF") || text.trim().length < 24;
}

export async function ingestDocument(input: DocumentIngestionInput): Promise<DocumentIngestionResult> {
  const sourceMetadata = sourceMetadataFor(input);

  try {
    const text = (await extractTextFromDocument(input.document)).trim();
    const isPdf = sourceMetadata.mimeType.includes("pdf") || input.document.mimeType.toLowerCase().includes("pdf");

    if (!text) {
      return {
        context: input.context,
        status: "fallback",
        sourceMetadata,
        extractedTextLength: 0,
        warnings: ["document_text_extraction_empty"],
        ingestedAt: sourceMetadata.ingestedAt
      };
    }

    if (isPdf && looksLikePdfFallback(text)) {
      return {
        context: input.context,
        status: "fallback",
        sourceMetadata,
        extractedTextLength: 0,
        warnings: ["document_text_extraction_fallback"],
        ingestedAt: sourceMetadata.ingestedAt
      };
    }

    return {
      context: input.context,
      status: "extracted",
      sourceMetadata,
      extractedText: text,
      extractedTextLength: text.length,
      warnings: [],
      ingestedAt: sourceMetadata.ingestedAt
    };
  } catch (error) {
    return {
      context: input.context,
      status: "failed",
      sourceMetadata,
      extractedTextLength: 0,
      warnings: [isUploadValidationError(error) ? "document_upload_validation_failed" : "document_ingestion_failed"],
      ingestedAt: sourceMetadata.ingestedAt
    };
  }
}
