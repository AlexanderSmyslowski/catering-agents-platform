import {
  byoLlmDataClasses,
  validateAcceptedEventSpec,
  validateEventRequest,
  type AcceptedEventSpec,
  type BusinessContext,
  type ByoLlmDataClass,
  type EventRequest
} from "@catering/shared-core";
import type {
  SourceDocumentMetadataReader,
  StoredSourceDocument
} from "../ports/source-document-reader.js";

export interface HttpSourceDocumentMetadataReaderOptions {
  intakeServiceUrl: string;
  trustedServiceSecret?: string;
  fetch?: typeof globalThis.fetch;
}

const allowedDataClasses = new Set<ByoLlmDataClass>(byoLlmDataClasses);

function readText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Quelldokument-Metadaten sind unvollständig.");
  }
  return value.trim();
}

function readMetadata(value: unknown): StoredSourceDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Quelldokument-Metadaten fehlen.");
  }
  const record = value as Record<string, unknown>;
  const businessId = readText(record, "businessId");
  const documentId = readText(record, "documentId");
  const filename = readText(record, "filename");
  const mimeType = readText(record, "mimeType");
  const sha256 = readText(record, "sha256");
  const dataClass = readText(record, "dataClass") as ByoLlmDataClass;
  const createdAt = readText(record, "createdAt");
  if (!Number.isSafeInteger(record.sizeBytes) || (record.sizeBytes as number) < 0) {
    throw new Error("Quelldokument-Metadaten enthalten keine gültige Größe.");
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("Quelldokument-Metadaten enthalten keinen gültigen SHA-256-Wert.");
  }
  if (!allowedDataClasses.has(dataClass) || Number.isNaN(Date.parse(createdAt))) {
    throw new Error("Quelldokument-Metadaten enthalten ungültige Werte.");
  }
  return {
    businessId,
    documentId,
    filename,
    mimeType,
    sizeBytes: record.sizeBytes as number,
    sha256,
    dataClass,
    createdAt
  };
}

/** Reads provenance through the authenticated Intake boundary; it never accepts browser metadata. */
export class HttpSourceDocumentMetadataReader implements SourceDocumentMetadataReader {
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: HttpSourceDocumentMetadataReaderOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async getMetadata(
    context: BusinessContext,
    documentId: string
  ): Promise<StoredSourceDocument | undefined> {
    const response = await this.request(
      context,
      `/v1/intake/internal/source-documents/${encodeURIComponent(documentId)}`
    );
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error("Quelldokument-Metadaten konnten nicht geladen werden.");
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Quelldokument-Metadaten sind kein gültiges JSON.");
    }
    const metadata = readMetadata(
      (payload as { sourceDocument?: unknown } | undefined)?.sourceDocument
    );
    if (metadata.businessId !== context.businessId || metadata.documentId !== documentId) {
      throw new Error("Quelldokument passt nicht zur angeforderten Identität.");
    }
    return metadata;
  }

  async getRequest(
    context: BusinessContext,
    requestId: string
  ): Promise<EventRequest | undefined> {
    const response = await this.request(
      context,
      `/v1/intake/internal/requests/${encodeURIComponent(requestId)}`
    );
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error("Intake-Request konnte nicht geladen werden.");
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Intake-Request ist kein gültiges JSON.");
    }
    try {
      return validateEventRequest(
        (payload as { eventRequest?: unknown } | undefined)?.eventRequest as EventRequest
      );
    } catch {
      throw new Error("Intake-Request ist nicht schema-valide.");
    }
  }

  async getSpec(
    context: BusinessContext,
    specId: string
  ): Promise<AcceptedEventSpec | undefined> {
    const response = await this.request(
      context,
      `/v1/intake/internal/specs/${encodeURIComponent(specId)}`
    );
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error("AcceptedEventSpec konnte nicht geladen werden.");
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("AcceptedEventSpec ist kein gültiges JSON.");
    }
    try {
      const spec = validateAcceptedEventSpec(
        (payload as { acceptedEventSpec?: unknown } | undefined)?.acceptedEventSpec as AcceptedEventSpec
      );
      if (spec.specId !== specId) {
        throw new Error("AcceptedEventSpec passt nicht zur angeforderten Identität.");
      }
      return spec;
    } catch {
      throw new Error("AcceptedEventSpec ist nicht schema-valide.");
    }
  }

  private async request(context: BusinessContext, path: string): Promise<Response> {
    try {
      return await this.fetcher(
        `${this.options.intakeServiceUrl.replace(/\/$/, "")}${path}`,
        {
          redirect: "error",
          headers: {
            accept: "application/json",
            "x-catering-actor-name": "Offer-Service",
            "x-catering-business-id": context.businessId,
            ...(this.options.trustedServiceSecret
              ? { "x-catering-trusted-secret": this.options.trustedServiceSecret }
              : {})
          }
        }
      );
    } catch (error) {
      throw new Error("Quelldokument konnte nicht vom Intake-Service geladen werden.", {
        cause: error
      });
    }
  }
}
