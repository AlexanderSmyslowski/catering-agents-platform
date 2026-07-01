import {
  llmReadinessContractVersion,
  llmReadinessModelInputKinds,
  llmReadinessModelOutputKinds,
  llmReadinessSourceObjectTypes,
  type LlmReadinessModelInputKind,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessModelOutputKind,
  type LlmReadinessSourceObjectType,
  type LlmReadinessSourceRef,
  type LlmReadinessToolEffect,
  validateLlmReadinessModelInputCandidate
} from "./llm-readiness.js";
import {
  findLlmReadinessPromptSchemaEntryByInputKind,
  llmReadinessPromptSchemaRegistryVersion,
  type LlmReadinessPromptSchemaRegistryEntry
} from "./llm-readiness-prompt-schema-registry.js";
import { validateLlmReadinessDraftOutputForInput } from "./llm-readiness-draft-output-validation.js";
import type {
  LlmReadinessProviderAdapterMode,
  LlmReadinessProviderAdapterRequest,
  LlmReadinessProviderAdapterResponse
} from "./llm-readiness-provider-adapter.js";

export const llmReadinessAgentAuditVersion = "llm-readiness-agent-audit-v0" as const;

export const llmReadinessAgentAuditStatuses = ["matched_fixture", "matched_provider", "rejected"] as const;

export type LlmReadinessAgentAuditStatus = typeof llmReadinessAgentAuditStatuses[number];

export interface LlmReadinessAgentAuditRecord {
  auditVersion: typeof llmReadinessAgentAuditVersion;
  readinessContractVersion: typeof llmReadinessContractVersion;
  promptSchemaRegistryVersion: typeof llmReadinessPromptSchemaRegistryVersion;
  auditId: string;
  status: LlmReadinessAgentAuditStatus;
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
  dataMode: "synthetic_or_demo_only";
  allowedToolEffects: readonly LlmReadinessToolEffect[];
  sourceRefs: readonly LlmReadinessSourceRef[];
  humanApprovalRequired: true;
  writesProductObject: false;
  errorCount: number;
  errors: readonly string[];
}

export interface LlmReadinessAgentAuditRecordBuildRequest {
  auditId: string;
  request: LlmReadinessProviderAdapterRequest;
  response: LlmReadinessProviderAdapterResponse;
}

export interface LlmReadinessAgentAuditRecordBuildResult {
  ok: boolean;
  errors: string[];
  auditRecord?: LlmReadinessAgentAuditRecord;
}

