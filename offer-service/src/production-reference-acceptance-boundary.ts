// Resolve through this checkout's public index so the concrete AuditLogStore
// and its business-scoped getFor method cannot drift to a stale workspace
// package during source-level service tests or local TypeScript execution.
import {
  areJsonValuesEqual,
  AuditLogStore,
  type BusinessContext
} from "../../shared-core/src/index.js";
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

function validAuditTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
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
      const [sourceAudit, approvalAudit, handoffAudit, kitchenAcceptanceAudit] = await Promise.all([
        options.auditLog.getFor(options.context, sourceAuditId),
        options.auditLog.getFor(options.context, input.approvalAuditId),
        options.auditLog.getFor(options.context, input.handoffAuditId),
        options.auditLog.getFor(options.context, input.kitchenAcceptanceAuditId)
      ]);

      const sourceDetails = sourceAudit?.details;
      const kitchenDetails = kitchenAcceptanceAudit?.details;
      const kitchenAcceptedBy = kitchenAcceptanceAudit?.actor.name;
      const kitchenAcceptedAt = kitchenAcceptanceAudit?.at;
      const persistedDraft = approvedOffer
        ? await options.store.getDraft(options.context, approvedOffer.sourceDraft.draftId)
        : undefined;
      const persistedSelectedVariant = persistedDraft?.variantSet.find(
        (variant) => variant.variantId === approvedOffer?.selectedVariantId
      );
      const persistedReviewStatus = persistedDraft?.reviewStatus;
      const reviewFullyApproved = persistedReviewStatus?.priceReviewStatus === "verified"
        && persistedReviewStatus.taxReviewStatus === "verified"
        && persistedReviewStatus.allergenReviewStatus === "verified"
        && persistedReviewStatus.hygieneTemperatureReviewStatus === "verified"
        && persistedReviewStatus.sourceSecured === true
        && persistedReviewStatus.publishApproved === true;
      const selectedPricing = persistedSelectedVariant?.proposedEventSpec.budgetContext?.pricingSummary;
      if (
        !sourceCase
        || sourceCase.businessId !== options.context.businessId
        || sourceCase.approvedOfferId !== input.offerId
        || sourceCase.productionHandoffId !== input.handoffId
        || !approval
        || approval.decision !== "approved"
        || !approvedOffer
        || approvedOffer.approvedOfferId !== input.offerId
        || approvedOffer.businessId !== options.context.businessId
        || approvedOffer.approvalRequestId !== approval.approvalRequestId
        || approval.target.artifactId !== approvedOffer.sourceDraft.draftId
        || approval.target.revision !== approvedOffer.sourceDraft.revision
        || !persistedDraft
        || persistedDraft.businessId !== options.context.businessId
        || persistedDraft.draftId !== approvedOffer.sourceDraft.draftId
        || persistedDraft.revision !== approvedOffer.sourceDraft.revision
        || !reviewFullyApproved
        || !persistedSelectedVariant
        || !areJsonValuesEqual(persistedSelectedVariant, approvedOffer.selectedVariant)
        || !selectedPricing
        || !areJsonValuesEqual(selectedPricing, approvedOffer.pricingSummary)
        || !areJsonValuesEqual(input.pricingSummary, approvedOffer.pricingSummary)
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
        || typeof kitchenAcceptedBy !== "string"
        || kitchenAcceptedBy.trim().length === 0
        || !validAuditTimestamp(kitchenAcceptedAt)
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
        acceptedBy: kitchenAcceptedBy,
        acceptedAt: kitchenAcceptedAt,
        pricingSummary: approvedOffer.pricingSummary,
        pricingBasis: "module_catalog_estimate",
        rescueChatUsed: false
      };
    } catch {
      return undefined;
    }
  });
}
