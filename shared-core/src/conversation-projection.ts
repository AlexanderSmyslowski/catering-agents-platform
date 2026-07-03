import {
  buildProductionClarificationQuestions,
  type ProductionClarificationAnswer,
  type ProductionClarificationContextBinding,
  type ProductionClarificationQuestion
} from "./production-clarification.js";

export type ProductionConversationMessageType =
  | "system_agent_hint"
  | "source_provenance_anchor"
  | "ingestion_warning_anchor"
  | "structured_agent_question"
  | "user_structured_answer"
  | "production_output_anchor";

export type ProductionConversationRole = "system" | "agent" | "user";

export type ProductionClarificationAnswerStatusAnchor = "answered" | "unanswered";

export interface ProductionConversationMessage {
  messageId: string;
  type: ProductionConversationMessageType;
  role: ProductionConversationRole;
  title: string;
  text: string;
  questionIndex?: number;
  planIds?: string[];
  purchaseListIds?: string[];
  sourceAnchors?: ProductionConversationSourceAnchor[];
  clarificationQuestion?: ProductionClarificationQuestion;
  clarificationAnswerStatus?: ProductionClarificationAnswerStatusAnchor;
  clarificationAnswer?: ProductionClarificationAnswer;
}

export interface ProductionConversationSourceAnchor {
  documentId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Short: string;
  ingestedAt: string;
  uploadContext: string;
  ingestionStatus?: string;
  ingestionWarnings?: string[];
}

export interface ProductionConversationSourceInput {
  kind?: string;
  content?: string;
  documentId?: string;
  documentIngestion?: {
    status?: string;
    warnings?: string[];
  };
  sourceMetadata?: {
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
    ingestedAt?: string;
    uploadContext?: string;
  };
}

export interface ProductionConversationProjectionInput {
  spec?: Record<string, unknown>;
  questions: string[];
  assumptions?: string[];
  answerSummary?: string;
  clarificationAnswers?: ProductionClarificationAnswer[];
  sourceInputs?: ProductionConversationSourceInput[];
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

function normalizedQuestionText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
}

