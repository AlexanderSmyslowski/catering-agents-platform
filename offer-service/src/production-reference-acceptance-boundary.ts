import {
  AuditLogStore,
  type BusinessContext
} from "@catering/shared-core";
import {
  createTrustedProductionReferencePersistenceCapability
} from "../../shared-core/src/production-reference-acceptance-internal.js";
import type {
  ProductionReferencePersistenceCapability,
  ProductionReferencePersistedEvidenceSnapshot
} from "../../shared-core/src/production-reference-acceptance.js";
import { OfferStore } from "./store.js";

interface ProductionReferenceAcceptanceBoundaryOptions {
  store: OfferStore;
  auditLog: AuditLogStore;
  context: BusinessContext;
}

function auditIdFromLineage(sourceLineageId: string): string | undefined {
  return sourceLineageId.startsWith("audit:") && sourceLineageId.slice("audit:".length).length > 0
    ? sourceLineageId.slice("audit:".length)
    : undefined;
}

/**
 * The only production-side capability boundary. It accepts concrete stores,
 * reads every authoritative record itself, and never accepts a caller reader
 * or caller snapshot. The shared-core factory remains an internal adapter for
 * this server boundary and is not part of the package export surface.
 */
export function createOfferProductionReferencePersistenceCapability(
  options: ProductionReferenceAcceptanceBoundaryOptions
): ProductionReferencePersistenceCapability {
  if (!(options.store instanceof OfferStore) || !(options.auditLog instanceof AuditLogStore)) {
    throw new TypeError("Die Produktionsreferenz-Grenze benötigt reguläre Offer- und Audit-Stores.");
  }

  return createTrustedProductionReferencePersistenceCapability(async (input): Promise<ProductionReferencePersistedEvidenceSnapshot | undefined> => {
    try {
      const sourceAuditId = auditIdFromLineage(input.sourceLineageId);
      if (!sourceAuditId) return undefined;

      const sourceCase = await options.store.getCase(options.context, input.sourceCaseId);
      const approval = await options.store.getApproval(options.context, input.approvalRequestId);
      const approvedOffer = await options.store.getApprovedOffer(options.context, input.offerId);
      const handoff = await options.store.getHandoff(options.context, input.handoffId);
      const audits = await options.auditLog.listRecentFor(options.context, 500);
      const sourceAudit = audits.find((entry) => entry.auditId === sourceAuditId);
      const approvalAudit = audits.find((entry) => entry.auditId === input.approvalAuditId);
      const handoffAudit = audits.find((entry) => entry.auditId === input.handoffAuditId);
      const kitchenAcceptanceAudit = audits.find((entry) => entry.auditId === input.kitchenAcceptanceAuditId);

      const sourceDetails = sourceAudit?.details;
      const kitchenDetails = kitchenAcceptanceAudit?.details;
      if (
        !sourceCase
        || sourceCase.businessId !== options.context.businessId
        || !approval
        || approval.decision !== "approved"
        || !approvedOffer
        || approvedOffer.approvedOfferId !== input.offerId
        || approvedOffer.businessId !== options.context.businessId
        || approvedOffer.approvalRequestId !== approval.approvalRequestId
        || approval.target.artifactId !== approvedOffer.sourceDraft.draftId
        || approval.target.revision !== approvedOffer.sourceDraft.revision
        || !handoff
        || handoff.handoffId !== input.handoffId
        || handoff.approvedOfferId !== approvedOffer.approvedOfferId
        || handoff.approvalRequestId !== approval.approvalRequestId
        || sourceAudit?.action !== "reference.source_verified"
        || sourceAudit.businessId !== options.context.businessId
        || sourceAudit.entityType !== "OfferCase"
        || sourceAudit.entityId !== input.sourceCaseId
        || sourceDetails?.sourceCaseId !== input.sourceCaseId
        || sourceDetails.sourceSha256 !== input.sourceSha256
        || approvalAudit?.action !== "offer.approved"
        || approvalAudit.businessId !== options.context.businessId
        || approvalAudit.entityType !== "ApprovedOffer"
        || approvalAudit.entityId !== approvedOffer.approvedOfferId
        || handoffAudit?.action !== "offer.production_handoff_created"
        || handoffAudit.businessId !== options.context.businessId
        || handoffAudit.entityType !== "ProductionHandoff"
        || handoffAudit.entityId !== handoff.handoffId
        || kitchenAcceptanceAudit?.action !== "production.kitchen_acceptance"
        || kitchenAcceptanceAudit.businessId !== options.context.businessId
        || kitchenAcceptanceAudit.entityType !== "ProductionHandoff"
        || kitchenAcceptanceAudit.entityId !== handoff.handoffId
        || kitchenDetails?.rescueChatUsed !== false
      ) {
        return undefined;
      }

      return {
        sourceCaseId: sourceCase.caseId,
        sourceSha256: input.sourceSha256,
        sourceLineageId: input.sourceLineageId,
        eventSpecId: handoff.eventSpecSnapshot.specId,
        approvalRequestId: approval.approvalRequestId,
        approvedOfferId: approvedOffer.approvedOfferId,
        handoffId: handoff.handoffId,
        approvalAuditId: approvalAudit.auditId,
        handoffAuditId: handoffAudit.auditId,
        kitchenAcceptanceAuditId: kitchenAcceptanceAudit.auditId,
        pricingBasis: input.pricingBasis,
        rescueChatUsed: false
      };
    } catch {
      return undefined;
    }
  });
}
