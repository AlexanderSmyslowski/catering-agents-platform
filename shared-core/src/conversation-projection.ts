export type ProductionConversationMessageType =
  | "system_agent_hint"
  | "structured_agent_question"
  | "user_structured_answer"
  | "production_output_anchor";

export type ProductionConversationRole = "system" | "agent" | "user";

export interface ProductionConversationMessage {
  messageId: string;
  type: ProductionConversationMessageType;
  role: ProductionConversationRole;
  title: string;
  text: string;
  questionIndex?: number;
  planIds?: string[];
  purchaseListIds?: string[];
}

export interface ProductionConversationProjectionInput {
  spec?: Record<string, unknown>;
  questions: string[];
  assumptions?: string[];
  answerSummary?: string;
  productionPlans?: Array<Record<string, unknown>>;
  purchaseLists?: Array<Record<string, unknown>>;
}

export interface ProductionConversationProjection {
  sessionId: string;
  sourceSpecId?: string;
  messages: ProductionConversationMessage[];
}

function readId(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

export function buildProductionConversationProjection(
  input: ProductionConversationProjectionInput
): ProductionConversationProjection {
  const sourceSpecId = input.spec ? readId(input.spec, ["specId", "id"]) : undefined;
  const sessionId = sourceSpecId ? `production-session-${sourceSpecId}` : "production-session-draft";
  const messages: ProductionConversationMessage[] = [
    {
      messageId: `${sessionId}-system-context`,
      type: "system_agent_hint",
      role: "system",
      title: "Session-Grundlage",
      text: "Strukturierte Veranstaltungsdaten bleiben führend. Kein freier LLM-Chat."
    }
  ];

  input.questions.forEach((question, index) => {
    messages.push({
      messageId: `${sessionId}-question-${index + 1}`,
      type: "structured_agent_question",
      role: "agent",
      title: "Agent fragt",
      text: question,
      questionIndex: index + 1
    });
  });

  if (input.answerSummary?.trim()) {
    messages.push({
      messageId: `${sessionId}-structured-answer`,
      type: "user_structured_answer",
      role: "user",
      title: "Strukturierte Antwort",
      text: input.answerSummary.trim()
    });
  }

  const planIds = uniqueStrings(
    (input.productionPlans ?? []).flatMap((plan) => readId(plan, ["planId", "id"]) ?? [])
  );
  const purchaseListIds = uniqueStrings(
    (input.purchaseLists ?? []).flatMap((purchaseList) => readId(purchaseList, ["purchaseListId", "id"]) ?? [])
  );

  if (planIds.length > 0 || purchaseListIds.length > 0) {
    messages.push({
      messageId: `${sessionId}-production-outputs`,
      type: "production_output_anchor",
      role: "agent",
      title: "Produktionsoutput / Downloadanker",
      text: "Vorhandene Produktionspläne, Einkaufslisten und Exportanker bleiben prüfbare Ergebnisobjekte.",
      planIds,
      purchaseListIds
    });
  }

  return {
    sessionId,
    sourceSpecId,
    messages
  };
}
