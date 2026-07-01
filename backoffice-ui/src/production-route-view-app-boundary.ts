import {
  buildWorkbenchSpecFacts,
  type WorkbenchSpecFact
} from "./production-route-state.js";
import {
  buildProductionRouteViewState,
  type ProductionRouteViewState,
  type ProductionRouteViewStateInput
} from "./production-route-view-state.js";
import {
  buildProductionStatusSummaryState,
  type ProductionStatusSummaryState,
  type ProductionStatusSummaryStateInput
} from "./production-status-summary-state.js";

type StatusDrivenRouteViewKeys =
  | "activeProductionContextLabel"
  | "focusedSpecReadinessLabel"
  | "selectedPlanReadinessLabel"
  | "productionPlanStatusLabel"
  | "productionObjectStatusLabel"
  | "purchaseZoneStatusLabel"
  | "productionIntakeOriginLabel"
  | "productionAuditTrailLabel"
  | "productionHandoffExportLabel"
  | "productionHandoffContextLabel"
  | "productionNextStep";

export type ProductionRouteViewAppBoundaryInput =
  ProductionStatusSummaryStateInput &
  Omit<ProductionRouteViewStateInput, StatusDrivenRouteViewKeys>;

export type ProductionRouteViewAppBoundary = {
  productionStatusSummary: ProductionStatusSummaryState;
  productionRouteViewState: ProductionRouteViewState;
};

function resolveWorkbenchSpecFacts(input: {
  productionWorkspaceCleared: boolean;
  selectedPlanSpec?: Record<string, unknown>;
  workbenchSpecFacts: WorkbenchSpecFact[];
}): WorkbenchSpecFact[] {
  if (input.productionWorkspaceCleared) {
    return [];
  }
  if (input.workbenchSpecFacts.length > 0) {
    return input.workbenchSpecFacts;
  }
  return buildWorkbenchSpecFacts(input.selectedPlanSpec);
}

export function buildProductionRouteViewAppBoundary(
  input: ProductionRouteViewAppBoundaryInput
): ProductionRouteViewAppBoundary {
  const productionStatusSummary = buildProductionStatusSummaryState({
    isInitialProductionLoading: input.isInitialProductionLoading,
    focusedProductionSpec: input.focusedProductionSpec,
    selectedPlan: input.selectedPlan,
    selectedPlanSpec: input.selectedPlanSpec,
    currentSpecPlans: input.currentSpecPlans,
    currentSpecPurchaseLists: input.currentSpecPurchaseLists,
    productionQuestions: input.productionQuestions,
    filteredAuditEvents: input.filteredAuditEvents,
    intakeRequestDetail: input.intakeRequestDetail,
    currentIntakeRequestId: input.currentIntakeRequestId,
    productionWorkspaceCleared: input.productionWorkspaceCleared
  });
  const workbenchSpecFacts = resolveWorkbenchSpecFacts({
    productionWorkspaceCleared: input.productionWorkspaceCleared,
    selectedPlanSpec: input.selectedPlanSpec,
    workbenchSpecFacts: input.workbenchSpecFacts
  });

  return {
    productionStatusSummary,
    productionRouteViewState: buildProductionRouteViewState({
      ...input,
      workbenchSpecFacts,
      activeProductionContextLabel: productionStatusSummary.activeProductionContextLabel,
      activeProductionTechnicalContextLabel: productionStatusSummary.activeProductionTechnicalContextLabel,
      focusedSpecReadinessLabel: productionStatusSummary.focusedSpecReadinessLabel,
      selectedPlanReadinessLabel: productionStatusSummary.selectedPlanReadinessLabel,
      productionPlanStatusLabel: productionStatusSummary.productionPlanStatusLabel,
      productionObjectStatusLabel: productionStatusSummary.productionObjectStatusLabel,
      purchaseZoneStatusLabel: productionStatusSummary.purchaseZoneStatusLabel,
      productionIntakeOriginLabel: productionStatusSummary.productionIntakeOriginLabel,
      productionAuditTrailLabel: productionStatusSummary.productionAuditTrailLabel,
      productionHandoffExportLabel: productionStatusSummary.productionHandoffExportLabel,
      productionHandoffContextLabel: productionStatusSummary.productionHandoffContextLabel,
      productionNextStep: productionStatusSummary.productionNextStep
    })
  };
}
