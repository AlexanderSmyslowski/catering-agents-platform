import {
  assertTrustedFinalApprovalActor,
  type MinimalMvpRole,
  type TrustedActor
} from "./access-control.js";
import {
  approvalRequestIdForTarget
} from "./approval-request-identity.js";
import type { ApprovalRequestRecord } from "./types.js";
import { validateApprovalRequestRecord } from "./validation.js";

export { approvalRequestIdForTarget } from "./approval-request-identity.js";

export interface CreateApprovalRequestRecordInput {
  actor: TrustedActor;
  role: MinimalMvpRole;
  target: ApprovalRequestRecord["target"];
  decision: ApprovalRequestRecord["decision"];
  selectedVariantId?: string;
  comment?: string;
  now?: Date;
}

export function createApprovalRequestRecord(
  input: CreateApprovalRequestRecordInput
): ApprovalRequestRecord {
  assertTrustedFinalApprovalActor(input.actor);
  if (input.actor.source === "authenticated-session" && input.actor.role !== input.role) {
    throw new Error("Die Freigaberolle muss der aktuellen Sitzungsrolle entsprechen.");
  }

  const businessId = input.actor.businessId;
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
