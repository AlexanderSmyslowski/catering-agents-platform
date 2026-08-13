import type { BusinessContext, ByoLlmDataClass } from "@catering/shared-core";

/** Server-authored metadata for an already registered source document. */
export interface StoredSourceDocument {
  businessId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  dataClass: ByoLlmDataClass;
  createdAt: string;
}

export interface SourceDocumentMetadataReader {
  getMetadata(
    context: BusinessContext,
    documentId: string
  ): Promise<StoredSourceDocument | undefined>;
}
