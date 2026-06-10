import { PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL } from "./production-document-upload-limit.js";

export function formatSubmitErrorMessage(error: unknown, fallbackMessage: string): string {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return normalizeUploadLimitMessage(message);
}

function formatBytesAsMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  const rounded = Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1);
  return `${rounded} MB`;
}

function normalizeUploadLimitMessage(message: string): string {
  if (!/datei ist zu gro(?:ss|ß)|file too large|payload too large/i.test(message)) {
    return message;
  }

  const byteMatch = message.match(/maximal erlaubt sind\s+(\d+)\s+bytes/i);
  const maxSize = byteMatch ? formatBytesAsMegabytes(Number(byteMatch[1])) : PRODUCTION_DOCUMENT_UPLOAD_LIMIT_LABEL;
  return `Die Datei ist zu groß. Maximal erlaubt sind ${maxSize}.`;
}
