function slug(value) {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
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

export function buildProductionClarificationQuestions(input) {
  const questions = [];
  const specId = specIdFor(input.spec);
  const missingFields = Array.isArray(input.spec?.missingFields)
    ? input.spec.missingFields.filter((field) => typeof field === "string" && field.trim().length > 0)
    : [];

  missingFields.forEach((field) => {
    const cleanField = field.trim();
    questions.push({
      questionId: `${specId}-missingFields-${slug(cleanField)}`,
      reason: "missingFields",
      reasonCode: cleanField,
      severity: "blocking",
      blocking: true,
      prompt: `Bitte klären: ${cleanField}.`,
      sourceAnchors: [],
      suggestedAnswerType: "short_text"
    });
  });

  const readiness = input.spec?.readiness;
  const readinessReasons = typeof readiness === "object" && readiness !== null && Array.isArray(readiness.reasons)
    ? readiness.reasons.filter((reason) => typeof reason === "string" && reason.trim().length > 0)
    : [];

  readinessReasons.forEach((reason, index) => {
    const cleanReason = reason.trim();
    questions.push({
      questionId: `${specId}-readiness-reasons-${index + 1}`,
      reason: "readiness.reasons",
      reasonCode: "readiness_reason",
      severity: "warning",
      blocking: false,
      prompt: `Bitte prüfen: ${cleanReason}`,
      sourceAnchors: [],
      suggestedAnswerType: "short_text"
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
        suggestedAnswerType: "confirm_or_correct"
      });
    }

    warnings.forEach((warning, warningIndex) => {
      questions.push({
        questionId: `${specId}-documentIngestion-warnings-${slug(anchorRef)}-${warningIndex + 1}`,
        reason: "documentIngestion.warnings",
        reasonCode: warning,
        severity: "warning",
        blocking: false,
        prompt: `Bitte Ingestion-Warnung prüfen: ${warning}.`,
        sourceAnchors,
        suggestedAnswerType: "confirm_or_correct"
      });
    });
  });

  return questions;
}
