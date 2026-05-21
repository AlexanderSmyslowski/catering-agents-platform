import type { ProductionConversationSourceAnchor } from "./conversation-projection.js";

export type ProductionClarificationReason =
  | "missingFields"
  | "readiness.reasons"
  | "documentIngestion.status"
  | "documentIngestion.warnings";

export type ProductionClarificationSeverity = "info" | "warning" | "blocking";

export type ProductionClarificationSuggestedAnswerType = "short_text" | "confirm_or_correct";

export const allowedProductionClarificationAnswerTypes = ["shortText"] as const;

export type AllowedProductionClarificationAnswerType = typeof allowedProductionClarificationAnswerTypes[number];

export const futureProductionClarificationAnswerTypeConcepts = [
  "selectionOrConfirmation",
  "yesNo",
  "sourceReference"
] as const;

export type FutureProductionClarificationAnswerTypeConcept = typeof futureProductionClarificationAnswerTypeConcepts[number];

export interface ProductionClarificationAnswerDraft {
  questionId: string;
  questionKey: {
    reason: ProductionClarificationReason;
    reasonCode: string;
  };
  answerType: AllowedProductionClarificationAnswerType;
}

export const productionClarificationAnswerStatuses = ["draft", "submitted", "reviewed"] as const;

export type ProductionClarificationAnswerStatus = typeof productionClarificationAnswerStatuses[number];

export const productionClarificationAnswerTextMaxLength = 500;

export const productionClarificationAnswerModelBoundaries = [
  "noRuntimeAcceptance",
  "noRuntimePersistence",
  "noApiEndpoint",
  "noMigration",
  "noRawDocumentTextMirroring",
  "noHtmlOrScriptMirroring",
  "noAutomaticDomainInterpretation",
  "noAutomaticSpecCorrectionTransfer"
] as const;

export type ProductionClarificationAnswerModelBoundary = typeof productionClarificationAnswerModelBoundaries[number];

