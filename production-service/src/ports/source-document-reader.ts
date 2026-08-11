import type {
  BusinessContext,
  ByoLlmDataClass
} from "@catering/shared-core";

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

export interface SourceDocumentReader {
  getMetadata(
    context: BusinessContext,
    documentId: string
  ): Promise<StoredSourceDocument | undefined>;
  getContent(
    context: BusinessContext,
    documentId: string
  ): Promise<Uint8Array | undefined>;
}
