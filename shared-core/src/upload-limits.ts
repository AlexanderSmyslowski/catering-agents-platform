export const UPLOAD_BYTES_PER_MEGABYTE = 1024 * 1024;
export const INTAKE_DOCUMENT_MAX_FILE_SIZE_BYTES = 25 * UPLOAD_BYTES_PER_MEGABYTE;
export const RECIPE_DOCUMENT_MAX_FILE_SIZE_BYTES = 5 * UPLOAD_BYTES_PER_MEGABYTE;
export const INTAKE_DOCUMENT_JSON_BODY_OVERHEAD_BYTES = 2 * UPLOAD_BYTES_PER_MEGABYTE;

export function base64EncodedLength(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

export const DOCUMENT_UPLOAD_LIMITS = {
  intake: {
    maxFileSizeBytes: INTAKE_DOCUMENT_MAX_FILE_SIZE_BYTES,
    maxJsonBodyBytes:
      base64EncodedLength(INTAKE_DOCUMENT_MAX_FILE_SIZE_BYTES) + INTAKE_DOCUMENT_JSON_BODY_OVERHEAD_BYTES,
    maxFiles: 3,
    maxFields: 4,
    maxParts: 7
  },
  recipe: {
    maxFileSizeBytes: RECIPE_DOCUMENT_MAX_FILE_SIZE_BYTES,
    maxFiles: 1,
    maxFields: 3,
    maxParts: 4
  }
} as const;

export type UploadKind = keyof typeof DOCUMENT_UPLOAD_LIMITS;

export function uploadLimitMegabytes(kind: UploadKind): number {
  return DOCUMENT_UPLOAD_LIMITS[kind].maxFileSizeBytes / UPLOAD_BYTES_PER_MEGABYTE;
}

export function formatUploadLimitMegabytes(kind: UploadKind): string {
  const megabytes = uploadLimitMegabytes(kind);
  return `${Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}
