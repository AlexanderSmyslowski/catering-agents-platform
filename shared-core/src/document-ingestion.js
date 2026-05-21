import { extractTextFromDocument } from "./document-text.js";
import { createUploadSourceMetadata, isUploadValidationError } from "./upload-security.js";

function sourceMetadataFor(input) {
  return input.document.sourceMetadata ?? createUploadSourceMetadata({
    filename: input.document.filename,
    mimeType: input.document.mimeType,
    content: input.document.content,
    uploadContext: input.context,
    ingestedAt: input.ingestedAt
  });
}

function looksLikePdfFallback(text) {
  return text.trim().startsWith("%PDF") || text.trim().length < 24;
}

export async function ingestDocument(input) {
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
