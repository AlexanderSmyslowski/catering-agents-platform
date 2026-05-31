import type {
  ProductionPlan,
  PurchaseItem
} from "@catering/shared-core";
import type { PlanningArtifactAppender } from "./planning-artifact-appender.js";

export type PlanningArtifactState = {
  productionBatches: ProductionPlan["productionBatches"];
  procurementItems: PurchaseItem[];
  kitchenSheets: ProductionPlan["kitchenSheets"];
  timeline: ProductionPlan["timeline"];
  recipeSelections: ProductionPlan["recipeSelections"];
  appender: PlanningArtifactAppender;
};

export function createPlanningArtifactState(
  noteIssue: PlanningArtifactAppender["noteIssue"]
): PlanningArtifactState {
  const productionBatches: ProductionPlan["productionBatches"] = [];
  const procurementItems: PurchaseItem[] = [];
  const kitchenSheets: ProductionPlan["kitchenSheets"] = [];
  const timeline: ProductionPlan["timeline"] = [];
  const recipeSelections: ProductionPlan["recipeSelections"] = [];

  return {
    productionBatches,
    procurementItems,
    kitchenSheets,
    timeline,
    recipeSelections,
    appender: {
      productionBatches,
      procurementItems,
      kitchenSheets,
      timeline,
      recipeSelections,
      noteIssue
    }
  };
}
