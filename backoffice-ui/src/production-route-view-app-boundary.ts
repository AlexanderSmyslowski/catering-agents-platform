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

  return {
    productionStatusSummary,
    productionRouteViewState: buildProductionRouteViewState({
      ...input,
      activeProductionContextLabel: productionStatusSummary.activeProductionContextLabel,
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
