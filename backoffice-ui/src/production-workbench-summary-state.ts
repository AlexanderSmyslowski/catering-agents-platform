import type { ProductionWorkbenchSummary } from "./production-workbench.js";
import { countPurchaseListItems } from "./production-route-artifact-status-state.js";

type ClarificationStatusCounts = {
  answered: number;
  unanswered: number;
};

export type ProductionWorkbenchSummaryStateInput = {
  activeProductionContextLabel: string;
  activeProductionTechnicalContextLabel?: string;
  focusedSpecReadinessLabel: string;
  productionPlanStatusLabel: string;
  purchaseZoneStatusLabel: string;
  productionQuestions: string[];
  clarificationStatusCounts: ClarificationStatusCounts;
  currentSpecPlans: Array<Record<string, unknown>>;
  productionObjectStatusLabel: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
};

export function buildProductionWorkbenchSummaryState({
  activeProductionContextLabel,
  activeProductionTechnicalContextLabel,
  focusedSpecReadinessLabel,
  productionPlanStatusLabel,
  purchaseZoneStatusLabel,
  productionQuestions,
  clarificationStatusCounts,
  currentSpecPlans,
  productionObjectStatusLabel,
  currentSpecPurchaseLists
}: ProductionWorkbenchSummaryStateInput): ProductionWorkbenchSummary {
  return {
    activeSpecLabel: activeProductionContextLabel,
    activeTechnicalContextLabel: activeProductionTechnicalContextLabel,
    readinessLabel: focusedSpecReadinessLabel,
    planStatusLabel: productionPlanStatusLabel,
    purchaseStatusLabel: purchaseZoneStatusLabel,
    questionCount: productionQuestions.length,
    answeredQuestionCount: clarificationStatusCounts.answered,
    unansweredQuestionCount: clarificationStatusCounts.unanswered,
    productionObjectCount: currentSpecPlans.length,
    productionObjectStatusLabel,
    purchaseListCount: currentSpecPurchaseLists.length,
    purchaseItemCount: countPurchaseListItems(currentSpecPurchaseLists)
  };
}