export interface ProductionClarificationAnswer {
  answerId: string;
  questionId: string;
  questionKey: {
    reason: ProductionClarificationReason;
    reasonCode: string;
  };
  answerType: "shortText";
  status: ProductionClarificationAnswerStatus;
  answerText: {
    kind: "shortText";
    value: string;
  };
  actor?: {
    actorName: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionClarificationQuestion {
  questionId: string;
  reason: ProductionClarificationReason;
  reasonCode: string;
  severity: ProductionClarificationSeverity;
  blocking: boolean;
  prompt: string;
  sourceAnchors: ProductionConversationSourceAnchor[];
  suggestedAnswerType?: ProductionClarificationSuggestedAnswerType;
}

interface ProductionClarificationSourceInput {
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

export interface ProductionClarificationInput {
  spec?: Record<string, unknown>;
  sourceInputs?: ProductionClarificationSourceInput[];
}

type ProductionClarificationQuestionDraft = ProductionClarificationQuestion & {
  sortKey: string;
};

const fieldLabels: Record<string, string> = {
  "attendees.expected": "erwartete Personenzahl",
  "event.date": "Veranstaltungsdatum",
  extractedText: "Extrahierter Dokumenttext"
};

const fieldReasonCodes: Record<string, string> = {
  extractedText: "document_text"
};

const reasonLabels: Record<string, string> = {
  document_text_extraction_fallback: "Textextraktion unsicher"
};

const severityOrder: Record<ProductionClarificationSeverity, number> = {
  blocking: 0,
  warning: 1,
  info: 2
};

const reasonOrder: Record<ProductionClarificationReason, number> = {
  missingFields: 0,
  "documentIngestion.status": 1,
  "documentIngestion.warnings": 2,
  "readiness.reasons": 3
};

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function specIdFor(spec?: Record<string, unknown>): string {
  const id = typeof spec?.specId === "string" && spec.specId.trim()
    ? spec.specId.trim()
    : typeof spec?.id === "string" && spec.id.trim()
      ? spec.id.trim()
      : "draft";
  return slug(id);
}

function safeWarnings(sourceInput: ProductionClarificationSourceInput): string[] {
  return Array.isArray(sourceInput.documentIngestion?.warnings)
    ? sourceInput.documentIngestion.warnings.map((warning) => warning.trim()).filter(Boolean)
    : [];
}

function safeAnchor(sourceInput: ProductionClarificationSourceInput): ProductionConversationSourceAnchor | undefined {
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
    return undefined;
  }

  const status = typeof sourceInput.documentIngestion?.status === "string" ? sourceInput.documentIngestion.status.trim() : "";
  const warnings = safeWarnings(sourceInput);

  return {
    documentId: sourceInput.documentId,
    filename: metadata.filename.trim(),
    mimeType: metadata.mimeType.trim(),
    sizeBytes: metadata.sizeBytes,
    sha256Short: metadata.sha256.trim().slice(0, 12),
    ingestedAt: metadata.ingestedAt.trim(),
    uploadContext: metadata.uploadContext.trim(),
    ...(status === "fallback" || status === "failed" || warnings.length > 0 ? { ingestionStatus: status || undefined } : {}),
    ...(warnings.length > 0 ? { ingestionWarnings: warnings } : {})
  };
}

function labelForField(field: string): string {
  return fieldLabels[field] ?? field;
}

function reasonCodeForField(field: string): string {
  return fieldReasonCodes[field] ?? field;
}

function labelForReason(reason: string): string {
  return reasonLabels[reason] ?? reason;
}

function withSentenceEnd(label: string): string {
  return /[.!?]$/.test(label) ? label : `${label}.`;
}

function questionDedupeKey(question: ProductionClarificationQuestion): string {
  const anchorKey = question.sourceAnchors
    .map((anchor) => [anchor.documentId, anchor.filename, anchor.sha256Short, anchor.ingestionStatus].filter(Boolean).join("|"))
    .join(";");
  return [question.reason, question.reasonCode, anchorKey].join("::");
}

function stableQuestions(questions: ProductionClarificationQuestionDraft[]): ProductionClarificationQuestion[] {
  const deduplicated = new Map<string, ProductionClarificationQuestionDraft>();
  questions.forEach((question) => {
    const key = questionDedupeKey(question);
    const existing = deduplicated.get(key);
    if (!existing || question.sourceAnchors.length > existing.sourceAnchors.length) {
      deduplicated.set(key, question);
    }
  });

  return Array.from(deduplicated.values())
    .sort((left, right) => {
      const severityDifference = severityOrder[left.severity] - severityOrder[right.severity];
      if (severityDifference !== 0) return severityDifference;

      const reasonDifference = reasonOrder[left.reason] - reasonOrder[right.reason];
      if (reasonDifference !== 0) return reasonDifference;

      return left.sortKey.localeCompare(right.sortKey, "de");
    })
    .map(({ sortKey: _sortKey, ...question }) => question);
}

export function buildProductionClarificationQuestions(input: ProductionClarificationInput): ProductionClarificationQuestion[] {
  const questions: ProductionClarificationQuestionDraft[] = [];
  const specId = specIdFor(input.spec);
  const missingFields = Array.isArray(input.spec?.missingFields)
    ? input.spec.missingFields.filter((field): field is string => typeof field === "string" && field.trim().length > 0)
    : [];

  missingFields.forEach((field) => {
    const cleanField = field.trim();
    const reasonCode = reasonCodeForField(cleanField);
    questions.push({
      questionId: `${specId}-missingFields-${slug(reasonCode)}`,
      reason: "missingFields",
      reasonCode,
      severity: "blocking",
      blocking: true,
      prompt: `Bitte klären: ${labelForField(cleanField)}.`,
      sourceAnchors: [],
      suggestedAnswerType: "short_text",
      sortKey: cleanField
    });
  });

  const readiness = input.spec?.readiness;
  const readinessReasons = typeof readiness === "object" && readiness !== null && Array.isArray((readiness as { reasons?: unknown }).reasons)
    ? (readiness as { reasons: unknown[] }).reasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
    : [];

  readinessReasons.forEach((reason) => {
    const cleanReason = reason.trim();
    questions.push({
      questionId: `${specId}-readiness-reasons-${slug(cleanReason)}`,
      reason: "readiness.reasons",
      reasonCode: cleanReason,
      severity: "warning",
      blocking: false,
      prompt: `Bitte prüfen: ${withSentenceEnd(labelForReason(cleanReason))}`,
      sourceAnchors: [],
      suggestedAnswerType: "short_text",
      sortKey: cleanReason
    });
  });

  (input.sourceInputs ?? []).forEach((sourceInput, sourceIndex) => {
    const status = typeof sourceInput.documentIngestion?.status === "string" ? sourceInput.documentIngestion.status.trim() : "";
    const warnings = safeWarnings(sourceInput);
    const anchor = safeAnchor(sourceInput);
    const anchorRef = sourceInput.documentId?.trim() || anchor?.filename || `source-${sourceIndex + 1}`;
    const sourceAnchors = anchor ? [anchor] : [];

    if (status === "fallback" || status === "failed") {
      questions.push({
        questionId: `${specId}-documentIngestion-status-${slug(anchorRef)}`,
        reason: "documentIngestion.status",
        reasonCode: status,
        severity: "blocking",
        blocking: true,
        prompt: `Bitte Quelle prüfen: ${anchor?.filename ?? anchorRef} wurde nur unsicher/fallback verarbeitet.`,
        sourceAnchors,
        suggestedAnswerType: "confirm_or_correct",
        sortKey: `${anchorRef}-${status}`
      });
    }

    warnings.forEach((warning) => {
      questions.push({
        questionId: `${specId}-documentIngestion-warnings-${slug(anchorRef)}-${slug(warning)}`,
        reason: "documentIngestion.warnings",
        reasonCode: warning,
        severity: "warning",
        blocking: false,
        prompt: `Bitte Ingestion-Warnung prüfen: ${labelForReason(warning)}.`,
        sourceAnchors,
        suggestedAnswerType: "confirm_or_correct",
        sortKey: `${anchorRef}-${warning}`
      });
    });
  });

  return stableQuestions(questions);
}
