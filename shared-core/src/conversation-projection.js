function readId(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function formatSize(sizeBytes) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function collectSourceAnchors(sourceInputs = []) {
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

    return [
      {
        documentId: sourceInput.documentId,
        filename: metadata.filename.trim(),
        mimeType: metadata.mimeType.trim(),
        sizeBytes: metadata.sizeBytes,
        sha256Short: metadata.sha256.trim().slice(0, 12),
        ingestedAt: metadata.ingestedAt.trim(),
        uploadContext: metadata.uploadContext.trim()
      }
    ];
  });
}

function formatSourceAnchor(anchor) {
  return [
    anchor.filename,
    anchor.mimeType,
    formatSize(anchor.sizeBytes),
    `sha256:${anchor.sha256Short}`,
    anchor.uploadContext,
    anchor.ingestedAt
  ].join(" · ");
}

export function buildProductionConversationProjection(input) {
  const sourceSpecId = input.spec ? readId(input.spec, ["specId", "id"]) : undefined;
  const sessionId = sourceSpecId ? `production-session-${sourceSpecId}` : "production-session-draft";
  const messages = [
    {
      messageId: `${sessionId}-system-context`,
      type: "system_agent_hint",
      role: "system",
      title: "Session-Grundlage",
      text: "Strukturierte Veranstaltungsdaten bleiben führend. Kein freier LLM-Chat."
    }
  ];

  const sourceAnchors = collectSourceAnchors(input.sourceInputs);
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
