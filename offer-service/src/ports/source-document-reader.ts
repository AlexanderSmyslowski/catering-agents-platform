import type {
  AcceptedEventSpec,
  BusinessContext,
  ByoLlmDataClass,
  EventRequest
} from "@catering/shared-core";

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
  /** Inserts an immutable text source through Intake; never accepts caller-authored specs. */
  ensureTextRequest?(
    context: BusinessContext, requestId: string, text: string
  ): Promise<AcceptedEventSpec>;

  getMetadata(
    context: BusinessContext,
    documentId: string
  ): Promise<StoredSourceDocument | undefined>;

  /** Reads the server-owned Intake request that carries a registered source. */
  getRequest?(
    context: BusinessContext,
    requestId: string
  ): Promise<EventRequest | undefined>;

  /** Reads the server-owned AcceptedEventSpec that carries production decisions. */
  getSpec?(
    context: BusinessContext,
    specId: string
  ): Promise<AcceptedEventSpec | undefined>;
}
