import {
  llmReadinessAgentAuditVersion,
  type LlmReadinessAgentAuditRecord,
  validateLlmReadinessAgentAuditRecord
} from "./llm-readiness-agent-audit.js";
import {
  llmReadinessContractVersion,
  llmReadinessModelInputKinds,
  llmReadinessModelOutputKinds,
  llmReadinessSourceObjectTypes,
  type LlmReadinessModelInputKind,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessModelOutputKind,
  type LlmReadinessDataMode,
  type LlmReadinessSourceObjectType,
  type LlmReadinessSourceRef,
  type LlmReadinessToolEffect,
  validateLlmReadinessModelInputCandidate,
  validateLlmReadinessModelOutputCandidate
} from "./llm-readiness.js";
import {
  findLlmReadinessPromptSchemaEntryByInputKind,
  llmReadinessPromptSchemaRegistryVersion
} from "./llm-readiness-prompt-schema-registry.js";
import type {
  LlmReadinessProviderAdapterMode,
  LlmReadinessProviderAdapterRequest,
  LlmReadinessProviderAdapterResponse
} from "./llm-readiness-provider-adapter.js";

export const llmReadinessRunResultVersion = "llm-readiness-run-result-v0" as const;

export const llmReadinessRunResultStatuses = ["completed", "rejected"] as const;

export type LlmReadinessRunResultStatus = typeof llmReadinessRunResultStatuses[number];

export interface LlmReadinessRunResult {
  resultVersion: typeof llmReadinessRunResultVersion;
  readinessContractVersion: typeof llmReadinessContractVersion;
  promptSchemaRegistryVersion: typeof llmReadinessPromptSchemaRegistryVersion;
  agentAuditVersion: typeof llmReadinessAgentAuditVersion;
  resultId: string;
  auditId: string;
  status: LlmReadinessRunResultStatus;
  adapterId: string;
  adapterMode: LlmReadinessProviderAdapterMode;
  inputId: string;
  inputKind: LlmReadinessModelInputKind;
  outputKind: LlmReadinessModelOutputKind;
  promptSchemaId: string;
  promptArtifactId: string;
  promptVersion: string;
  policyArtifactId: string;
  policyVersion: string;
  outputSchemaId: string;
  fixtureId?: string;
  providerId?: string;
  providerRequestId?: string;
  providerCalls: "disabled";
  dataMode: LlmReadinessDataMode;
  allowedToolEffects: readonly LlmReadinessToolEffect[];
  sourceRefs: readonly LlmReadinessSourceRef[];
  humanApprovalRequired: true;
  writesProductObject: false;
  outputCandidate?: LlmReadinessModelOutputCandidate;
  errorCount: number;
  errors: readonly string[];
}

export interface LlmReadinessRunResultBuildRequest {
  resultId: string;
  request: LlmReadinessProviderAdapterRequest;
  response: LlmReadinessProviderAdapterResponse;
  auditRecord: LlmReadinessAgentAuditRecord;
}

export interface LlmReadinessRunResultBuildResult {
  ok: boolean;
  errors: string[];
  runResult?: LlmReadinessRunResult;
}

