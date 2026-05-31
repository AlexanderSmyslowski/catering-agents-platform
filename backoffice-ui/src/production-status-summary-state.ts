import { formatAuditEventHandoffLabel } from "./app-shell-state.js";
import { getSpecLabel } from "./production-language.js";
import {
  countPurchaseListItems,
  formatActiveProductionContextLabel,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatProductionObjectStatusLabel,
  formatProductionPlanStatusLabel,
  formatProductionReadinessLabel,
  formatPurchaseZoneStatusLabel,
  selectProductionNextStep,
  type ProductionNextStep
} from "./production-route-state.js";

export type ProductionStatusSummaryState = {
  activeProductionContextLabel: string;
  focusedSpecReadinessLabel: string;
  selectedPlanReadinessLabel?: string;
  productionPlanStatusLabel: string;
  productionObjectStatusLabel: string;
  purchaseZoneStatusLabel: string;
  productionIntakeOriginLabel: string;
  productionAuditTrailLabel: string;
  productionHandoffExportLabel: string;
  productionHandoffContextLabel?: string;
  productionNextStep: ProductionNextStep;
};

export function buildProductionStatusSummaryState(input: {
  isInitialProductionLoading?: boolean;
  focusedProductionSpec?: Record<string, unknown>;
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  currentSpecPlans: Array<Record<string, unknown>>;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
  productionQuestions: string[];
  filteredAuditEvents: Array<Record<string, unknown>>;
  intakeRequestDetail?: Record<string, unknown> | null;
  currentIntakeRequestId?: string;
  productionWorkspaceCleared: boolean;
}): ProductionStatusSummaryState {
  const currentPurchaseListItemCount = countPurchaseListItems(input.currentSpecPurchaseLists);
  const latestProductionAuditEvent = input.filteredAuditEvents[0];

  if (input.isInitialProductionLoading) {
    return {
      activeProductionContextLabel: "Produktionsdaten werden geladen; noch kein Vorgang bewertet.",
      focusedSpecReadinessLabel: "wird geladen",
      selectedPlanReadinessLabel: undefined,
      productionPlanStatusLabel: "wird geladen",
      productionObjectStatusLabel: "Produktionspläne werden geladen",
      purchaseZoneStatusLabel: "Einkaufslisten werden geladen",
      productionIntakeOriginLabel: "Intake-Ursprung wird geladen",
      productionAuditTrailLabel: "Audit-Ereignisse werden geladen",
      productionHandoffExportLabel: "Exportstatus wird geladen",
      productionHandoffContextLabel: undefined,
      productionNextStep: {
        title: "Produktionsdaten laden",
        description: "Bestehende Vorgänge, Pläne, Einkaufslisten und Rückfragen werden gerade geladen."
      }
    };
  }

  return {
    activeProductionContextLabel: formatActiveProductionContextLabel({
      focusedProductionSpecLabel: input.focusedProductionSpec
        ? getSpecLabel(input.focusedProductionSpec)
        : undefined,
      selectedPlan: input.selectedPlan,
      selectedPlanSpecLabel: input.selectedPlanSpec ? getSpecLabel(input.selectedPlanSpec) : undefined,
      productionWorkspaceCleared: input.productionWorkspaceCleared
    }),
    focusedSpecReadinessLabel: formatProductionReadinessLabel(input.focusedProductionSpec),
    selectedPlanReadinessLabel: input.selectedPlan
      ? formatProductionReadinessLabel(input.selectedPlan)
      : undefined,
    productionPlanStatusLabel: formatProductionPlanStatusLabel(input.selectedPlan),
    productionObjectStatusLabel: formatProductionObjectStatusLabel({
      currentSpecPlanCount: input.currentSpecPlans.length,
      selectedPlan: input.selectedPlan
    }),
    purchaseZoneStatusLabel: formatPurchaseZoneStatusLabel({
      purchaseListCount: input.currentSpecPurchaseLists.length,
      itemCount: currentPurchaseListItemCount
    }),
    productionIntakeOriginLabel: formatProductionIntakeOriginLabel({
      intakeRequestDetail: input.productionWorkspaceCleared ? undefined : input.intakeRequestDetail,
      currentIntakeRequestId: input.productionWorkspaceCleared ? undefined : input.currentIntakeRequestId
    }),
    productionAuditTrailLabel: latestProductionAuditEvent
      ? formatAuditEventHandoffLabel(latestProductionAuditEvent)
      : "keine Audit-Ereignisse geladen",
    productionHandoffExportLabel: formatProductionHandoffExportLabel({
      hasSelectedPlan: Boolean(input.selectedPlan),
      purchaseListCount: input.currentSpecPurchaseLists.length
    }),
    productionHandoffContextLabel: formatProductionHandoffContextLabel({
      selectedPlan: input.selectedPlan,
      selectedPlanSpec: input.selectedPlanSpec,
      purchaseLists: input.currentSpecPurchaseLists
    }),
    productionNextStep: selectProductionNextStep({
      hasFocusedProductionSpec: Boolean(input.focusedProductionSpec),
      questionCount: input.productionQuestions.length,
      hasSelectedPlan: Boolean(input.selectedPlan),
      purchaseListCount: input.currentSpecPurchaseLists.length
    })
  };
}
