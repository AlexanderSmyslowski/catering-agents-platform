import { validateLlmReadinessModelInputCandidate } from "./llm-readiness.js";
import { llmReadinessEvalFixtures } from "./fixtures/llm-readiness-eval-fixtures.js";
import { findLlmReadinessPromptSchemaEntryByInputKind } from "./llm-readiness-prompt-schema-registry.js";
import { validateLlmReadinessEvalOutputCandidateMatch } from "./llm-readiness-eval-harness.js";

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

function buildInvalidResponse(errors, promptSchemaEntry) {
  return {
    ok: false,
    errors,
    adapterId: "llm-readiness-fixture-provider-adapter",
    adapterMode: "fixture_only",
    promptSchemaId: promptSchemaEntry?.promptSchemaId
  };
}

export class FixtureOnlyLlmReadinessProviderAdapter {
  adapterId = "llm-readiness-fixture-provider-adapter";
  adapterMode = "fixture_only";

  constructor(fixtures = llmReadinessEvalFixtures) {
    this.fixtures = fixtures;
  }

  async run(request) {
    const inputValidation = validateLlmReadinessModelInputCandidate(request.input);
    const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind(request.input.kind);
    const errors = inputValidation.errors.map((error) => `input.${error}`);

    if (!promptSchemaEntry) {
      errors.push("prompt schema entry must exist for input kind");
      return buildInvalidResponse(errors, undefined);
    }

    if (
      request.promptSchemaId !== undefined &&
      request.promptSchemaId !== promptSchemaEntry.promptSchemaId
    ) {
      errors.push("request.promptSchemaId must match the registered prompt schema");
    }

    if (errors.length > 0) {
      return buildInvalidResponse(errors, promptSchemaEntry);
    }

    const fixture = this.fixtures.find((candidateFixture) => fixtureMatchesInput(request.input, candidateFixture));
    if (!fixture) {
      errors.push("no synthetic fixture matches input");
      return buildInvalidResponse(errors, promptSchemaEntry);
    }

    const harnessValidation = validateLlmReadinessEvalOutputCandidateMatch(
      fixture,
      structuredClone(fixture.expectedOutput)
    );
    if (!harnessValidation.valid) {
      return buildInvalidResponse(harnessValidation.errors, promptSchemaEntry);
    }

    return {
      ok: true,
      errors: [],
      adapterId: this.adapterId,
      adapterMode: this.adapterMode,
      fixtureId: fixture.fixtureId,
      promptSchemaId: promptSchemaEntry.promptSchemaId,
      outputCandidate: structuredClone(fixture.expectedOutput)
    };
  }
}
