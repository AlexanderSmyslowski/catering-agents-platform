import type {
  ProductionSourceDetail,
  ProductionWorkspaceState
} from "./api.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function channelFromSourceType(sourceType: string | undefined): string | undefined {
  const channels: Record<string, string> = {
    manual_input: "manual_form",
    pdf: "pdf_upload",
    email: "email",
    offer_service: "offer",
    web_import: "web_import"
  };
  return sourceType ? channels[sourceType] : undefined;
}

function lineageIsBoundToDraftOrCaseSource(
  lineage: Record<string, unknown>,
  workspace: ProductionWorkspaceState
): boolean {
  const reference = optionalString(lineage.reference);
  if (!reference) return false;
  const draftSourceRef = optionalString(workspace.currentDraft?.source?.sourceRef);
  const draftInputHash = optionalString(workspace.currentDraft?.source?.inputHash);

  return reference === draftInputHash || workspace.activeSources.some((source) => {
    const sha256 = optionalString(source.sha256);
    const filename = optionalString(source.filename);
    return reference === optionalString(source.requestId) ||
      reference === optionalString(source.documentId) ||
      reference === optionalString(source.sourceId) ||
      (sha256 !== undefined && reference === `sha256:${sha256}`) ||
      (filename !== undefined && draftSourceRef === `upload:${filename}` && draftInputHash === `sha256:${sha256}`);
  });
}

function intakeLineage(
  eventSpec: Record<string, unknown> | undefined,
  workspace: ProductionWorkspaceState
) {
  const entries = Array.isArray(eventSpec?.sourceLineage)
    ? eventSpec.sourceLineage.map(asRecord).filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : [];
  const supportedEntries = entries.filter((entry) => Boolean(channelFromSourceType(optionalString(entry.sourceType))));
  const boundEntries = supportedEntries.filter((entry) => lineageIsBoundToDraftOrCaseSource(entry, workspace));
  if (boundEntries.length === 1) return boundEntries[0];
  if (boundEntries.length > 1) {
    const sourceTypes = new Set(boundEntries.map((entry) => optionalString(entry.sourceType)));
    return sourceTypes.size === 1 ? boundEntries[0] : undefined;
  }

  return supportedEntries.length === 1 ? supportedEntries[0] : undefined;
}

function requestIdFromSnapshot(
  boundSources: ProductionWorkspaceState["activeSources"],
  lineage: Record<string, unknown> | undefined
): string | undefined {
  const lineageType = optionalString(lineage?.sourceType);
  const lineageReference = optionalString(lineage?.reference);
  const lineageRequestId = lineageType === "manual_input" || lineageType === "email"
    ? lineageReference
    : undefined;
  const activeRequestIds = [...new Set(
    boundSources
      .map((source) => optionalString(source.requestId))
      .filter((value): value is string => Boolean(value))
  )];
  if (lineageRequestId && (activeRequestIds.length === 0 || activeRequestIds.includes(lineageRequestId))) {
    return lineageRequestId;
  }
  return activeRequestIds.length === 1 ? activeRequestIds[0] : undefined;
}

function sourceIsBoundToSnapshot(input: {
  source: ProductionWorkspaceState["activeSources"][number];
  eventSpec: Record<string, unknown> | undefined;
  lineage: Record<string, unknown> | undefined;
  workspace: ProductionWorkspaceState;
}): boolean {
  const lineageReference = optionalString(input.lineage?.reference);
  const sourceRequestId = optionalString(input.source.requestId);
  const sourceDocumentId = optionalString(input.source.documentId);
  const sourceId = optionalString(input.source.sourceId);
  const filename = optionalString(input.source.filename);
  const sha256 = optionalString(input.source.sha256);
  const draftSourceRef = optionalString(input.workspace.currentDraft?.source?.sourceRef);
  const draftInputHash = optionalString(input.workspace.currentDraft?.source?.inputHash);

  return Boolean(
    (sourceRequestId && sourceRequestId === lineageReference) ||
    (lineageReference && (lineageReference === sourceDocumentId || lineageReference === sourceId)) ||
    (sha256 && lineageReference === `sha256:${sha256}`) ||
    (filename && draftSourceRef === `upload:${filename}`) ||
    (sha256 && draftInputHash === `sha256:${sha256}`)
  );
}

/**
 * Builds display-only source provenance from the already projected Production
 * aggregate. The allowlist prevents raw Intake text and commercial fields from
 * being smuggled back into the Production route after its Intake reads were
 * intentionally removed.
 */
export function buildProductionSnapshotSourceDetail(
  workspace: ProductionWorkspaceState
): ProductionSourceDetail | undefined {
  const eventSpec = asRecord(workspace.currentDraft?.draftArtifacts?.eventSpec);
  const lineage = intakeLineage(eventSpec, workspace);
  const channel = channelFromSourceType(optionalString(lineage?.sourceType));
  const boundSources = workspace.activeSources
    .filter((source) => sourceIsBoundToSnapshot({ source, eventSpec, lineage, workspace }));
  const boundSourceTimes = [...new Set(
    boundSources.map((source) => optionalString(source.addedAt)).filter((value): value is string => Boolean(value))
  )];
  const receivedAt = optionalString(workspace.currentDraft?.source?.receivedAt)
    ?? (boundSourceTimes.length === 1 ? boundSourceTimes[0] : undefined);
  const requestId = requestIdFromSnapshot(boundSources, lineage);
  const rawInputs = boundSources
    .flatMap((source) => {
    const documentId = optionalString(source.documentId);
    const filename = optionalString(source.filename);
    const mimeType = optionalString(source.mimeType);
    const sha256 = optionalString(source.sha256);
    const ingestedAt = optionalString(source.addedAt);
    if (!documentId && !filename && !mimeType && !sha256) return [];

      return [{
      kind: mimeType === "application/pdf" ? "pdf" : "document",
      ...(documentId ? { documentId } : {}),
      ...(mimeType ? { mimeType } : {}),
      sourceMetadata: {
        ...(filename ? { filename } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(sha256 ? { sha256 } : {}),
        ...(ingestedAt ? { ingestedAt } : {}),
        uploadContext: "production"
      }
      }];
    });

  if (!requestId && !channel && !receivedAt && rawInputs.length === 0) {
    return undefined;
  }

  return {
    ...(requestId ? { requestId } : {}),
    ...((channel || receivedAt)
      ? { source: { ...(channel ? { channel } : {}), ...(receivedAt ? { receivedAt } : {}) } }
      : {}),
    ...(rawInputs.length > 0 ? { rawInputs } : {})
  };
}
