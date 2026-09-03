import {
  canReadAcceptedEventSpecCommercials,
  projectAcceptedEventSpecForActor,
  type AcceptedEventSpec,
  type ApprovedProductionSpec,
  type CaseEvent,
  type ProductionDraft,
  type TrustedActor
} from "@catering/shared-core";

/**
 * Production operators receive an operational snapshot only. Commercial
 * values remain in the persisted canonical artifacts and are projected back
 * only for actors with the explicit commercial capability.
 */
export function canReadProductionCommercials(actor: TrustedActor): boolean {
  return canReadAcceptedEventSpecCommercials(actor);
}

export function projectProductionEventSpec(
  actor: TrustedActor,
  eventSpec: AcceptedEventSpec
): AcceptedEventSpec {
  return projectAcceptedEventSpecForActor(actor, eventSpec);
}

export function projectProductionDraft(
  actor: TrustedActor,
  draft: ProductionDraft
): ProductionDraft {
  const projected = structuredClone(draft);
  if (canReadProductionCommercials(actor)) return projected;

  // Provider-processing metadata contains the configured cost ceiling. It is
  // audit provenance for trusted readers, not an operational value needed by a
  // production operator, so omit the whole optional policy object at this
  // response boundary rather than attempting to redact free text fields.
  const { processingPolicy: _processingPolicy, ...withoutProcessingPolicy } = projected.source;
  projected.source = withoutProcessingPolicy;
  projected.reviewCards = projected.reviewCards.map((card) => {
    if (!card.operatorComment || card.operatorCommentVisibility === "operational") {
      return card;
    }

    const {
      operatorComment: _operatorComment,
      operatorCommentVisibility: _operatorCommentVisibility,
      ...withoutConfidentialComment
    } = card;
    return withoutConfidentialComment;
  });
  if (!projected.draftArtifacts.eventSpec) return projected;

  projected.draftArtifacts.eventSpec = projectProductionEventSpec(
    actor,
    projected.draftArtifacts.eventSpec
  );
  return projected;
}

export function projectApprovedProductionSpec(
  actor: TrustedActor,
  approvedProductionSpec: ApprovedProductionSpec
): ApprovedProductionSpec {
  const projected = structuredClone(approvedProductionSpec);
  if (canReadProductionCommercials(actor)) return projected;

  projected.artifacts.eventSpec = projectProductionEventSpec(actor, projected.artifacts.eventSpec);
  return projected;
}

/**
 * Free case instructions have no structured content projection. Their
 * server-owned visibility therefore records whether the author had commercial
 * access; missing historical evidence stays confidential for non-commercial
 * readers.
 */
export function projectProductionCaseEvent(
  actor: TrustedActor,
  event: CaseEvent
): CaseEvent {
  const projected = structuredClone(event);
  if (
    canReadProductionCommercials(actor) ||
    projected.kind !== "instruction" ||
    projected.visibility === "operational"
  ) {
    return projected;
  }

  const { sourceId: _sourceId, ...withoutUntrustedSourceId } = projected;
  return {
    ...withoutUntrustedSourceId,
    text: "Vertrauliche Nachricht ausgeblendet."
  };
}
