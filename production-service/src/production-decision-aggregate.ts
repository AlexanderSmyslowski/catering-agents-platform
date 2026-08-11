import {
  areJsonValuesEqual,
  createApprovedProductionSpec,
  validateApprovalRequestRecord,
  validateApprovedProductionSpec,
  validateProductionDraft,
  type ApprovedProductionSpec,
  type ApprovalRequestRecord,
  type ProductionDraft
} from "@catering/shared-core";

export interface ProductionDecisionAggregate {
  schemaVersion: "1.0";
  businessId: ApprovalRequestRecord["businessId"];
  sourceDraft: ProductionDraft;
  approval: ApprovalRequestRecord;
  decidedDraft: ProductionDraft;
  approvedProductionSpec?: ApprovedProductionSpec;
}

export function productionDecidedDraftFor(
  sourceDraft: ProductionDraft,
  approval: ApprovalRequestRecord
): ProductionDraft {
  return validateProductionDraft(approval.decision === "approved"
    ? {
      ...sourceDraft,
      status: "approved",
      approvalRequestId: approval.approvalRequestId,
      approvedBy: approval.decidedBy.name,
      approvedAt: approval.decidedAt
    }
    : {
      ...sourceDraft,
      status: "rejected",
      approvalRequestId: approval.approvalRequestId
    });
}

export function validateProductionDecisionAggregate(
  value: ProductionDecisionAggregate
): ProductionDecisionAggregate {
  if (!value || typeof value !== "object" || value.schemaVersion !== "1.0") {
    throw new Error("Ungültiges Produktionsentscheidungsaggregat.");
  }

  const sourceDraft = validateProductionDraft(value.sourceDraft);
  const approval = validateApprovalRequestRecord(value.approval);
  const decidedDraft = validateProductionDraft(value.decidedDraft);
  if (
    value.businessId !== approval.businessId ||
    sourceDraft.businessId !== approval.businessId ||
    sourceDraft.status !== "pending_review" ||
    approval.target.kind !== "production_draft" ||
    approval.target.artifactId !== sourceDraft.draftId ||
    approval.target.revision !== sourceDraft.revision ||
    !areJsonValuesEqual(decidedDraft, productionDecidedDraftFor(sourceDraft, approval))
  ) {
    throw new Error("Produktionsentscheidungsaggregat passt nicht exakt zum Freigabeziel.");
  }

  if (approval.decision === "rejected") {
    if (value.approvedProductionSpec !== undefined) {
      throw new Error("Eine abgelehnte Produktionsentscheidung darf keinen freigegebenen Snapshot enthalten.");
    }
    return value;
  }

  if (!value.approvedProductionSpec) {
    throw new Error("Eine Produktionsfreigabe benötigt einen unveränderlichen Produktionssnapshot.");
  }
  const approvedProductionSpec = validateApprovedProductionSpec(value.approvedProductionSpec);
  const expectedSpec = createApprovedProductionSpec({ draft: sourceDraft, approval });
  if (!areJsonValuesEqual(approvedProductionSpec, expectedSpec)) {
    throw new Error("Freigegebener Produktionssnapshot passt nicht zur autoritativen Entscheidung.");
  }

  return value;
}
