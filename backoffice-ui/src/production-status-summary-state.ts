import { formatAuditEventHandoffLabel } from "./app-shell-state.js";
import { getSpecLabel } from "./production-language.js";
import {
  countPurchaseListItems,
  formatActiveProductionContextLabel,
  formatProductionHandoffContextLabel,
  formatProductionHandoffExportLabel,
  formatProductionIntakeOriginLabel,
  formatProductionTechnicalContextLabel,
  formatProductionObjectStatusLabel,
  formatProductionPlanStatusLabel,
  formatProductionReadinessLabel,
  formatPurchaseZoneStatusLabel,
  selectProductionNextStep,
  type ProductionNextStep
} from "./production-route-state.js";
import { hasUnsafeIntakeSource } from "./production-intake-origin-card-state.js";

export type ProductionStatusSummaryState = {
  activeProductionContextLabel: string;
  activeProductionTechnicalContextLabel?: string;
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

export type ProductionStatusSummaryStateInput = {
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
};

function formatFocusedSpecReadinessForOperator(input: {
  focusedProductionSpec?: Record<string, unknown>;
  productionQuestions: string[];
  hasSourceWarnings: boolean;
}): string {
  const readinessLabel = formatProductionReadinessLabel(input.focusedProductionSpec);
  if (readinessLabel === "vollständig" && (input.productionQuestions.length > 0 || input.hasSourceWarnings)) {
    return "Prüfung nötig";
  }
  return readinessLabel;
}

export function buildProductionStatusSummaryState(
  input: ProductionStatusSummaryStateInput
): ProductionStatusSummaryState {
  const focusedProductionSpec = input.productionWorkspaceCleared ? undefined : input.focusedProductionSpec;
  const selectedPlan = input.productionWorkspaceCleared ? undefined : input.selectedPlan;
  const selectedPlanSpec = input.productionWorkspaceCleared ? undefined : input.selectedPlanSpec;
  const currentSpecPlans = input.productionWorkspaceCleared ? [] : input.currentSpecPlans;
  const currentSpecPurchaseLists = input.productionWorkspaceCleared ? [] : input.currentSpecPurchaseLists;
  const productionQuestions = input.productionWorkspaceCleared ? [] : input.productionQuestions;
  const currentPurchaseListItemCount = countPurchaseListItems(currentSpecPurchaseLists);
  const selectedPlanReadinessLabel = selectedPlan
    ? formatProductionReadinessLabel(selectedPlan)
    : undefined;
  const latestProductionAuditEvent = input.productionWorkspaceCleared ? undefined : input.filteredAuditEvents[0];
  const hasSourceWarnings = input.productionWorkspaceCleared
    ? false
    : hasUnsafeIntakeSource(input.intakeRequestDetail);

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
      focusedProductionSpecLabel: focusedProductionSpec
        ? getSpecLabel(focusedProductionSpec)
        : undefined,
      selectedPlan,
      selectedPlanSpecLabel: selectedPlanSpec ? getSpecLabel(selectedPlanSpec) : undefined,
      productionWorkspaceCleared: input.productionWorkspaceCleared
    }),
    activeProductionTechnicalContextLabel: formatProductionTechnicalContextLabel({
      selectedPlan,
      selectedPlanSpecLabel: selectedPlanSpec ? getSpecLabel(selectedPlanSpec) : undefined,
      productionWorkspaceCleared: input.productionWorkspaceCleared
    }),
    focusedSpecReadinessLabel: formatFocusedSpecReadinessForOperator({
      focusedProductionSpec,
      productionQuestions,
      hasSourceWarnings
    }),
    selectedPlanReadinessLabel,
    productionPlanStatusLabel: formatProductionPlanStatusLabel(selectedPlan),
    productionObjectStatusLabel: formatProductionObjectStatusLabel({
      currentSpecPlanCount: currentSpecPlans.length,
      selectedPlan
    }),
    purchaseZoneStatusLabel: formatPurchaseZoneStatusLabel({
      purchaseListCount: currentSpecPurchaseLists.length,
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
      hasSelectedPlan: Boolean(selectedPlan),
      purchaseListCount: currentSpecPurchaseLists.length,
      purchaseItemCount: currentPurchaseListItemCount
    }),
    productionHandoffContextLabel: formatProductionHandoffContextLabel({
      selectedPlan,
      selectedPlanSpec,
      purchaseLists: currentSpecPurchaseLists,
      purchaseItemCount: currentPurchaseListItemCount
    }),
    productionNextStep: selectProductionNextStep({
      hasFocusedProductionSpec: Boolean(focusedProductionSpec),
      questionCount: productionQuestions.length,
      hasSourceWarnings,
      hasSelectedPlan: Boolean(selectedPlan),
      selectedPlanReadinessLabel,
      purchaseListCount: currentSpecPurchaseLists.length,
      purchaseItemCount: currentPurchaseListItemCount
    })
  };
}
