import {
  validateLlmReadinessModelInputCandidate,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessSourceRef
} from "./llm-readiness.js";
import {
  llmReadinessEvalFixtures,
  type LlmReadinessEvalFixture
} from "./fixtures/llm-readiness-eval-fixtures.js";
import {
  findLlmReadinessPromptSchemaEntryByInputKind,
  type LlmReadinessPromptSchemaRegistryEntry
} from "./llm-readiness-prompt-schema-registry.js";
import { validateLlmReadinessEvalOutputCandidateMatch } from "./llm-readiness-eval-harness.js";

export type LlmReadinessProviderAdapterMode = "fixture_only";

export interface LlmReadinessProviderAdapterRequest {
  input: LlmReadinessModelInput;
  promptSchemaId?: string;
}

export interface LlmReadinessProviderAdapterResponse {
  ok: boolean;
  errors: string[];
  adapterId: string;
  adapterMode: LlmReadinessProviderAdapterMode;
  fixtureId?: string;
  promptSchemaId?: string;
  outputCandidate?: LlmReadinessModelOutputCandidate;
}

export interface LlmReadinessProviderAdapter {
  adapterId: string;
  adapterMode: LlmReadinessProviderAdapterMode;
  run(request: LlmReadinessProviderAdapterRequest): Promise<LlmReadinessProviderAdapterResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function fixtureMatchesInput(input: LlmReadinessModelInput, fixture: LlmReadinessEvalFixture): boolean {
  return (
    fixture.input.kind === input.kind &&
    fixture.input.policy.providerCalls === input.policy.providerCalls &&
    fixture.input.policy.dataMode === input.policy.dataMode &&
    sameStringList(fixture.input.policy.allowedToolEffects, input.policy.allowedToolEffects) &&
    sameStringList(collectSourceRefKeys(fixture.input.sourceRefs), collectSourceRefKeys(input.sourceRefs))
  );
}

function buildInvalidResponse(
  errors: string[],
  promptSchemaEntry: LlmReadinessPromptSchemaRegistryEntry | undefined
): LlmReadinessProviderAdapterResponse {
  return {
    ok: false,
    errors,
    adapterId: "llm-readiness-fixture-provider-adapter",
    adapterMode: "fixture_only",
    promptSchemaId: promptSchemaEntry?.promptSchemaId
  };
}

export class FixtureOnlyLlmReadinessProviderAdapter implements LlmReadinessProviderAdapter {
  readonly adapterId = "llm-readiness-fixture-provider-adapter" as const;
  readonly adapterMode = "fixture_only" as const;

  constructor(private readonly fixtures: readonly LlmReadinessEvalFixture[] = llmReadinessEvalFixtures) {}

  async run(request: LlmReadinessProviderAdapterRequest): Promise<LlmReadinessProviderAdapterResponse> {
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
