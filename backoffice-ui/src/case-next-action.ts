import type { CaseProduct, CaseStatus } from "@catering/shared-core";

export type CaseNextDraftState = "pending_review" | "change_requested" | "ready_for_approval";

export interface CaseNextActionInput {
  product: CaseProduct;
  caseStatus: CaseStatus;
  hasSource: boolean;
  currentDraftId?: string;
  selectedVariantId?: string;
  draftState?: CaseNextDraftState;
  nextReviewTargetId?: string;
  approvedOfferId?: string;
  handoffId?: string;
  /** Distinguish a verified persisted binding from contradictory server IDs. */
  approvalBindingState?: "valid" | "invalid" | "absent";
  approvedProductionSpecId?: string;
  resultArtifactId?: string;
}

export type CaseNextAction =
  | { kind: "add_source"; label: "Quelle hinzufügen" }
  | { kind: "review_draft"; label: "Nächsten Prüfpunkt öffnen"; targetId: string }
  | { kind: "request_revision"; label: "Überarbeitung erstellen"; draftId: string }
  | { kind: "approve_offer"; label: "Angebot freigeben"; draftId: string; variantId: string }
  | { kind: "send_handoff"; label: "An Produktion übergeben"; approvedOfferId: string }
  | { kind: "inspect_handoff"; label: "Übergabe öffnen"; handoffId: string }
  | { kind: "approve_production"; label: "Produktionsstand freigeben"; draftId: string }
  | { kind: "apply_approved"; label: "Plan und Einkauf erstellen"; approvedProductionSpecId: string }
  | { kind: "inspect_result"; label: "Ergebnis öffnen"; artifactId: string }
  | { kind: "complete"; label: "Auftrag abgeschlossen" };

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Keep the operator's next command deterministic. Persisted later artifacts
 * always win over an earlier draft state, so a stale client cannot offer a
 * second handoff or apply after the result already exists.
 */
export function buildCaseNextAction(input: CaseNextActionInput): CaseNextAction {
  if (input.caseStatus === "archived" || input.caseStatus === "completed") {
    return { kind: "complete", label: "Auftrag abgeschlossen" };
  }

  if (nonEmpty(input.resultArtifactId)) {
    return { kind: "inspect_result", label: "Ergebnis öffnen", artifactId: input.resultArtifactId };
  }

  if (input.product === "offer" && input.approvalBindingState === "invalid") {
    return nonEmpty(input.currentDraftId)
      ? {
          kind: "review_draft",
          label: "Nächsten Prüfpunkt öffnen",
          targetId: input.nextReviewTargetId?.trim() || input.currentDraftId
        }
      : { kind: "add_source", label: "Quelle hinzufügen" };
  }

  if (input.product === "offer" && nonEmpty(input.handoffId)) {
    return { kind: "inspect_handoff", label: "Übergabe öffnen", handoffId: input.handoffId };
  }

  if (input.product === "production" && nonEmpty(input.approvedProductionSpecId)) {
    return {
      kind: "apply_approved",
      label: "Plan und Einkauf erstellen",
      approvedProductionSpecId: input.approvedProductionSpecId
    };
  }

  if (input.product === "offer" && nonEmpty(input.approvedOfferId)) {
    return { kind: "send_handoff", label: "An Produktion übergeben", approvedOfferId: input.approvedOfferId };
  }

  if (input.draftState === "change_requested" && nonEmpty(input.currentDraftId)) {
    return { kind: "request_revision", label: "Überarbeitung erstellen", draftId: input.currentDraftId };
  }

  if (input.draftState === "pending_review" && nonEmpty(input.currentDraftId)) {
    return {
      kind: "review_draft",
      label: "Nächsten Prüfpunkt öffnen",
      targetId: input.nextReviewTargetId?.trim() || input.currentDraftId
    };
  }

  if (input.product === "offer" && input.draftState === "ready_for_approval" &&
      nonEmpty(input.currentDraftId) && nonEmpty(input.selectedVariantId)) {
    return {
      kind: "approve_offer",
      label: "Angebot freigeben",
      draftId: input.currentDraftId,
      variantId: input.selectedVariantId
    };
  }

  if (input.product === "production" && input.draftState === "ready_for_approval" && nonEmpty(input.currentDraftId)) {
    return { kind: "approve_production", label: "Produktionsstand freigeben", draftId: input.currentDraftId };
  }

  if (!input.hasSource) {
    return { kind: "add_source", label: "Quelle hinzufügen" };
  }

  // A source without a draft is still a source-ingestion state. The existing
  // workbench remains the place that creates the draft; the bar must not
  // invent a write command outside that contract.
  return { kind: "add_source", label: "Quelle hinzufügen" };
}
