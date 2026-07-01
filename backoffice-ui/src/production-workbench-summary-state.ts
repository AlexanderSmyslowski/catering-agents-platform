import type { ProductionWorkbenchSummary } from "./production-workbench.js";

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
  productionObjectStatusLabel,
  currentSpecPurchaseLists
}: ProductionWorkbenchSummaryStateInput): ProductionWorkbenchSummary {
  const assuranceFacts = buildProductionAssuranceFacts(productionIntakeOriginLabel);

  return {
    activeSpecLabel: activeProductionContextLabel,
    activeTechnicalContextLabel: activeProductionTechnicalContextLabel,
    ...(workbenchSpecFacts && workbenchSpecFacts.length > 0 ? { specFacts: workbenchSpecFacts } : {}),
    assuranceFacts,
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