export interface LlmReadinessRunResultValidation {
  valid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAllowedStatus(value: unknown): value is LlmReadinessRunResultStatus {
  return typeof value === "string" &&
    llmReadinessRunResultStatuses.includes(value as LlmReadinessRunResultStatus);
}

function hasAllowedAdapterMode(value: unknown): value is LlmReadinessProviderAdapterMode {
  return value === "fixture_only" || value === "synthetic_live";
}

function hasAllowedInputKind(value: unknown): value is LlmReadinessModelInputKind {
  return typeof value === "string" && llmReadinessModelInputKinds.includes(value as LlmReadinessModelInputKind);
}

function hasAllowedDataMode(value: unknown): value is LlmReadinessDataMode {
  return value === "synthetic_or_demo_only" || value === "pseudonymized_approved";
}

function hasAllowedOutputKind(value: unknown): value is LlmReadinessModelOutputKind {
  return typeof value === "string" && llmReadinessModelOutputKinds.includes(value as LlmReadinessModelOutputKind);
}

function hasAllowedSourceObjectType(value: unknown): value is LlmReadinessSourceObjectType {
  return typeof value === "string" &&
    llmReadinessSourceObjectTypes.includes(value as LlmReadinessSourceObjectType);
}

function hasSafeSourceRefs(value: unknown): value is readonly LlmReadinessSourceRef[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((sourceRef) =>
      isRecord(sourceRef) &&
      hasAllowedSourceObjectType(sourceRef.objectType) &&
      typeof sourceRef.objectId === "string" &&
      sourceRef.objectId.trim().length > 0
    );
}

function hasAllowedInputToolEffects(value: unknown): value is readonly LlmReadinessToolEffect[] {
  if (!Array.isArray(value)) {
    return false;
  }

  if (value.length === 1) {
    return value[0] === "read";
  }

  return value.length === 2 && value[0] === "read" && value[1] === "draft";
}

function uniqueErrors(errors: readonly string[]): string[] {
  return [...new Set(errors)];
}

function sourceRefKey(sourceRef: Pick<LlmReadinessSourceRef, "objectType" | "objectId">): string {
  return `${sourceRef.objectType}:${sourceRef.objectId}`;
}

function collectSourceRefKeys(sourceRefs: unknown): string[] {
  if (!Array.isArray(sourceRefs)) {
    return [];
  }

  return sourceRefs
    .filter(isRecord)
    .map((sourceRef) => ({
      objectType: sourceRef.objectType,
      objectId: sourceRef.objectId
    }))
    .filter(
      (sourceRef): sourceRef is Pick<LlmReadinessSourceRef, "objectType" | "objectId"> =>
        typeof sourceRef.objectType === "string" && typeof sourceRef.objectId === "string"
    )
    .map(sourceRefKey)
    .sort();
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateAuditConsistency(
  request: LlmReadinessProviderAdapterRequest,
  response: LlmReadinessProviderAdapterResponse,
  auditRecord: LlmReadinessAgentAuditRecord
): string[] {
  const errors: string[] = [];

  if (auditRecord.inputId !== request.input.inputId) {
    errors.push("auditRecord.inputId must match request.input.inputId");
  }

  if (auditRecord.inputKind !== request.input.kind) {
    errors.push("auditRecord.inputKind must match request.input.kind");
  }

  if (auditRecord.adapterId !== response.adapterId) {
    errors.push("auditRecord.adapterId must match response.adapterId");
  }

  if (auditRecord.adapterMode !== response.adapterMode) {
    errors.push("auditRecord.adapterMode must match response.adapterMode");
  }

  if (auditRecord.promptSchemaId !== (response.promptSchemaId ?? auditRecord.promptSchemaId)) {
    errors.push("auditRecord.promptSchemaId must match response.promptSchemaId");
  }

  if (auditRecord.fixtureId !== response.fixtureId) {
    errors.push("auditRecord.fixtureId must match response.fixtureId");
  }

  if (auditRecord.providerId !== response.providerId) {
    errors.push("auditRecord.providerId must match response.providerId");
  }

  if (auditRecord.providerRequestId !== response.providerRequestId) {
    errors.push("auditRecord.providerRequestId must match response.providerRequestId");
  }

  if (auditRecord.errorCount !== response.errors.length) {
    errors.push("auditRecord.errorCount must match response.errors.length");
  }

  if (!sameStringList(auditRecord.errors, response.errors)) {
    errors.push("auditRecord.errors must match response.errors");
  }

  if (
    response.ok &&
    ((response.adapterMode === "fixture_only" && auditRecord.status !== "matched_fixture") ||
      (response.adapterMode === "synthetic_live" && auditRecord.status !== "matched_provider"))
  ) {
    errors.push("auditRecord.status must match the successful adapter mode");
  }

  if (!response.ok && auditRecord.status !== "rejected") {
    errors.push("auditRecord.status must be rejected when response.ok is false");
  }

  return errors;
}

export function validateLlmReadinessRunResult(
  candidate: unknown
): LlmReadinessRunResultValidation {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ["candidate must be an object"] };
  }

  if (candidate.resultVersion !== llmReadinessRunResultVersion) {
    errors.push("resultVersion must match llm-readiness-run-result-v0");
  }

  if (candidate.readinessContractVersion !== llmReadinessContractVersion) {
    errors.push("readinessContractVersion must match llm-readiness-v0");
  }

