import {
  buildProductionConversationProjection,
  type ProductionConversationProjection,
  type ProductionConversationSourceInput
} from "../../shared-core/src/conversation-projection.js";
import type { ProductionSourceDetail } from "./api.js";
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function partialProductionSourceAnchorText(sourceDetail?: ProductionSourceDetail | null): string | undefined {
  const inputs = Array.isArray(sourceDetail?.rawInputs) ? sourceDetail.rawInputs : [];
  const anchors = inputs.flatMap((input) => {
    const metadata = asRecord(input.sourceMetadata);
    const filename = optionalString(metadata?.filename);
    const mimeType = optionalString(metadata?.mimeType);
    const sha256 = optionalString(metadata?.sha256);
    if (!filename || !mimeType || !sha256) return [];

    return [[
      filename,
      mimeType,
      `sha256:${sha256.slice(0, 12)}`,
      optionalString(metadata?.uploadContext),
      optionalString(metadata?.ingestedAt)
    ].filter((value): value is string => Boolean(value)).join(" · ")];
  });

  return anchors.length > 0 ? anchors.join("\n") : undefined;
}

function openQuestionTextsFromProjection(
  projection: ProductionConversationProjection
): string[] {
  return projection.messages
    .filter((message) =>
      message.type === "structured_agent_question" &&
      message.clarificationAnswerStatus !== "answered"
    )
    .map((message) => message.text);
}

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
  intakeRequestDetail?: ProductionSourceDetail | null;
  currentSpecPlans: Array<Record<string, unknown>>;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
}): ProductionConversationState {
  const localProductionQuestions = input.focusedProductionSpec
    ? buildProductionQuestions(input.focusedProductionSpec)
    : [];
  const productionAssumptions = buildProductionAssumptions(input.focusedProductionSpec);
  const focusedClarificationAnswers = Array.isArray(input.focusedProductionSpecRecord?.clarificationAnswers)
    ? input.focusedProductionSpecRecord.clarificationAnswers
    : [];
  const productionConversationProjection = buildProductionConversationProjection({
    spec: input.focusedProductionSpec,
    questions: localProductionQuestions,
    assumptions: productionAssumptions,
    answerSummary: formatStructuredProductionAnswerSummary(input.focusedProductionSpec),
    clarificationAnswers: focusedClarificationAnswers as Parameters<
      typeof buildProductionConversationProjection
    >[0]["clarificationAnswers"],
    sourceInputs: input.intakeRequestDetail?.rawInputs as ProductionConversationSourceInput[] | undefined,
    productionPlans: input.currentSpecPlans,
    purchaseLists: input.currentSpecPurchaseLists
  });
  const partialSourceAnchor = partialProductionSourceAnchorText(input.intakeRequestDetail);
  if (
    partialSourceAnchor &&
    !productionConversationProjection.messages.some((message) => message.type === "source_provenance_anchor")
  ) {
    productionConversationProjection.messages.splice(1, 0, {
      messageId: `${productionConversationProjection.sessionId}-production-source-provenance`,
      type: "source_provenance_anchor",
      role: "system",
      title: "Quellenanker",
      text: partialSourceAnchor
    });
  }
  const productionQuestions = openQuestionTextsFromProjection(productionConversationProjection);

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
