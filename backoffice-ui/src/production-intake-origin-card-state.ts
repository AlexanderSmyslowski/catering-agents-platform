import type { IntakeRequestDetail } from "./api.js";

export type ProductionIntakeOriginCardRawInputState = {
  key: string;
  kindLabel: string;
  mimeTypeLabel?: string;
  documentIngestionSummary?: string;
  sourceMetadataSummary?: string;
};

export type ProductionIntakeOriginCardState = {
  requestSummaryLabel: string;
  rawInputs: ProductionIntakeOriginCardRawInputState[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function formatSourceMetadataSummary(input: Record<string, unknown>): string | undefined {
  const sourceMetadata = asRecord(input.sourceMetadata);
  const filename = readStringOrNumber(sourceMetadata, ["filename"]);
  const mimeType = readStringOrNumber(sourceMetadata, ["mimeType"]);
  const sizeBytes = sourceMetadata?.sizeBytes;
  const sha256 = readStringOrNumber(sourceMetadata, ["sha256"]);
  const uploadContext = readStringOrNumber(sourceMetadata, ["uploadContext"]);
  const ingestedAt = readStringOrNumber(sourceMetadata, ["ingestedAt"]);

  if (!filename || !mimeType || typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || !sha256 || !uploadContext) {
    return undefined;
  }

  return [filename, mimeType, formatBytes(sizeBytes), `sha256:${sha256.slice(0, 12)}`, uploadContext, ingestedAt]
    .filter(Boolean)
    .join(" · ");
}

export function formatDocumentIngestionSummary(input: Record<string, unknown>): string | undefined {
  const marker = asRecord(input.documentIngestion);
  const status = readStringOrNumber(marker, ["status"]);
  const warnings = Array.isArray(marker?.warnings)
    ? marker.warnings.map((warning) => String(warning).trim()).filter(Boolean)
    : [];

  if (!status || (status === "extracted" && warnings.length === 0)) {
    return undefined;
  }

  return [`Status ${status}`, warnings.length > 0 ? `Warnkey ${warnings.join(",")}` : undefined]
    .filter(Boolean)
    .join(" · ");
}

export function buildProductionIntakeOriginCardState(
  intakeRequestDetail: IntakeRequestDetail
): ProductionIntakeOriginCardState {
  const source = asRecord(intakeRequestDetail.source);
  const rawInputs = Array.isArray(intakeRequestDetail.rawInputs) ? intakeRequestDetail.rawInputs : [];

  return {
    requestSummaryLabel: `requestId: ${String(intakeRequestDetail.requestId ?? "-")} · channel: ${String(
      source?.channel ?? "-"
    )} · receivedAt: ${String(source?.receivedAt ?? "-")}`,
    rawInputs: rawInputs.map((rawInput, index) => {
      const rawInputRecord = rawInput as Record<string, unknown>;
      const documentId = readStringOrNumber(rawInputRecord, ["documentId"]);
      const kind = readStringOrNumber(rawInputRecord, ["kind"]) ?? "-";
      const mimeType = readStringOrNumber(rawInputRecord, ["mimeType"]);

      return {
        key: `${documentId ?? kind ?? index}-${index}`,
        kindLabel: kind,
        mimeTypeLabel: mimeType ? ` · ${mimeType}` : undefined,
        documentIngestionSummary: formatDocumentIngestionSummary(rawInputRecord),
        sourceMetadataSummary: formatSourceMetadataSummary(rawInputRecord)
      };
    })
  };
}