export interface LlmReadinessAgentAuditRecordValidation {
  valid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAllowedAuditStatus(value: unknown): value is LlmReadinessAgentAuditStatus {
  return typeof value === "string" &&
    llmReadinessAgentAuditStatuses.includes(value as LlmReadinessAgentAuditStatus);
}

function hasAllowedAdapterMode(value: unknown): value is LlmReadinessProviderAdapterMode {
  return value === "fixture_only" || value === "synthetic_live";
}

function hasAllowedInputKind(value: unknown): value is LlmReadinessModelInputKind {
  return typeof value === "string" && llmReadinessModelInputKinds.includes(value as LlmReadinessModelInputKind);
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

function validateResponseConsistency(
  request: LlmReadinessProviderAdapterRequest,
  response: LlmReadinessProviderAdapterResponse,
  promptSchemaEntry: LlmReadinessPromptSchemaRegistryEntry
): string[] {
  const errors: string[] = [];

  if (typeof response.adapterId !== "string" || response.adapterId.trim().length === 0) {
    errors.push("response.adapterId must be a non-empty string");
  }

  if (!hasAllowedAdapterMode(response.adapterMode)) {
    errors.push("response.adapterMode must be a supported adapter mode");
  }

  if (
    response.promptSchemaId !== undefined &&
    response.promptSchemaId !== promptSchemaEntry.promptSchemaId
  ) {
    errors.push("response.promptSchemaId must match the registered prompt schema");
  }

  if (response.ok) {
    if (response.errors.length > 0) {
      errors.push("response.errors must be empty when response.ok is true");
    }

    if (typeof response.fixtureId !== "string" || response.fixtureId.trim().length === 0) {
      errors.push("response.fixtureId must be a non-empty string when response.ok is true");
    }

    const outputValidation = validateLlmReadinessDraftOutputForInput(response.outputCandidate, request.input);
    for (const outputError of outputValidation.errors) {
      errors.push(`response.outputCandidate.${outputError}`);
    }

    if (response.outputCandidate?.kind !== promptSchemaEntry.outputKind) {
      errors.push("response.outputCandidate.kind must match the registered output kind");
    }

    if (response.adapterMode === "synthetic_live") {
      if (typeof response.providerId !== "string" || response.providerId.trim().length === 0) {
        errors.push("response.providerId must be a non-empty string for synthetic_live");
      }
    }
  } else {
    if (response.outputCandidate !== undefined) {
      errors.push("response.outputCandidate must be undefined when response.ok is false");
    }

    if (response.errors.length === 0) {
      errors.push("response.errors must not be empty when response.ok is false");
    }

    if (
      response.providerId !== undefined &&
      (typeof response.providerId !== "string" || response.providerId.trim().length === 0)
    ) {
      errors.push("response.providerId must be a non-empty string when present");
    }
  }

  if (
    response.ok &&
    response.outputCandidate !== undefined &&
    request.input.policy.providerCalls !== "disabled"
  ) {
    errors.push("request.input.policy.providerCalls must stay disabled");
  }

  return errors;
}

export function validateLlmReadinessAgentAuditRecord(
  candidate: unknown
): LlmReadinessAgentAuditRecordValidation {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ["candidate must be an object"] };
  }

  if (candidate.auditVersion !== llmReadinessAgentAuditVersion) {
    errors.push("auditVersion must match llm-readiness-agent-audit-v0");
  }

  if (candidate.readinessContractVersion !== llmReadinessContractVersion) {
    errors.push("readinessContractVersion must match llm-readiness-v0");
  }

  if (candidate.promptSchemaRegistryVersion !== llmReadinessPromptSchemaRegistryVersion) {
    errors.push("promptSchemaRegistryVersion must match llm-readiness-prompt-schema-registry-v0");
  }

  if (typeof candidate.auditId !== "string" || candidate.auditId.trim().length === 0) {
    errors.push("auditId must be a non-empty string");
  }

  if (!hasAllowedAuditStatus(candidate.status)) {
    errors.push("status must be an allowed audit status");
  }

  if (typeof candidate.adapterId !== "string" || candidate.adapterId.trim().length === 0) {
    errors.push("adapterId must be a non-empty string");
  }

  if (!hasAllowedAdapterMode(candidate.adapterMode)) {
    errors.push("adapterMode must be a supported adapter mode");
  }

  if (typeof candidate.inputId !== "string" || candidate.inputId.trim().length === 0) {
    errors.push("inputId must be a non-empty string");
  }

  if (!hasAllowedInputKind(candidate.inputKind)) {
    errors.push("inputKind must be an allowed draft input kind");
  }

  if (!hasAllowedOutputKind(candidate.outputKind)) {
    errors.push("outputKind must be an allowed draft output kind");
  }

