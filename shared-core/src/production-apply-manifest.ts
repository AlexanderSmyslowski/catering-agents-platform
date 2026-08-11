import { createHash } from "node:crypto";
import type {
  ApprovedProductionSpec,
  ApprovalRequestRecord,
  ProductionApplyManifest,
  ProductionDraft
} from "./types.js";
import type { TrustedActor } from "./access-control.js";
import { validateApprovedProductionSpec } from "./validation.js";

function sha256Id(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha256").update(value).digest("hex")}`;
}

export function approvedProductionSpecIdForApproval(approvalRequestId: string): string {
  return sha256Id("approved-production-spec", `approved-production-spec:v1\0${approvalRequestId}`);
}

export function createApprovedProductionSpec(input: {
  draft: ProductionDraft;
  approval: ApprovalRequestRecord;
}): ApprovedProductionSpec {
  const { draft, approval } = input;
  if (approval.decision !== "approved") {
    throw new Error("Only an approved ApprovalRequestRecord can create an ApprovedProductionSpec.");
  }
  if (
    approval.businessId !== draft.businessId ||
    approval.target.kind !== "production_draft" ||
    approval.target.artifactId !== draft.draftId ||
    approval.target.revision !== draft.revision
  ) {
    throw new Error("ApprovalRequestRecord does not match the ProductionDraft revision.");
  }
  const { eventSpec, productionPlan, purchaseList, recipes } = draft.draftArtifacts;
  if (!eventSpec || !productionPlan || !purchaseList || !Array.isArray(recipes)) {
    throw new Error("ProductionDraft snapshot is incomplete.");
  }

  return validateApprovedProductionSpec(structuredClone({
    schemaVersion: "1.0",
    businessId: draft.businessId,
    approvedProductionSpecId: approvedProductionSpecIdForApproval(approval.approvalRequestId),
    sourceDraft: { draftId: draft.draftId, revision: draft.revision },
    approvalRequestId: approval.approvalRequestId,
    approvedAt: approval.decidedAt,
    artifacts: { eventSpec, productionPlan, purchaseList, recipes }
  }));
}

export function createProductionApplyManifest(input: {
  approvedProductionSpec: ApprovedProductionSpec;
  actor: Pick<TrustedActor, "businessId" | "name" | "source">;
  appliedAt?: Date;
}): ProductionApplyManifest {
  const spec = validateApprovedProductionSpec(input.approvedProductionSpec);
  if (spec.businessId !== input.actor.businessId) {
    throw new Error("ApprovedProductionSpec passt nicht zum vertrauenswürdigen Betriebskontext.");
  }
  const appliedAt = input.appliedAt ?? new Date();
  if (Number.isNaN(appliedAt.getTime())) throw new Error("Ungültiger Apply-Zeitpunkt.");
  return {
    schemaVersion: "1.0",
    businessId: spec.businessId,
    approvedProductionSpecId: spec.approvedProductionSpecId,
    eventSpecId: spec.artifacts.eventSpec.specId,
    planId: spec.artifacts.productionPlan.planId,
    purchaseListId: spec.artifacts.purchaseList.purchaseListId,
    recipeIds: spec.artifacts.recipes.map((recipe) => recipe.recipeId),
    appliedAt: appliedAt.toISOString(),
    appliedBy: {
      name: input.actor.name,
      source: input.actor.source
    }
  };
}
