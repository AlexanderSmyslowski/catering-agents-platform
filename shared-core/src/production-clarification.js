export const allowedProductionClarificationAnswerTypes = ["shortText"];
export const futureProductionClarificationAnswerTypeConcepts = [
  "selectionOrConfirmation",
  "yesNo",
  "sourceReference"
];
export const productionClarificationAnswerStatuses = ["draft", "submitted", "reviewed"];
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
];

const fieldLabels = {
  "attendees.expected": "erwartete Personenzahl",
  "event.date": "Veranstaltungsdatum",
  extractedText: "Extrahierter Dokumenttext"
};

const fieldReasonCodes = {
  extractedText: "document_text"
};

const reasonLabels = {
  document_text_extraction_fallback: "Textextraktion unsicher"
};

const severityOrder = {
  blocking: 0,
  warning: 1,
  info: 2
};

const reasonOrder = {
  missingFields: 0,
  "documentIngestion.status": 1,
  "documentIngestion.warnings": 2,
  "readiness.reasons": 3
};

function slug(value) {
  return value.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function specIdFor(spec) {
  const id = typeof spec?.specId === "string" && spec.specId.trim()
    ? spec.specId.trim()
    : typeof spec?.id === "string" && spec.id.trim()
      ? spec.id.trim()
      : "draft";
  return slug(id);
}

function safeWarnings(sourceInput) {
  return Array.isArray(sourceInput.documentIngestion?.warnings)
    ? sourceInput.documentIngestion.warnings.map((warning) => warning.trim()).filter(Boolean)
    : [];
}

function safeAnchor(sourceInput) {
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

function labelForField(field) {
  return fieldLabels[field] ?? field;
}

function reasonCodeForField(field) {
  return fieldReasonCodes[field] ?? field;
}

function labelForReason(reason) {
  return reasonLabels[reason] ?? reason;
}

function withSentenceEnd(label) {
  return /[.!?]$/.test(label) ? label : `${label}.`;
}

function questionDedupeKey(question) {
  const anchorKey = question.sourceAnchors
    .map((anchor) => [anchor.documentId, anchor.filename, anchor.sha256Short, anchor.ingestionStatus].filter(Boolean).join("|"))
    .join(";");
  return [question.reason, question.reasonCode, anchorKey].join("::");
}

function stableQuestions(questions) {
  const deduplicated = new Map();
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

export function buildProductionClarificationQuestions(input) {
  const questions = [];
  const specId = specIdFor(input.spec);
  const missingFields = Array.isArray(input.spec?.missingFields)
    ? input.spec.missingFields.filter((field) => typeof field === "string" && field.trim().length > 0)
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
  const readinessReasons = typeof readiness === "object" && readiness !== null && Array.isArray(readiness.reasons)
    ? readiness.reasons.filter((reason) => typeof reason === "string" && reason.trim().length > 0)
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