  for (const key of [
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

  if (candidate.dataMode !== "synthetic_or_demo_only") {
    errors.push("dataMode must stay synthetic_or_demo_only");
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

  if (candidate.status === "matched_fixture") {
    if (candidate.fixtureId === undefined) {
      errors.push("fixtureId is required when status is matched_fixture");
    }

    if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
      errors.push("errors must be empty when status is matched_fixture");
    }
  }

  if (candidate.status === "matched_provider") {
    if (candidate.fixtureId === undefined) {
      errors.push("fixtureId is required when status is matched_provider");
    }

    if (candidate.adapterMode !== "synthetic_live") {
      errors.push("adapterMode must be synthetic_live when status is matched_provider");
    }

    if (candidate.providerId === undefined) {
      errors.push("providerId is required when status is matched_provider");
    }

    if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
      errors.push("errors must be empty when status is matched_provider");
    }
  }

  if (candidate.status === "rejected") {
    if (Array.isArray(candidate.errors) && candidate.errors.length === 0) {
      errors.push("errors must not be empty when status is rejected");
    }
  }

  return { valid: errors.length === 0, errors: uniqueErrors(errors) };
}

export function createLlmReadinessAgentAuditRecord(
  buildRequest: LlmReadinessAgentAuditRecordBuildRequest
): LlmReadinessAgentAuditRecordBuildResult {
  const errors: string[] = [];

  if (typeof buildRequest.auditId !== "string" || buildRequest.auditId.trim().length === 0) {
    errors.push("auditId must be a non-empty string");
  }

  const inputValidation = validateLlmReadinessModelInputCandidate(buildRequest.request.input);
  for (const inputError of inputValidation.errors) {
    errors.push(`request.input.${inputError}`);
  }

  const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind(buildRequest.request.input.kind);
  if (!promptSchemaEntry) {
    errors.push("prompt schema entry must exist for request input kind");
    return { ok: false, errors: uniqueErrors(errors) };
  }

  errors.push(
    ...validateResponseConsistency(buildRequest.request, buildRequest.response, promptSchemaEntry)
  );

  if (errors.length > 0) {
    return { ok: false, errors: uniqueErrors(errors) };
  }

  const normalizedErrors = uniqueErrors(buildRequest.response.errors);
  const auditRecord: LlmReadinessAgentAuditRecord = {
    auditVersion: llmReadinessAgentAuditVersion,
    readinessContractVersion: llmReadinessContractVersion,
    promptSchemaRegistryVersion: llmReadinessPromptSchemaRegistryVersion,
    auditId: buildRequest.auditId,
    status: buildRequest.response.ok
      ? buildRequest.response.adapterMode === "synthetic_live"
        ? "matched_provider"
        : "matched_fixture"
      : "rejected",
    adapterId: buildRequest.response.adapterId,
    adapterMode: buildRequest.response.adapterMode,
    inputId: buildRequest.request.input.inputId,
    inputKind: buildRequest.request.input.kind,
    outputKind: buildRequest.response.outputCandidate?.kind ?? promptSchemaEntry.outputKind,
    promptSchemaId: buildRequest.response.promptSchemaId ?? promptSchemaEntry.promptSchemaId,
    promptArtifactId: promptSchemaEntry.promptArtifactId,
    promptVersion: promptSchemaEntry.promptVersion,
    policyArtifactId: promptSchemaEntry.policyArtifactId,
    policyVersion: promptSchemaEntry.policyVersion,
    outputSchemaId: promptSchemaEntry.outputSchemaId,
    fixtureId: buildRequest.response.fixtureId,
    providerId: buildRequest.response.providerId,
    providerRequestId: buildRequest.response.providerRequestId,
    providerCalls: buildRequest.request.input.policy.providerCalls,
    dataMode: buildRequest.request.input.policy.dataMode,
    allowedToolEffects: [...buildRequest.request.input.policy.allowedToolEffects],
    sourceRefs: structuredClone(buildRequest.request.input.sourceRefs),
    humanApprovalRequired: buildRequest.response.outputCandidate?.humanApprovalRequired ??
      promptSchemaEntry.humanApprovalRequired,
    writesProductObject: buildRequest.response.outputCandidate?.writesProductObject ??
      promptSchemaEntry.writesProductObject,
    errorCount: normalizedErrors.length,
    errors: normalizedErrors
  };

  const auditValidation = validateLlmReadinessAgentAuditRecord(auditRecord);
  if (!auditValidation.valid) {
    return { ok: false, errors: auditValidation.errors };
  }

  return { ok: true, errors: [], auditRecord };
}
