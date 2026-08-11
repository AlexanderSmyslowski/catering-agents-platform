import {
  byoLlmDataClasses,
  type BusinessContext,
  type ByoLlmDataClass
} from "@catering/shared-core";
import type {
  SourceDocumentReader,
  StoredSourceDocument
} from "../ports/source-document-reader.js";

export interface HttpSourceDocumentReaderOptions {
  intakeServiceUrl: string;
  trustedServiceSecret?: string;
  fetch?: typeof globalThis.fetch;
}

const dataClasses = new Set<ByoLlmDataClass>(byoLlmDataClasses);

function validateMetadata(value: unknown): StoredSourceDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Quelldokument-Metadaten fehlen.");
  }
  const item = value as Record<string, unknown>;
  const requiredStrings = [
    "businessId",
    "documentId",
    "filename",
    "mimeType",
    "sha256",
    "dataClass",
    "createdAt"
  ] as const;
  if (requiredStrings.some((key) => typeof item[key] !== "string" || !(item[key] as string).trim())) {
    throw new Error("Quelldokument-Metadaten sind unvollständig.");
  }
  if (!Number.isSafeInteger(item.sizeBytes) || (item.sizeBytes as number) < 0) {
    throw new Error("Quelldokument-Metadaten enthalten keine gültige Größe.");
  }
  if (!/^[a-f0-9]{64}$/.test(item.sha256 as string)) {
    throw new Error("Quelldokument-Metadaten enthalten keinen gültigen SHA-256-Wert.");
  }
  if (!dataClasses.has(item.dataClass as ByoLlmDataClass)) {
    throw new Error("Quelldokument-Metadaten enthalten keine gültige Datenklasse.");
  }
  if (Number.isNaN(Date.parse(item.createdAt as string))) {
    throw new Error("Quelldokument-Metadaten enthalten keinen gültigen Zeitpunkt.");
  }
  return item as unknown as StoredSourceDocument;
}

export class HttpSourceDocumentReader implements SourceDocumentReader {
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: HttpSourceDocumentReaderOptions) {
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
    const metadata = validateMetadata(
      (payload as { sourceDocument?: unknown } | undefined)?.sourceDocument
    );
    if (metadata.businessId !== context.businessId || metadata.documentId !== documentId) {
      throw new Error("Quelldokument passt nicht zur angeforderten Identität.");
    }
    return metadata;
  }

  async getContent(
    context: BusinessContext,
    documentId: string
  ): Promise<Uint8Array | undefined> {
    const response = await this.request(
      context,
      `/v1/intake/internal/source-documents/${encodeURIComponent(documentId)}/content`
    );
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error("Quelldokument-Inhalt konnte nicht geladen werden.");
    if (
      response.headers.get("x-catering-business-id") !== context.businessId ||
      response.headers.get("x-catering-source-document-id") !== documentId
    ) {
      throw new Error("Quelldokument-Inhalt passt nicht zur angeforderten Identität.");
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private async request(context: BusinessContext, path: string): Promise<Response> {
    try {
      return await this.fetcher(
        `${this.options.intakeServiceUrl.replace(/\/$/, "")}${path}`,
        {
          redirect: "error",
          headers: {
            "x-catering-actor-name": "Production-Service",
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
