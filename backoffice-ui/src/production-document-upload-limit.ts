import {
  DOCUMENT_UPLOAD_LIMITS,
  formatUploadLimitMegabytes
} from "@catering/shared-core/upload-limits";

export const PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES = DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes;
export const PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL = formatUploadLimitMegabytes("intake");

export function isProductionDocumentUploadAllowed(file: File): boolean {
  return file.size <= PRODUCTION_DOCUMENT_UPLOAD_LIMIT_BYTES;
}

export function productionDocumentUploadLimitErrorMessage(): string {
  return `Die Datei ist zu groß. Maximal erlaubt sind ${PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL}.`;
}
