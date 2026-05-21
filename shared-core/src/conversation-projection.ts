import { buildProductionClarificationQuestions, type ProductionClarificationQuestion } from "./production-clarification.js";

export type ProductionConversationMessageType =
  | "system_agent_hint"
  | "source_provenance_anchor"
  | "ingestion_warning_anchor"
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
  sourceAnchors?: ProductionConversationSourceAnchor[];
  clarificationQuestion?: ProductionClarificationQuestion;
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

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
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
    `Quelle unsicher/fallback: ${filename}`,
    `Status: ${status}`,
    warnings.length > 0 ? `Warnungen: ${warnings.join(",")}` : undefined
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
    `Ingestion-Warnung: ${anchor.filename}`,
    anchor.ingestionStatus ? `Status: ${anchor.ingestionStatus}` : undefined,
    anchor.ingestionWarnings && anchor.ingestionWarnings.length > 0
      ? `Warnungen: ${anchor.ingestionWarnings.join(",")}`
      : undefined
  ]
    .filter(Boolean)
    .join(" · ");
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
      title: "Ingestion-Warnung",
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
  const structuredQuestions: Array<{ text: string; clarificationQuestion?: ProductionClarificationQuestion }> = [
    ...clarificationQuestions.map((clarificationQuestion) => ({
      text: clarificationQuestion.prompt,
      clarificationQuestion
    })),
    ...input.questions.map((question) => ({ text: question }))
  ];

  structuredQuestions.forEach((question, index) => {
    messages.push({
      messageId: `${sessionId}-question-${index + 1}`,
      type: "structured_agent_question",
      role: "agent",
      title: "Agent fragt",
      text: question.text,
      questionIndex: index + 1,
      ...(question.clarificationQuestion ? { clarificationQuestion: question.clarificationQuestion } : {})
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
