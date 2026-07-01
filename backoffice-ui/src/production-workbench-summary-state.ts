import type { ProductionWorkbenchSummary } from "./production-workbench.js";
import { countPurchaseListItems } from "./production-route-artifact-status-state.js";

type ClarificationStatusCounts = {
  answered: number;
  unanswered: number;
};

export type ProductionWorkbenchSummaryStateInput = {
  activeProductionContextLabel: string;
  activeProductionTechnicalContextLabel?: string;
  productionIntakeOriginLabel?: string;
  workbenchSpecFacts?: ProductionWorkbenchSummary["specFacts"];
  focusedSpecReadinessLabel: string;
  productionPlanStatusLabel: string;
  purchaseZoneStatusLabel: string;
  productionQuestions: string[];
  clarificationStatusCounts: ClarificationStatusCounts;
  currentSpecPlans: Array<Record<string, unknown>>;
  selectedPlan?: Record<string, unknown>;
  productionAssumptions?: string[];
  productionObjectStatusLabel: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
};

export function buildProductionWorkbenchSummaryState({
  activeProductionContextLabel,
  activeProductionTechnicalContextLabel,
  productionIntakeOriginLabel,
  workbenchSpecFacts,
  focusedSpecReadinessLabel,
  productionPlanStatusLabel,
  purchaseZoneStatusLabel,
  productionQuestions,
  clarificationStatusCounts,
  currentSpecPlans,
  selectedPlan,
  productionAssumptions = [],
  productionObjectStatusLabel,
  currentSpecPurchaseLists
}: ProductionWorkbenchSummaryStateInput): ProductionWorkbenchSummary {
  const assuranceFacts = buildProductionAssuranceFacts(productionIntakeOriginLabel);
  const dossierMetrics = buildProductionDossierMetrics({
    productionQuestions,
    clarificationStatusCounts,
    selectedPlan,
    productionAssumptions,
    currentSpecPurchaseLists
  });

  return {
    activeSpecLabel: activeProductionContextLabel,
    activeTechnicalContextLabel: activeProductionTechnicalContextLabel,
    ...(workbenchSpecFacts && workbenchSpecFacts.length > 0 ? { specFacts: workbenchSpecFacts } : {}),
    assuranceFacts,
    dossierMetrics,
    readinessLabel: focusedSpecReadinessLabel,
    planStatusLabel: productionPlanStatusLabel,
    purchaseStatusLabel: purchaseZoneStatusLabel,
    questionCount: productionQuestions.length,
    answeredQuestionCount: clarificationStatusCounts.answered,
    unansweredQuestionCount: clarificationStatusCounts.unanswered,
    productionObjectCount: currentSpecPlans.length,
    productionObjectStatusLabel,
    purchaseListCount: currentSpecPurchaseLists.length
  };
}

function buildProductionAssuranceFacts(
  productionIntakeOriginLabel?: string
): ProductionWorkbenchSummary["assuranceFacts"] {
  const facts: NonNullable<ProductionWorkbenchSummary["assuranceFacts"]> = [];
  const intakeOriginLabel = productionIntakeOriginLabel?.trim();

  if (
    intakeOriginLabel &&
    intakeOriginLabel !== "kein Intake-Ursprung verknüpft" &&
    intakeOriginLabel !== "Intake-Ursprung wird geladen"
  ) {
    facts.push({ label: "Herkunft", value: intakeOriginLabel });
  }

  facts.push({ label: "Freigabe", value: "nicht erteilt" });
  return facts;
}

function buildProductionDossierMetrics(input: {
  productionQuestions: string[];
  clarificationStatusCounts: ClarificationStatusCounts;
  selectedPlan?: Record<string, unknown>;
  productionAssumptions: string[];
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
}): ProductionWorkbenchSummary["dossierMetrics"] {
  return {
    answeredQuestionCount: input.clarificationStatusCounts.answered,
    questionPreview: previewFirstText(input.productionQuestions),
    assumptionCount: input.productionAssumptions.length,
    assumptionPreview: previewFirstText(input.productionAssumptions),
    productionBatchCount: countRecordArray(input.selectedPlan, "productionBatches"),
    kitchenSheetCount: countRecordArray(input.selectedPlan, "kitchenSheets"),
    recipeSelectionCount: countRecordArray(input.selectedPlan, "recipeSelections"),
    purchaseItemCount: countPurchaseListItems(input.currentSpecPurchaseLists)
  };
}

function countRecordArray(record: Record<string, unknown> | undefined, key: string): number {
  const value = record?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function previewFirstText(items: string[], maxLength = 96): string | undefined {
  const value = items.map((item) => item.trim()).find(Boolean);
  if (!value) {
    return undefined;
  }
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
