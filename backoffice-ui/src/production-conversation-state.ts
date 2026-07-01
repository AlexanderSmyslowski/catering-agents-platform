import {
  buildProductionConversationProjection,
  type ProductionConversationProjection,
  type ProductionConversationSourceInput
} from "../../shared-core/src/conversation-projection.js";
import type { IntakeRequestDetail } from "./api.js";
import {
  buildProductionAssumptions,
  buildProductionQuestions
} from "./production-language.js";
import {
  buildWorkbenchSpecFacts,
  countClarificationAnswerStatuses,
  formatStructuredProductionAnswerSummary,
  type ClarificationAnswerStatusCounts,
  type WorkbenchSpecFact
} from "./production-route-state.js";

export type ProductionConversationState = {
  productionQuestions: string[];
  productionAssumptions: string[];
  productionConversationProjection: ProductionConversationProjection;
  clarificationStatusCounts: ClarificationAnswerStatusCounts;
  workbenchSpecFacts: WorkbenchSpecFact[];
};

function questionAwareWorkbenchFacts(
  facts: WorkbenchSpecFact[],
  productionQuestions: string[]
): WorkbenchSpecFact[] {
  if (productionQuestions.length === 0) {
    return facts;
  }

  return facts.map((fact) =>
    fact.label === "Status" && fact.value === "vollständig"
      ? { ...fact, value: "Prüfung nötig" }
      : fact
  );
}

export function buildProductionConversationState(input: {
  focusedProductionSpec?: Record<string, unknown>;
  focusedProductionSpecRecord?: Record<string, unknown>;
  intakeRequestDetail?: IntakeRequestDetail | null;
  currentSpecPlans: Array<Record<string, unknown>>;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
}): ProductionConversationState {
  const productionQuestions = input.focusedProductionSpec
    ? buildProductionQuestions(input.focusedProductionSpec)
    : [];
  const productionAssumptions = buildProductionAssumptions(input.focusedProductionSpec);
  const focusedClarificationAnswers = Array.isArray(input.focusedProductionSpecRecord?.clarificationAnswers)
    ? input.focusedProductionSpecRecord.clarificationAnswers
    : [];
  const productionConversationProjection = buildProductionConversationProjection({
    spec: input.focusedProductionSpec,
    questions: productionQuestions,
    assumptions: productionAssumptions,
    answerSummary: formatStructuredProductionAnswerSummary(input.focusedProductionSpec),
    clarificationAnswers: focusedClarificationAnswers as Parameters<
      typeof buildProductionConversationProjection
    >[0]["clarificationAnswers"],
    sourceInputs: input.intakeRequestDetail?.rawInputs as ProductionConversationSourceInput[] | undefined,
    productionPlans: input.currentSpecPlans,
    purchaseLists: input.currentSpecPurchaseLists
  });

  return {
    productionQuestions,
    productionAssumptions,
    productionConversationProjection,
    clarificationStatusCounts: countClarificationAnswerStatuses(productionConversationProjection.messages),
    workbenchSpecFacts: questionAwareWorkbenchFacts(
      buildWorkbenchSpecFacts(input.focusedProductionSpecRecord),
      productionQuestions
    )
  };
}
