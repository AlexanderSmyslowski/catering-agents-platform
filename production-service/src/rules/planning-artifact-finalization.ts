import {
  aggregatePurchaseList,
  mergeReadiness,
  SCHEMA_VERSION,
  validateProductionPlan,
  validatePurchaseList,
  type AcceptedEventSpec,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";
import {
  purchaseCoverageBlockingIssues,
  summarizeFallbackReason,
  uniquePlanningMessages,
  withPurchaseCoverageBlockingIssues
} from "./planning-readiness.js";
import type { OperationalPlanningArtifacts } from "./planning-operational-artifacts.js";

export type FinalProductionArtifactsInput = {
  eventSpec: AcceptedEventSpec;
  readinessIssues: {
    unresolvedItems: string[];
    warnings: string[];
    blockingIssues: string[];
  };
  operationalArtifacts: OperationalPlanningArtifacts;
  recipeSelections: ProductionPlan["recipeSelections"];
};

export function buildFinalProductionArtifacts({
  eventSpec,
  readinessIssues,
  operationalArtifacts,
  recipeSelections
}: FinalProductionArtifactsInput): { productionPlan: ProductionPlan; purchaseList: PurchaseList } {
  const unresolvedItems = uniquePlanningMessages(readinessIssues.unresolvedItems);
  const warnings = uniquePlanningMessages(readinessIssues.warnings);
  const blockingIssues = uniquePlanningMessages(readinessIssues.blockingIssues);
  const readiness = mergeReadiness(eventSpec.readiness, unresolvedItems, blockingIssues);

  const productionPlan = validateProductionPlan({
    schemaVersion: SCHEMA_VERSION,
    planId: `plan-${eventSpec.specId}`,
    eventSpecId: eventSpec.specId,
    readiness,
    productionBatches: operationalArtifacts.productionBatches,
    timeline: operationalArtifacts.timeline,
    kitchenSheets: operationalArtifacts.kitchenSheets,
    recipeSelections,
    unresolvedItems,
    ...(warnings.length > 0 || blockingIssues.length > 0
      ? {
          isFallback: true,
          fallbackReason: summarizeFallbackReason(blockingIssues, warnings),
          warnings,
          blockingIssues
        }
      : {})
  });

  const purchaseList = validatePurchaseList(
    aggregatePurchaseList(
      eventSpec.specId,
      operationalArtifacts.productionBatches,
      operationalArtifacts.procurementItems
    )
  );
  const purchaseCoverageIssues = purchaseCoverageBlockingIssues(productionPlan, purchaseList);

  return {
    productionPlan: purchaseCoverageIssues.length > 0
      ? withPurchaseCoverageBlockingIssues(eventSpec, productionPlan, purchaseCoverageIssues)
      : productionPlan,
    purchaseList
  };
}
