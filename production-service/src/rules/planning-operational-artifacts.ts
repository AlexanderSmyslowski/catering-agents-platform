import type {
  ProductionPlan,
  PurchaseItem
} from "@catering/shared-core";

export type PlanningArtifactDraft = {
  productionBatches: ProductionPlan["productionBatches"];
  timeline: ProductionPlan["timeline"];
  kitchenSheets: ProductionPlan["kitchenSheets"];
  procurementItems: PurchaseItem[];
};

export type OperationalPlanningArtifacts = PlanningArtifactDraft;

export function selectOperationalPlanningArtifacts(
  draft: PlanningArtifactDraft,
  blockingIssues: string[]
): OperationalPlanningArtifacts {
  if (blockingIssues.length === 0) {
    return draft;
  }

  return {
    productionBatches: [],
    timeline: [],
    kitchenSheets: draft.kitchenSheets.filter((sheet) => (sheet.blockingNotes?.length ?? 0) > 0),
    procurementItems: []
  };
}
