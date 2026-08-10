import { createHash } from "node:crypto";
import {
  areJsonValuesEqual,
  validateApprovalRequestRecord,
  validateApprovedOffer,
  type ApprovalRequestRecord,
  type ApprovedOffer
} from "@catering/shared-core";

export interface OfferDecisionAggregate {
  schemaVersion: "1.0";
  businessId: ApprovalRequestRecord["businessId"];
  approval: ApprovalRequestRecord;
  approvedOffer?: ApprovedOffer;
}

export function approvedOfferIdForApproval(
  approval: Pick<ApprovalRequestRecord, "approvalRequestId" | "businessId">
): string {
  const identity = {
    businessId: approval.businessId,
    approvalRequestId: approval.approvalRequestId
  };
  return `approved-offer-${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
}

export function validateOfferDecisionAggregate(value: OfferDecisionAggregate): OfferDecisionAggregate {
  if (!value || typeof value !== "object" || value.schemaVersion !== "1.0" || !value.approval) {
    throw new Error("Ungültiges Angebotsentscheidungsaggregat.");
  }
  const approval = validateApprovalRequestRecord(value.approval);
  if (value.businessId !== approval.businessId || approval.target.kind !== "offer_draft") {
    throw new Error("Angebotsentscheidungsaggregat passt nicht zum Freigabeziel.");
  }
  if (approval.decision === "rejected") {
    if (approval.selectedVariantId !== undefined || value.approvedOffer !== undefined) {
      throw new Error("Eine abgelehnte Angebotsentscheidung darf kein freigegebenes Angebot enthalten.");
    }
    return value;
  }

  if (!value.approvedOffer) {
    throw new Error("Eine Angebotsfreigabe benötigt einen unveränderlichen Angebotssnapshot.");
  }
  const approvedOffer = validateApprovedOffer(value.approvedOffer);
  const selectedPricing = approvedOffer.selectedVariant.proposedEventSpec.budgetContext?.pricingSummary;
  if (
    approval.selectedVariantId === undefined
    || approvedOffer.businessId !== approval.businessId
    || approvedOffer.approvedOfferId !== approvedOfferIdForApproval(approval)
    || approvedOffer.approvalRequestId !== approval.approvalRequestId
    || approvedOffer.sourceDraft.draftId !== approval.target.artifactId
    || approvedOffer.sourceDraft.revision !== approval.target.revision
    || approvedOffer.selectedVariantId !== approval.selectedVariantId
    || approvedOffer.selectedVariant.variantId !== approval.selectedVariantId
    || approvedOffer.approvedAt !== approval.decidedAt
    || selectedPricing === undefined
    || !areJsonValuesEqual(approvedOffer.pricingSummary, selectedPricing)
  ) {
    throw new Error("Freigegebener Angebotssnapshot passt nicht zur autoritativen Entscheidung.");
  }
  return value;
}
