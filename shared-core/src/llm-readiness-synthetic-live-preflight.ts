import {
  createOpenAiSyntheticLiveTransportFromEnv,
  validateOpenAiSyntheticLiveTransportEnv,
  type OpenAiSyntheticLiveTransportEnv
} from "./llm-readiness-openai-transport.js";
import {
  llmReadinessEvalFixtures,
  type LlmReadinessEvalFixture
} from "./fixtures/llm-readiness-eval-fixtures.js";
import { findLlmReadinessPromptSchemaEntryByInputKind } from "./llm-readiness-prompt-schema-registry.js";
import {
  findLlmReadinessPromptArtifactByInputKind,
  validateLlmReadinessPromptArtifacts
} from "./llm-readiness-prompt-artifacts.js";
import { isLlmReadinessSyntheticLiveSliceEnabled } from "./llm-readiness-synthetic-live-slice.js";

export interface LlmReadinessSyntheticLivePreflightRequest {
  env?: Record<string, string | undefined> & OpenAiSyntheticLiveTransportEnv;
  fixtures?: readonly LlmReadinessEvalFixture[];
}

export interface LlmReadinessSyntheticLivePreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  featureFlagEnabled: boolean;
  transportEnvValid: boolean;
  promptArtifactsValid: boolean;
  clarificationFixtureAvailable: boolean;
  transportCreatable: boolean;
  policyReady: boolean;
  operatorNamePresent: boolean;
  budgetNotePresent: boolean;
  humanApprovalRequired: boolean;
  rawPromptResponseLoggingAllowed: boolean;
  preferredEvidenceCommand: "npm run llm:synthetic-live:check";
  providerId: "openai-responses";
  fixtureId?: string;
  promptSchemaId?: string;
  promptArtifactId?: string;
  model?: string;
  endpoint?: string;
  operatorName?: string;
  budgetNote?: string;
}

function findClarificationFixture(
  fixtures: readonly LlmReadinessEvalFixture[]
): LlmReadinessEvalFixture | undefined {
  return fixtures.find((fixture) => fixture.input.kind === "clarification_draft_request");
}

export function runLlmReadinessSyntheticLivePreflight(
  request: LlmReadinessSyntheticLivePreflightRequest
): LlmReadinessSyntheticLivePreflightResult {
  const env = request.env ?? {};
  const fixtures = request.fixtures ?? llmReadinessEvalFixtures;
  const errors: string[] = [];
  const warnings: string[] = [];
  const featureFlagEnabled = isLlmReadinessSyntheticLiveSliceEnabled(env);
  const promptArtifactsValidation = validateLlmReadinessPromptArtifacts();
  const transportValidation = validateOpenAiSyntheticLiveTransportEnv(env);
  const clarificationFixture = findClarificationFixture(fixtures);
  const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind("clarification_draft_request");
  const promptArtifact = findLlmReadinessPromptArtifactByInputKind("clarification_draft_request");
  const operatorName = env.CATERING_SYNTHETIC_LLM_OPERATOR_NAME?.trim();
  const budgetNote = env.CATERING_SYNTHETIC_LLM_BUDGET_NOTE?.trim();
  const operatorNamePresent = Boolean(operatorName);
  const budgetNotePresent = Boolean(budgetNote);

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

  if (!operatorNamePresent) {
    warnings.push("CATERING_SYNTHETIC_LLM_OPERATOR_NAME should be set for named internal operator runs");
  }

  if (!budgetNotePresent) {
    warnings.push("CATERING_SYNTHETIC_LLM_BUDGET_NOTE should be set to a local test or monthly budget note");
  }

  const transportBuild = createOpenAiSyntheticLiveTransportFromEnv(env);
  const transportCreatable = "run" in transportBuild;
  const humanApprovalRequired = true;
  const rawPromptResponseLoggingAllowed = false;
  const preferredEvidenceCommand = "npm run llm:synthetic-live:check";

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    featureFlagEnabled,
    transportEnvValid: transportValidation.valid,
    promptArtifactsValid: promptArtifactsValidation.valid,
    clarificationFixtureAvailable: Boolean(clarificationFixture),
    transportCreatable,
    policyReady: warnings.length === 0,
    operatorNamePresent,
    budgetNotePresent,
    humanApprovalRequired,
    rawPromptResponseLoggingAllowed,
    preferredEvidenceCommand,
    providerId: "openai-responses",
    fixtureId: clarificationFixture?.fixtureId,
    promptSchemaId: promptSchemaEntry?.promptSchemaId,
    promptArtifactId: promptArtifact?.promptArtifactId,
    model: env.CATERING_SYNTHETIC_LLM_MODEL,
    endpoint: env.CATERING_OPENAI_RESPONSES_URL,
    operatorName,
    budgetNote
  };
}
