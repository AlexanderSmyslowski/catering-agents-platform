import { assertBusinessId, type BusinessId } from "./business-context.js";
import type { MinimalMvpRole, TrustedActor } from "./access-control.js";
import type { ApprovalRequestRecord } from "./types.js";
import { validateApprovalRequestRecord } from "./validation.js";

export interface CreateApprovalRequestRecordInput {
  actor: TrustedActor;
  role: MinimalMvpRole;
  target: ApprovalRequestRecord["target"];
  decision: ApprovalRequestRecord["decision"];
  selectedVariantId?: string;
  comment?: string;
  now?: Date;
}

function assertApprovalTarget(target: ApprovalRequestRecord["target"]): void {
  if (target.kind !== "offer_draft" && target.kind !== "production_draft") {
    throw new Error("Ungültige Freigabezielart.");
  }

  if (
    typeof target.artifactId !== "string" ||
    !target.artifactId.trim() ||
    target.artifactId.length > 160
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

  // Escaped components preserve the exact target identity and cannot collide at delimiters.
  return [
    "approval",
    encodeURIComponent(businessId),
    input.target.kind,
    encodeURIComponent(input.target.artifactId),
    String(input.target.revision)
  ].join(":");
}

export function createApprovalRequestRecord(
  input: CreateApprovalRequestRecordInput
): ApprovalRequestRecord {
  if (!input.actor.trusted) {
    throw new Error("Vertrauenswürdiger Actor für finale Freigaben erforderlich.");
  }

  const businessId = assertBusinessId(input.actor.businessId);
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Ungültiger serverseitiger Freigabezeitpunkt.");
  }

  const timestamp = now.toISOString();
  const record: ApprovalRequestRecord = {
    schemaVersion: "1.0",
    approvalRequestId: approvalRequestIdForTarget({ businessId, target: input.target }),
    businessId,
    target: { ...input.target },
    decision: input.decision,
    ...(input.selectedVariantId === undefined ? {} : { selectedVariantId: input.selectedVariantId }),
    requestedAt: timestamp,
    decidedAt: timestamp,
    decidedBy: {
      name: input.actor.name,
      role: input.role,
      source: input.actor.source
    },
    ...(input.comment === undefined ? {} : { comment: input.comment })
  };

  return validateApprovalRequestRecord(record);
}