  if (candidate.promptSchemaRegistryVersion !== llmReadinessPromptSchemaRegistryVersion) {
    errors.push("promptSchemaRegistryVersion must match llm-readiness-prompt-schema-registry-v0");
  }

  if (candidate.agentAuditVersion !== llmReadinessAgentAuditVersion) {
    errors.push("agentAuditVersion must match llm-readiness-agent-audit-v0");
  }

  for (const key of [
    "resultId",
    "auditId",
    "adapterId",
    "inputId",
    "promptSchemaId",
    "promptArtifactId",
    "promptVersion",
    "policyArtifactId",
    "policyVersion",
    "outputSchemaId"
  ] as const) {
    if (typeof candidate[key] !== "string" || candidate[key].trim().length === 0) {
      errors.push(`${key} must be a non-empty string`);
    }
  }

  if (!hasAllowedStatus(candidate.status)) {
    errors.push("status must be an allowed run-result status");
  }

  if (!hasAllowedAdapterMode(candidate.adapterMode)) {
    errors.push("adapterMode must be a supported adapter mode");
  }

  if (!hasAllowedInputKind(candidate.inputKind)) {
    errors.push("inputKind must be an allowed draft input kind");
  }

  if (!hasAllowedOutputKind(candidate.outputKind)) {
    errors.push("outputKind must be an allowed draft output kind");
  }

  if (
    candidate.fixtureId !== undefined &&
    (typeof candidate.fixtureId !== "string" || candidate.fixtureId.trim().length === 0)
  ) {
    errors.push("fixtureId must be a non-empty string when present");
  }

  if (
    candidate.providerId !== undefined &&
    (typeof candidate.providerId !== "string" || candidate.providerId.trim().length === 0)
  ) {
    errors.push("providerId must be a non-empty string when present");
  }

  if (
    candidate.providerRequestId !== undefined &&
    (typeof candidate.providerRequestId !== "string" || candidate.providerRequestId.trim().length === 0)
  ) {
    errors.push("providerRequestId must be a non-empty string when present");
  }

  if (candidate.providerCalls !== "disabled") {
    errors.push("providerCalls must stay disabled");
  }

  if (!hasAllowedDataMode(candidate.dataMode)) {
    errors.push("dataMode must stay synthetic_or_demo_only or pseudonymized_approved");
  }

  if (!hasAllowedInputToolEffects(candidate.allowedToolEffects)) {
    errors.push("allowedToolEffects must stay within the read/draft input corridor");
  }

  if (!hasSafeSourceRefs(candidate.sourceRefs)) {
    errors.push("sourceRefs must contain at least one safe source ref");
  }

  if (candidate.humanApprovalRequired !== true) {
    errors.push("humanApprovalRequired must stay true");
  }

  if (candidate.writesProductObject !== false) {
    errors.push("writesProductObject must stay false");
  }

  if (!Array.isArray(candidate.errors) || candidate.errors.some((error) => typeof error !== "string")) {
    errors.push("errors must be a string array");
  }

  const errorCount = candidate.errorCount;
  if (typeof errorCount !== "number" || !Number.isInteger(errorCount) || errorCount < 0) {
    errors.push("errorCount must be a non-negative integer");
  } else if (Array.isArray(candidate.errors) && errorCount !== candidate.errors.length) {
    errors.push("errorCount must match errors.length");
  }

  if (candidate.status === "completed") {
    if (candidate.fixtureId === undefined) {
      errors.push("fixtureId is required when status is completed");
    }

    if (!isRecord(candidate.outputCandidate)) {
      errors.push("outputCandidate is required when status is completed");
    } else {
      const outputValidation = validateLlmReadinessModelOutputCandidate(candidate.outputCandidate);
      for (const outputError of outputValidation.errors) {
        errors.push(`outputCandidate.${outputError}`);
      }

      if (candidate.outputCandidate.kind !== candidate.outputKind) {
        errors.push("outputCandidate.kind must match outputKind");
      }

      if (
        Array.isArray(candidate.sourceRefs) &&
        Array.isArray(candidate.outputCandidate.sourceRefs) &&
        !sameStringList(collectSourceRefKeys(candidate.sourceRefs), collectSourceRefKeys(candidate.outputCandidate.sourceRefs))
      ) {
        errors.push("outputCandidate.sourceRefs must match sourceRefs");
      }
    }

    if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
      errors.push("errors must be empty when status is completed");
    }
  }

  if (candidate.status === "rejected") {
    if (candidate.outputCandidate !== undefined) {
      errors.push("outputCandidate must be undefined when status is rejected");
    }

    if (Array.isArray(candidate.errors) && candidate.errors.length === 0) {
      errors.push("errors must not be empty when status is rejected");
    }
  }

  return { valid: errors.length === 0, errors: uniqueErrors(errors) };
}

