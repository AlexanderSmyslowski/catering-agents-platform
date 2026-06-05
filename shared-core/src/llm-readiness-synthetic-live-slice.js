import {
  validateLlmReadinessModelInputCandidate,
  validateLlmReadinessModelOutputCandidate
} from "./llm-readiness.js";
import { llmReadinessEvalFixtures } from "./fixtures/llm-readiness-eval-fixtures.js";
import { findLlmReadinessPromptSchemaEntryByInputKind } from "./llm-readiness-prompt-schema-registry.js";
import {
  findLlmReadinessPromptArtifactByInputKind,
  validateLlmReadinessPromptArtifacts
} from "./llm-readiness-prompt-artifacts.js";

const defaultAllowedInputKinds = ["clarification_draft_request"];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceRefKey(sourceRef) {
  return `${sourceRef.objectType}:${sourceRef.objectId}`;
}

function collectSourceRefKeys(sourceRefs) {
  if (!Array.isArray(sourceRefs)) {
    return [];
  }

  return sourceRefs
    .filter(isRecord)
    .map((sourceRef) => ({
      objectType: sourceRef.objectType,
      objectId: sourceRef.objectId
    }))
    .filter((sourceRef) => typeof sourceRef.objectType === "string" && typeof sourceRef.objectId === "string")
    .map(sourceRefKey)
    .sort();
}

function sameStringList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function fixtureMatchesInput(input, fixture) {
  return (
    fixture.input.kind === input.kind &&
    fixture.input.policy.providerCalls === input.policy.providerCalls &&
    fixture.input.policy.dataMode === input.policy.dataMode &&
    sameStringList(fixture.input.policy.allowedToolEffects, input.policy.allowedToolEffects) &&
    sameStringList(collectSourceRefKeys(fixture.input.sourceRefs), collectSourceRefKeys(input.sourceRefs))
  );
}

function buildUserPrompt(fixture) {
  const sourceRefLines = fixture.input.sourceRefs.map((sourceRef) =>
    `- ${sourceRef.objectType}:${sourceRef.objectId}${sourceRef.label ? ` (${sourceRef.label})` : ""}`
  );

  return [
    fixture.title,
    "",
    "Bekannte SourceRefs:",
    ...sourceRefLines,
    "",
    "Antwortformat: JSON mit text, reason und reasonCode."
  ].join("\n");
}

function buildOutputCandidate(input, outputKind, transportResponse) {
  return {
    contractVersion: input.contractVersion,
    outputId: `${input.inputId}-synthetic-live-output`,
    kind: outputKind,
    sourceRefs: structuredClone(input.sourceRefs),
    humanApprovalRequired: true,
    writesProductObject: false,
    text: transportResponse.text ?? "",
    structuredCandidate: transportResponse.structuredCandidate
  };
}

function validateCandidateAgainstSlice(fixture, candidate) {
  const errors = [];
  const expectedOutput = fixture.expectedOutput;
  const validation = validateLlmReadinessModelOutputCandidate(candidate);

  for (const error of validation.errors) {
    errors.push(`outputCandidate.${error}`);
  }

  if (candidate.kind !== expectedOutput.kind) {
    errors.push("outputCandidate.kind must match the fixture output kind");
  }

  if (!sameStringList(collectSourceRefKeys(candidate.sourceRefs), collectSourceRefKeys(expectedOutput.sourceRefs))) {
    errors.push("outputCandidate.sourceRefs must match fixture sourceRefs");
  }

  if (candidate.humanApprovalRequired !== true) {
    errors.push("outputCandidate.humanApprovalRequired must stay true");
  }

  if (candidate.writesProductObject !== false) {
    errors.push("outputCandidate.writesProductObject must stay false");
  }

  const expectedStructuredKeys = Object.keys(expectedOutput.structuredCandidate ?? {}).sort();
  const actualStructuredKeys = Object.keys(candidate.structuredCandidate ?? {}).sort();
  if (!sameStringList(expectedStructuredKeys, actualStructuredKeys)) {
    errors.push("outputCandidate.structuredCandidate keys must match the fixture contract");
  }

  return [...new Set(errors)];
}