function dedupeStructuredQuestions(
  questions: Array<{ text: string; clarificationQuestion?: ProductionClarificationQuestion }>
): Array<{ text: string; clarificationQuestion?: ProductionClarificationQuestion }> {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = normalizedQuestionText(question.text);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isGenericLocalReadinessQuestion(text: string): boolean {
  const normalized = normalizedQuestionText(text);
  return normalized === normalizedQuestionText("Bitte prüfe die Annahmen des Agenten, bevor die Produktion final freigegeben wird.") ||
    normalized === normalizedQuestionText("Es fehlen noch Angaben, bevor belastbare Mengen und Einkaufslisten berechnet werden können.");
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

export function formatDocumentIngestionStatusLabel(value: string): string {
  const status = value.trim();
  const labels: Record<string, string> = {
    extracted: "Text extrahiert",
    fallback: "Textextraktion unsicher",
    failed: "Textextraktion fehlgeschlagen"
  };

  return labels[status] ?? status;
}

export function formatDocumentIngestionWarningLabel(value: string): string {
  const warning = value.trim();
  const labels: Record<string, string> = {
    document_text_extraction_fallback: "PDF-Text nur unsicher extrahiert",
    low_confidence: "niedrige Texterkennungs-Sicherheit"
  };

  return labels[warning] ?? warning;
}

function collectSourceAnchors(sourceInputs: ProductionConversationSourceInput[] = []): ProductionConversationSourceAnchor[] {
  return sourceInputs.flatMap((sourceInput) => {
    const metadata = sourceInput.sourceMetadata;
    if (
      !metadata?.filename?.trim() ||
      !metadata.mimeType?.trim() ||
      typeof metadata.sizeBytes !== "number" ||
      !Number.isFinite(metadata.sizeBytes) ||
      !metadata.sha256?.trim() ||
      !metadata.ingestedAt?.trim() ||
      !metadata.uploadContext?.trim()
    ) {
      return [];
    }

    const ingestionStatus = safeIngestionStatus(sourceInput);
    const ingestionWarnings = safeIngestionWarnings(sourceInput);

    return [
      {
        documentId: sourceInput.documentId,
        filename: metadata.filename.trim(),
        mimeType: metadata.mimeType.trim(),
        sizeBytes: metadata.sizeBytes,
        sha256Short: metadata.sha256.trim().slice(0, 12),
        ingestedAt: metadata.ingestedAt.trim(),
        uploadContext: metadata.uploadContext.trim(),
        ...(ingestionStatus ? { ingestionStatus } : {}),
        ...(ingestionWarnings.length > 0 ? { ingestionWarnings } : {})
      }
    ];
  });
}

function safeIngestionWarnings(sourceInput: ProductionConversationSourceInput): string[] {
  return Array.isArray(sourceInput.documentIngestion?.warnings)
    ? sourceInput.documentIngestion.warnings.map((warning) => warning.trim()).filter(Boolean)
    : [];
}

function safeIngestionStatus(sourceInput: ProductionConversationSourceInput): string | undefined {
  const status = typeof sourceInput.documentIngestion?.status === "string" ? sourceInput.documentIngestion.status.trim() : "";
  const warnings = safeIngestionWarnings(sourceInput);
  if (status === "fallback" || status === "failed" || warnings.length > 0) {
    return status || undefined;
  }

  return undefined;
}

function formatSourceAnchor(anchor: ProductionConversationSourceAnchor): string {
  return [
    anchor.filename,
    anchor.mimeType,
    formatSize(anchor.sizeBytes),
    `sha256:${anchor.sha256Short}`,
    anchor.uploadContext,
    anchor.ingestedAt
  ].join(" · ");
}

function formatIngestionWarning(sourceInput: ProductionConversationSourceInput): string | undefined {
  const marker = sourceInput.documentIngestion;
  const status = typeof marker?.status === "string" ? marker.status.trim() : "";
  const warnings = Array.isArray(marker?.warnings) ? marker.warnings.filter((warning) => warning.trim()) : [];
  if (!status || (status !== "fallback" && status !== "failed" && warnings.length === 0)) {
    return undefined;
  }

  const filename = sourceInput.sourceMetadata?.filename?.trim() || sourceInput.documentId?.trim() || "unbekannte Quelle";
  return [
    `Quelle prüfen: ${filename}`,
    `Lesbarkeit: ${formatDocumentIngestionStatusLabel(status)}`,
    warnings.length > 0
      ? `Hinweise: ${warnings.map(formatDocumentIngestionWarningLabel).join(", ")}`
      : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}

function collectIngestionWarnings(sourceInputs: ProductionConversationSourceInput[] = []): string[] {
  return sourceInputs.flatMap((sourceInput) => formatIngestionWarning(sourceInput) ?? []);
}

function formatOutputAnchorIngestionWarning(anchor: ProductionConversationSourceAnchor): string | undefined {
  if (!anchor.ingestionStatus && (!anchor.ingestionWarnings || anchor.ingestionWarnings.length === 0)) {
    return undefined;
  }

  return [
    `Dokumentprüfung: ${anchor.filename}`,
    anchor.ingestionStatus ? `Lesbarkeit: ${formatDocumentIngestionStatusLabel(anchor.ingestionStatus)}` : undefined,
    anchor.ingestionWarnings && anchor.ingestionWarnings.length > 0
      ? `Hinweise: ${anchor.ingestionWarnings.map(formatDocumentIngestionWarningLabel).join(", ")}`
      : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function contextForProjection(sourceSpecId?: string): ProductionClarificationContextBinding | undefined {
  return sourceSpecId ? { specId: sourceSpecId, productionSessionId: `production-session-${sourceSpecId}` } : undefined;
}

function sameContext(left?: ProductionClarificationContextBinding, right?: ProductionClarificationContextBinding): boolean {
  return Boolean(left?.specId && left.productionSessionId && right?.specId && right.productionSessionId) &&
    left?.specId === right?.specId &&
    left?.productionSessionId === right?.productionSessionId;
}

function answerMatchesQuestion(
  answer: ProductionClarificationAnswer,
  question: ProductionClarificationQuestion,
  projectionContext?: ProductionClarificationContextBinding
): boolean {
  return sameContext(answer.context, question.context) &&
    sameContext(answer.context, projectionContext) &&
    answer.status === "submitted" &&
    answer.answerType === "shortText" &&
    answer.questionId === question.questionId &&
    answer.questionKey?.reason === question.reason &&
    answer.questionKey.reasonCode === question.reasonCode &&
    answer.answerText?.kind === "shortText" &&
    typeof answer.answerText.value === "string" &&
    Boolean(answer.answerText.value.trim());
}

function safeClarificationAnswer(answer: ProductionClarificationAnswer): ProductionClarificationAnswer {
  return {
    ...answer,
    answerText: {
      ...answer.answerText,
      value: escapeHtml(answer.answerText.value.trim())
    }
  };
}

function clarificationQuestionTitle(hasMatchingAnswer: boolean): string {
  return hasMatchingAnswer ? "Agent fragt · beantwortet" : "Agent fragt · offen";
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

  const sourceAnchors = collectSourceAnchors(input.sourceInputs);
  const ingestionWarnings = collectIngestionWarnings(input.sourceInputs);
  if (ingestionWarnings.length > 0) {
    messages.push({
      messageId: `${sessionId}-ingestion-warnings`,
      type: "ingestion_warning_anchor",
      role: "system",
      title: "Dokumentprüfung",
      text: ingestionWarnings.join("\n")
    });
  }

  if (sourceAnchors.length > 0) {
    messages.push({
      messageId: `${sessionId}-source-provenance`,
      type: "source_provenance_anchor",
      role: "system",
      title: "Quellenanker",
      text: sourceAnchors.map(formatSourceAnchor).join("\n"),
      sourceAnchors
    });
  }

  const clarificationQuestions = buildProductionClarificationQuestions({
    spec: input.spec,
    sourceInputs: input.sourceInputs
  });
  const localQuestions = clarificationQuestions.length > 0
    ? input.questions.filter((question) => !isGenericLocalReadinessQuestion(question))
    : input.questions;
  const structuredQuestions = dedupeStructuredQuestions([
    ...clarificationQuestions.map((clarificationQuestion) => ({
      text: clarificationQuestion.prompt,
      clarificationQuestion
    })),
    ...localQuestions.map((question) => ({ text: question }))
  ]);

  structuredQuestions.forEach((question, index) => {
    const matchingAnswers = question.clarificationQuestion
      ? (input.clarificationAnswers ?? []).filter((answer) =>
        answerMatchesQuestion(answer, question.clarificationQuestion as ProductionClarificationQuestion, contextForProjection(sourceSpecId))
      )
      : [];

    messages.push({
      messageId: `${sessionId}-question-${index + 1}`,
      type: "structured_agent_question",
      role: "agent",
      title: question.clarificationQuestion ? clarificationQuestionTitle(matchingAnswers.length > 0) : "Agent fragt",
      text: question.text,
      questionIndex: index + 1,
      ...(question.clarificationQuestion
        ? {
          clarificationQuestion: question.clarificationQuestion,
          clarificationAnswerStatus: matchingAnswers.length > 0 ? "answered" : "unanswered"
        }
        : {})
    });

    if (question.clarificationQuestion) {
      matchingAnswers.forEach((answer) => {
        const safeAnswer = safeClarificationAnswer(answer);
        messages.push({
          messageId: `${sessionId}-clarification-answer-${safeAnswer.answerId}`,
          type: "user_structured_answer",
          role: "user",
          title: "Antwort auf Rückfrage",
          text: safeAnswer.answerText.value,
          questionIndex: index + 1,
          clarificationQuestion: question.clarificationQuestion,
          clarificationAnswer: safeAnswer
        });
      });
    }
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
    const outputIngestionWarnings = sourceAnchors.flatMap((anchor) => formatOutputAnchorIngestionWarning(anchor) ?? []);
    const outputAnchorText = [
      "Vorhandene Produktionspläne, Einkaufslisten und Exportanker bleiben prüfbare Ergebnisobjekte.",
      sourceAnchors.length > 0
        ? `Quellenanker: ${sourceAnchors.map((anchor) => `sha256:${anchor.sha256Short}`).join(", ")}`
        : undefined,
      ...outputIngestionWarnings
    ]
      .filter(Boolean)
      .join("\n");

    messages.push({
      messageId: `${sessionId}-production-outputs`,
      type: "production_output_anchor",
      role: "agent",
      title: "Produktionsoutput / Downloadanker",
      text: outputAnchorText,
      planIds,
      purchaseListIds,
      ...(sourceAnchors.length > 0 ? { sourceAnchors } : {})
    });
  }

  return {
    sessionId,
    sourceSpecId,
    messages
  };
}
