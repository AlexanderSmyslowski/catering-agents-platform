import type { IntakeRequestDetail } from "./api.js";

type ProductionIntakeOriginCardProps = {
  intakeRequestDetail: IntakeRequestDetail;
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

  return [
    filename,
    mimeType,
    formatBytes(sizeBytes),
    `sha256:${sha256.slice(0, 12)}`,
    uploadContext,
    ingestedAt
  ]
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

  return [`Status ${status}`, warnings.length > 0 ? `Warnkey ${warnings.join(",")}` : undefined].filter(Boolean).join(" · ");
}

export function ProductionIntakeOriginCard({ intakeRequestDetail }: ProductionIntakeOriginCardProps) {
  return (
    <div className="component-answer-card">
      <p className="eyebrow">Ursprüngliche Intake-Anfrage</p>
      <p className="helper-text">
        {`requestId: ${String(intakeRequestDetail.requestId ?? "-")} · channel: ${String(
          (intakeRequestDetail.source as Record<string, unknown> | undefined)?.channel ?? "-"
        )} · receivedAt: ${String(
          (intakeRequestDetail.source as Record<string, unknown> | undefined)?.receivedAt ?? "-"
        )}`}
      </p>
      <ul className="item-list compact">
        {Array.isArray(intakeRequestDetail.rawInputs)
          ? intakeRequestDetail.rawInputs.map((rawInput, index) => {
              const rawInputRecord = rawInput as Record<string, unknown>;
              const sourceMetadataSummary = formatSourceMetadataSummary(rawInputRecord);
              const documentIngestionSummary = formatDocumentIngestionSummary(rawInputRecord);
              return (
                <li key={`${String(rawInputRecord.documentId ?? rawInputRecord.kind ?? index)}-${index}`}>
                  <strong>{String(rawInputRecord.kind ?? "-")}</strong>
                  <p className="helper-text">
                    {`${String(rawInputRecord.mimeType ? ` · ${rawInputRecord.mimeType}` : "")}`}
                  </p>
                  {documentIngestionSummary ? (
                    <p className="helper-text">Ingestion-Warnung: {documentIngestionSummary}</p>
                  ) : null}
                  {sourceMetadataSummary ? (
                    <p className="helper-text">Quellenmetadaten (gekürzt): {sourceMetadataSummary}</p>
                  ) : null}
                </li>
              );
            })
          : null}
      </ul>
    </div>
  );
}