export function createLlmReadinessRunResult(
  buildRequest: LlmReadinessRunResultBuildRequest
): LlmReadinessRunResultBuildResult {
  const errors: string[] = [];

  if (typeof buildRequest.resultId !== "string" || buildRequest.resultId.trim().length === 0) {
    errors.push("resultId must be a non-empty string");
  }

  const inputValidation = validateLlmReadinessModelInputCandidate(buildRequest.request.input);
  for (const inputError of inputValidation.errors) {
    errors.push(`request.input.${inputError}`);
  }

  const auditValidation = validateLlmReadinessAgentAuditRecord(buildRequest.auditRecord);
  for (const auditError of auditValidation.errors) {
    errors.push(`auditRecord.${auditError}`);
  }

  const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind(buildRequest.request.input.kind);
  if (!promptSchemaEntry) {
    errors.push("prompt schema entry must exist for request input kind");
    return { ok: false, errors: uniqueErrors(errors) };
  }

  errors.push(
    ...validateAuditConsistency(buildRequest.request, buildRequest.response, buildRequest.auditRecord)
  );

  if (buildRequest.response.ok) {
    const outputValidation = validateLlmReadinessModelOutputCandidate(buildRequest.response.outputCandidate);
    for (const outputError of outputValidation.errors) {
      errors.push(`response.outputCandidate.${outputError}`);
    }
  } else if (buildRequest.response.outputCandidate !== undefined) {
    errors.push("response.outputCandidate must be undefined when response.ok is false");
  }

  if (errors.length > 0) {
    return { ok: false, errors: uniqueErrors(errors) };
  }

  const normalizedErrors = uniqueErrors(buildRequest.response.errors);
  const runResult: LlmReadinessRunResult = {
    resultVersion: llmReadinessRunResultVersion,
    readinessContractVersion: llmReadinessContractVersion,
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    agentAuditVersion: llmReadinessAgentAuditVersion,
    resultId: buildRequest.resultId,
    auditId: buildRequest.auditRecord.auditId,
    status: buildRequest.response.ok ? "completed" : "rejected",
    adapterId: buildRequest.response.adapterId,
    adapterMode: buildRequest.response.adapterMode,
    inputId: buildRequest.request.input.inputId,
    inputKind: buildRequest.request.input.kind,
    outputKind: buildRequest.response.outputCandidate?.kind ?? buildRequest.auditRecord.outputKind,
    promptSchemaId: buildRequest.auditRecord.promptSchemaId,
    promptArtifactId: buildRequest.auditRecord.promptArtifactId,
    promptVersion: buildRequest.auditRecord.promptVersion,
    policyArtifactId: buildRequest.auditRecord.policyArtifactId,
    policyVersion: buildRequest.auditRecord.policyVersion,
    outputSchemaId: buildRequest.auditRecord.outputSchemaId,
    fixtureId: buildRequest.response.fixtureId,
    providerId: buildRequest.response.providerId,
    providerRequestId: buildRequest.response.providerRequestId,
    providerCalls: buildRequest.request.input.policy.providerCalls,
    dataMode: buildRequest.request.input.policy.dataMode,
    allowedToolEffects: [...buildRequest.request.input.policy.allowedToolEffects],
    sourceRefs: structuredClone(buildRequest.request.input.sourceRefs),
    humanApprovalRequired: buildRequest.auditRecord.humanApprovalRequired,
    writesProductObject: buildRequest.auditRecord.writesProductObject,
    outputCandidate: buildRequest.response.ok ? structuredClone(buildRequest.response.outputCandidate) : undefined,
    errorCount: normalizedErrors.length,
    errors: normalizedErrors
  };

  const resultValidation = validateLlmReadinessRunResult(runResult);
  if (!resultValidation.valid) {
    return { ok: false, errors: resultValidation.errors };
  }

  return { ok: true, errors: [], runResult };
}