export function isLlmReadinessSyntheticLiveSliceEnabled(env) {
  return env.CATERING_SYNTHETIC_LLM_SLICE === "1" || env.CATERING_SYNTHETIC_LLM_SLICE === "true";
}

export class SyntheticLiveLlmReadinessSlice {
  adapterId = "llm-readiness-synthetic-live-slice";
  adapterMode = "synthetic_live";

  constructor(options) {
    this.options = options;
  }

  async run(request) {
    const errors = [];
    const promptArtifactsValidation = validateLlmReadinessPromptArtifacts();
    errors.push(...promptArtifactsValidation.errors.map((error) => `promptArtifacts.${error}`));

    if (!this.options.enabled) {
      errors.push("synthetic live slice feature flag is disabled");
    }

    if (typeof request.providerRunId !== "string" || request.providerRunId.trim().length === 0) {
      errors.push("providerRunId must be a non-empty string");
    }

    const inputValidation = validateLlmReadinessModelInputCandidate(request.input);
    errors.push(...inputValidation.errors.map((error) => `input.${error}`));

    const allowedInputKinds = this.options.allowedInputKinds ?? defaultAllowedInputKinds;
    if (!allowedInputKinds.includes(request.input.kind)) {
      errors.push("input.kind is not enabled for the first synthetic live slice");
    }

    const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind(request.input.kind);
    const promptArtifact = findLlmReadinessPromptArtifactByInputKind(request.input.kind);

    if (!promptSchemaEntry) {
      errors.push("prompt schema entry must exist for input kind");
    }

    if (!promptArtifact) {
      errors.push("prompt artifact must exist for input kind");
    }

    if (request.promptSchemaId !== undefined && request.promptSchemaId !== promptSchemaEntry?.promptSchemaId) {
      errors.push("request.promptSchemaId must match the registered prompt schema");
    }

    const fixtures = this.options.fixtures ?? llmReadinessEvalFixtures;
    const fixture = fixtures.find((candidateFixture) => fixtureMatchesInput(request.input, candidateFixture));
    if (!fixture) {
      errors.push("request.input must match a known synthetic eval fixture");
    }

    if (errors.length > 0 || !promptSchemaEntry || !promptArtifact || !fixture) {
      return {
        ok: false,
        errors,
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        promptSchemaId: promptSchemaEntry?.promptSchemaId
      };
    }

    const transportResponse = await this.options.transport.run({
      providerRunId: request.providerRunId,
      fixtureId: fixture.fixtureId,
      promptSchemaId: promptSchemaEntry.promptSchemaId,
      promptArtifactId: promptArtifact.promptArtifactId,
      promptVersion: promptArtifact.promptVersion,
      outputKind: promptSchemaEntry.outputKind,
      systemPrompt: promptArtifact.systemPrompt,
      userPrompt: buildUserPrompt(fixture)
    });

    if (!transportResponse.ok) {
      return {
        ok: false,
        errors: transportResponse.errors,
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        fixtureId: fixture.fixtureId,
        promptSchemaId: promptSchemaEntry.promptSchemaId,
        providerId: transportResponse.providerId,
        providerRequestId: transportResponse.providerRequestId
      };
    }

    const outputCandidate = buildOutputCandidate(request.input, promptSchemaEntry.outputKind, transportResponse);
    const candidateErrors = validateCandidateAgainstSlice(fixture, outputCandidate);

    if (candidateErrors.length > 0) {
      return {
        ok: false,
        errors: candidateErrors,
        adapterId: this.adapterId,
        adapterMode: this.adapterMode,
        fixtureId: fixture.fixtureId,
        promptSchemaId: promptSchemaEntry.promptSchemaId,
        providerId: transportResponse.providerId,
        providerRequestId: transportResponse.providerRequestId
      };
    }

    return {
      ok: true,
      errors: [],
      adapterId: this.adapterId,
      adapterMode: this.adapterMode,
      fixtureId: fixture.fixtureId,
      promptSchemaId: promptSchemaEntry.promptSchemaId,
      providerId: transportResponse.providerId,
      providerRequestId: transportResponse.providerRequestId,
      outputCandidate
    };
  }
}
