import {
  createOpenAiSyntheticLiveTransportFromEnv,
  validateOpenAiSyntheticLiveTransportEnv
} from "./llm-readiness-openai-transport.js";
import { llmReadinessEvalFixtures } from "./fixtures/llm-readiness-eval-fixtures.js";
import { findLlmReadinessPromptSchemaEntryByInputKind } from "./llm-readiness-prompt-schema-registry.js";
import {
  findLlmReadinessPromptArtifactByInputKind,
  validateLlmReadinessPromptArtifacts
} from "./llm-readiness-prompt-artifacts.js";
import { isLlmReadinessSyntheticLiveSliceEnabled } from "./llm-readiness-synthetic-live-slice.js";

function findClarificationFixture(fixtures) {
  return fixtures.find((fixture) => fixture.input.kind === "clarification_draft_request");
}

export function runLlmReadinessSyntheticLivePreflight(request) {
  const env = request.env ?? {};
  const fixtures = request.fixtures ?? llmReadinessEvalFixtures;
  const errors = [];
  const featureFlagEnabled = isLlmReadinessSyntheticLiveSliceEnabled(env);
  const promptArtifactsValidation = validateLlmReadinessPromptArtifacts();
  const transportValidation = validateOpenAiSyntheticLiveTransportEnv(env);
  const clarificationFixture = findClarificationFixture(fixtures);
  const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind("clarification_draft_request");
  const promptArtifact = findLlmReadinessPromptArtifactByInputKind("clarification_draft_request");

  if (!featureFlagEnabled) {
    errors.push("synthetic live slice feature flag is disabled");
  }

  errors.push(...transportValidation.errors);
  errors.push(...promptArtifactsValidation.errors.map((error) => `promptArtifacts.${error}`));

  if (!clarificationFixture) {
    errors.push("at least one synthetic clarification fixture must exist");
  }

  if (!promptSchemaEntry) {
    errors.push("prompt schema entry must exist for clarification_draft_request");
  }

  if (!promptArtifact) {
    errors.push("prompt artifact must exist for clarification_draft_request");
  }

  const transportBuild = createOpenAiSyntheticLiveTransportFromEnv(env);
  const transportCreatable = "run" in transportBuild;

  return {
    ok: errors.length === 0,
    errors,
    featureFlagEnabled,
    transportEnvValid: transportValidation.valid,
    promptArtifactsValid: promptArtifactsValidation.valid,
    clarificationFixtureAvailable: Boolean(clarificationFixture),
    transportCreatable,
    providerId: "openai-responses",
    fixtureId: clarificationFixture?.fixtureId,
    promptSchemaId: promptSchemaEntry?.promptSchemaId,
    promptArtifactId: promptArtifact?.promptArtifactId,
    model: env.CATERING_SYNTHETIC_LLM_MODEL,
    endpoint: env.CATERING_OPENAI_RESPONSES_URL
  };
}
