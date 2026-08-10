import { createHash } from "node:crypto";
import {
  isMinimalMvpRole,
  isTrustedFinalApprovalSource
} from "./access-control.js";
import { assertBusinessId, type BusinessId } from "./business-context.js";
import type { ApprovalRequestRecord } from "./types.js";

export const approvalTargetArtifactIdMaxCodePoints = 160;

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const followingCodeUnit = value.charCodeAt(index + 1);
      if (
        !Number.isInteger(followingCodeUnit) ||
        followingCodeUnit < 0xdc00 ||
        followingCodeUnit > 0xdfff
      ) {
        return false;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }

  return true;
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function hasNonWhitespaceCharacter(value: string): boolean {
  return /\S/u.test(value);
}

function appendLengthPrefixed(hash: ReturnType<typeof createHash>, value: string): void {
  const bytes = Buffer.from(value, "utf8");
  hash.update(String(bytes.length));
  hash.update(":");
  hash.update(bytes);
}

export function assertApprovalTarget(target: ApprovalRequestRecord["target"]): void {
  if (target.kind !== "offer_draft" && target.kind !== "production_draft") {
    throw new Error("Ungültige Freigabezielart.");
  }

  if (
    typeof target.artifactId !== "string" ||
    !isWellFormedUnicode(target.artifactId) ||
    !hasNonWhitespaceCharacter(target.artifactId) ||
    codePointLength(target.artifactId) > approvalTargetArtifactIdMaxCodePoints
  ) {
    throw new Error("Ungültige Freigabezielkennung.");
  }

  if (!Number.isInteger(target.revision) || target.revision < 1 || target.revision > 2147483647) {
    throw new Error("Ungültige Freigabezielrevision.");
  }
}

export function approvalRequestIdForTarget(input: {
  businessId: BusinessId;
  target: ApprovalRequestRecord["target"];
}): string {
  const businessId = assertBusinessId(input.businessId);
  assertApprovalTarget(input.target);

  const hash = createHash("sha256");
  hash.update("approval-request-id:v1\u0000");
  for (const component of [businessId, input.target.kind, input.target.artifactId, String(input.target.revision)]) {
    appendLengthPrefixed(hash, component);
  }

  return `approval-${hash.digest("hex")}`;
}

export function assertApprovalRequestRecordSemantics(record: ApprovalRequestRecord): void {
  assertApprovalTarget(record.target);

  if (record.decision !== "approved" && record.decision !== "rejected") {
    throw new Error("Ungültige finale Freigabeentscheidung.");
  }

  if (!isMinimalMvpRole(record.decidedBy.role)) {
    throw new Error("Ungültige Freigaberolle.");
  }

  if (!isTrustedFinalApprovalSource(record.decidedBy.source)) {
    throw new Error("Ungültige Freigabeprovenienz.");
  }

  const requestedAt = Date.parse(record.requestedAt);
  const decidedAt = Date.parse(record.decidedAt);
  if (Number.isNaN(requestedAt) || Number.isNaN(decidedAt) || requestedAt > decidedAt) {
    throw new Error("Ungültige Freigabezeitachse.");
  }

  if (record.comment !== undefined && !hasNonWhitespaceCharacter(record.comment)) {
    throw new Error("Freigabekommentar darf nicht leer sein.");
  }

  const canonicalId = approvalRequestIdForTarget({
    businessId: record.businessId,
    target: record.target
  });
  if (record.approvalRequestId !== canonicalId) {
    throw new Error("approvalRequestId does not match its target");
  }
}
