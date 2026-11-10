import { formatSubmitErrorMessage } from "./submit-error-message.js";
import { productionDraftIdForHandoff } from "./production-entry-focus.js";
import type { ApprovedOffer, ProductionHandoff } from "@catering/shared-core";

export type OfferApprovalBinding = {
  offerDraftId: string;
  offerDraftRevision: number;
  approvedOfferId: string;
  /** Variant identity as persisted in the ApprovedOffer / handoff source.
   * Absent for legacy projections; never inferred from a UI selection. */
  selectedVariantId?: string;
  handoffId?: string;
  productionDraftId?: string;
};

function persistedVariantId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/** Combine persisted variant identities. Contradictory records yield no
 * identity, so the UI stays neutral instead of naming a wrong variant. */
export function resolvePersistedVariantId(...candidates: unknown[]): string | undefined {
  const known = candidates.map(persistedVariantId).filter((value): value is string => value !== undefined);
  if (known.length === 0) return undefined;
  return known.every((value) => value === known[0]) ? known[0] : undefined;
}

/** Project the complete persisted approval/handoff records into the browser
 * action contract. The source draft remains the authority after a reload. */
export function buildOfferApprovalBinding(
  approvedOffer?: Pick<ApprovedOffer, "approvedOfferId" | "sourceDraft"> & Partial<Pick<ApprovedOffer, "selectedVariantId">>,
  handoff?: Pick<ProductionHandoff, "handoffId" | "source" | "approvedOfferId">,
  caseApprovedOfferId?: string
): OfferApprovalBinding | undefined {
  const validSource = (source: unknown): source is { draftId: string; revision: number } => {
    if (!source || typeof source !== "object") return false;
    const candidate = source as { draftId?: unknown; revision?: unknown };
    return typeof candidate.draftId === "string" && candidate.draftId.trim().length > 0 &&
      Number.isInteger(candidate.revision) && (candidate.revision as number) >= 1;
  };
  if (approvedOffer && (
    typeof approvedOffer.approvedOfferId !== "string" ||
    approvedOffer.approvedOfferId.trim().length === 0 ||
    !validSource(approvedOffer.sourceDraft)
  )) {
    return undefined;
  }
  if (handoff && (
    typeof handoff.handoffId !== "string" ||
    handoff.handoffId.trim().length === 0 ||
    typeof handoff.approvedOfferId !== "string" ||
    handoff.approvedOfferId.trim().length === 0 ||
    !validSource(handoff.source)
  )) {
    return undefined;
  }
  if (caseApprovedOfferId && (!approvedOffer || approvedOffer.approvedOfferId !== caseApprovedOfferId)) return undefined;
  const source = approvedOffer?.sourceDraft ?? handoff?.source;
  const approvedOfferId = approvedOffer?.approvedOfferId ?? handoff?.approvedOfferId;
  if (!source || !approvedOfferId || !source.draftId || !Number.isInteger(source.revision) || source.revision < 1) {
    return undefined;
  }
  if (approvedOffer && handoff && (
    approvedOffer.approvedOfferId !== handoff.approvedOfferId ||
    approvedOffer.sourceDraft.draftId !== handoff.source.draftId ||
    approvedOffer.sourceDraft.revision !== handoff.source.revision
  )) {
    return undefined;
  }
  const selectedVariantId = resolvePersistedVariantId(
    approvedOffer?.selectedVariantId,
    (handoff?.source as { selectedVariantId?: unknown } | undefined)?.selectedVariantId
  );
  return {
    offerDraftId: source.draftId,
    offerDraftRevision: source.revision,
    approvedOfferId,
    ...(selectedVariantId ? { selectedVariantId } : {}),
    ...(handoff?.handoffId ? { handoffId: handoff.handoffId } : {}),
    ...(handoff?.handoffId ? { productionDraftId: productionDraftIdForHandoff(handoff.handoffId) } : {})
  };
}

export type OfferApprovalActionInput = {
  decideOfferDraft: (draftId: string, revision: number, variantId: string, missingEventDateAcknowledged?: true) => Promise<{ approvedOffer?: { approvedOfferId: string; selectedVariantId?: string } }>;
  createProductionHandoff: (approvedOfferId: string) => Promise<{ handoff?: { handoffId: string; source?: { selectedVariantId?: string } } }>;
  createProductionCaseFromHandoff: (handoffId: string) => Promise<{ case: { caseId: string } }>;
  createProductionDraftFromHandoff: (caseId: string, handoffId: string) => Promise<{ draft?: { draftId: string } }>;
  setActiveProductionCaseId: (caseId: string) => void;
  clearActiveOfferCaseId: () => void;
  setSubmitting: (submitting: boolean) => void;
  clearMessages: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
  setApprovalBinding?: (binding: OfferApprovalBinding) => void;
  openProductionEntry: (draftId: string, productionCaseId?: string) => void;
};

export function buildOfferApprovalAction(input: OfferApprovalActionInput) {
  const run = async (work: () => Promise<void>, fallback: string) => {
    input.setSubmitting(true); input.clearMessages();
    try { await work(); await input.refreshDashboard(); }
    catch (error) { input.setError(formatSubmitErrorMessage(error, fallback)); }
    finally { input.setSubmitting(false); }
  };
  return {
    approve: async (draftId: string, revision: number, variantId: string, missingEventDateAcknowledged?: true) => run(async () => {
      const result = missingEventDateAcknowledged
        ? await input.decideOfferDraft(draftId, revision, variantId, true)
        : await input.decideOfferDraft(draftId, revision, variantId);
      if (!result.approvedOffer?.approvedOfferId) throw new Error("Freigegebenes Angebot fehlt.");
      // Only the server-persisted identity is shown later; the requested
      // variant is never substituted for a missing response field.
      const selectedVariantId = resolvePersistedVariantId(result.approvedOffer.selectedVariantId);
      input.setApprovalBinding?.({
        offerDraftId: draftId,
        offerDraftRevision: revision,
        approvedOfferId: result.approvedOffer.approvedOfferId,
        ...(selectedVariantId ? { selectedVariantId } : {})
      });
      input.setNotice("Angebotsvariante wurde freigegeben.");
    }, "Angebotsvariante konnte nicht freigegeben werden."),
    createHandoff: async (offerDraftId: string, offerDraftRevision: number, approvedOfferId: string, approvedVariantId?: string) => run(async () => {
      const result = await input.createProductionHandoff(approvedOfferId);
      if (!result.handoff?.handoffId) throw new Error("Produktionsübergabe fehlt.");
      const productionCase = await input.createProductionCaseFromHandoff(result.handoff.handoffId);
      input.setActiveProductionCaseId(productionCase.case.caseId);
      const productionResult = await input.createProductionDraftFromHandoff(
        productionCase.case.caseId,
        result.handoff.handoffId
      );
      if (!productionResult.draft?.draftId) throw new Error("Produktionsentwurf fehlt.");
      const selectedVariantId = resolvePersistedVariantId(approvedVariantId, result.handoff.source?.selectedVariantId);
      input.setApprovalBinding?.({
        offerDraftId,
        offerDraftRevision,
        approvedOfferId,
        ...(selectedVariantId ? { selectedVariantId } : {}),
        handoffId: result.handoff.handoffId,
        productionDraftId: productionResult.draft.draftId
      });
      input.clearActiveOfferCaseId();
      input.setNotice("Freigegebenes Angebot wurde an die Produktion übergeben.");
      input.openProductionEntry(productionResult.draft.draftId, productionCase.case.caseId);
    }, "Produktionsübergabe konnte nicht erstellt werden.")
  };
}
