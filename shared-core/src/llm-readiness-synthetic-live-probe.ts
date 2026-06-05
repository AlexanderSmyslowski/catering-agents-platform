import {
  createLlmReadinessAgentAuditRecord,
  type LlmReadinessAgentAuditRecord
} from "./llm-readiness-agent-audit.js";
import {
  evaluateLlmReadinessEvalOutputCandidateMatch,
  type LlmReadinessEvalOutputMatchDetails
} from "./llm-readiness-eval-harness.js";
import {
  llmReadinessEvalFixtures,
  type LlmReadinessEvalFixture
} from "./fixtures/llm-readiness-eval-fixtures.js";
import {
  createOpenAiSyntheticLiveTransportFromEnv,
  type OpenAiSyntheticLiveTransportEnv
} from "./llm-readiness-openai-transport.js";
import type { LlmReadinessModelInput } from "./llm-readiness.js";
import {
  createLlmReadinessRunResult,
  type LlmReadinessRunResult
} from "./llm-readiness-run-result.js";
import {
  isLlmReadinessSyntheticLiveSliceEnabled,
  SyntheticLiveLlmReadinessSlice,
  type LlmReadinessSyntheticLiveSliceResponse,
  type LlmReadinessSyntheticLiveTransport
} from "./llm-readiness-synthetic-live-slice.js";

export interface LlmReadinessSyntheticLiveProbeRequest {
  fixtureId?: string;
  providerRunId?: string;
  env?: Record<string, string | undefined> & OpenAiSyntheticLiveTransportEnv;
  fixtures?: readonly LlmReadinessEvalFixture[];
  transport?: LlmReadinessSyntheticLiveTransport;
}

export interface LlmReadinessSyntheticLiveProbeResult {
  ok: boolean;
  errors: string[];
  fixtureId?: string;
  providerRunId?: string;
  evaluation?: LlmReadinessEvalOutputMatchDetails;
  input?: LlmReadinessModelInput;
  response?: LlmReadinessSyntheticLiveSliceResponse;
  auditRecord?: LlmReadinessAgentAuditRecord;
  runResult?: LlmReadinessRunResult;
}

function findClarificationFixture(
  fixtures: readonly LlmReadinessEvalFixture[],
  fixtureId?: string
): LlmReadinessEvalFixture | undefined {
  const matchingFixtures = fixtures.filter((fixture) => fixture.input.kind === "clarification_draft_request");
  if (fixtureId) {
    return matchingFixtures.find((fixture) => fixture.fixtureId === fixtureId);
  }

  return matchingFixtures[0];
}

function buildAuditId(providerRunId: string): string {
  return `audit-${providerRunId}`;
}

function buildResultId(providerRunId: string): string {
  return `run-${providerRunId}`;
}

export async function runLlmReadinessSyntheticLiveProbe(
  request: LlmReadinessSyntheticLiveProbeRequest
): Promise<LlmReadinessSyntheticLiveProbeResult> {
  const fixtures = request.fixtures ?? llmReadinessEvalFixtures;
  const fixture = findClarificationFixture(fixtures, request.fixtureId);

  if (!fixture) {
    return {
      ok: false,
      errors: [
        request.fixtureId
          ? "fixtureId must match a synthetic clarification fixture"
          : "at least one synthetic clarification fixture must exist"
      ]
    };
  }

  const transportOrError = request.transport ??
    createOpenAiSyntheticLiveTransportFromEnv(request.env ?? {});

  if (!("run" in transportOrError)) {
    return {
      ok: false,
      errors: transportOrError.errors,
      fixtureId: fixture.fixtureId
    };
  }

  const providerRunId = request.providerRunId ?? `synthetic-live-probe-${fixture.fixtureId}`;
  const input = structuredClone(fixture.input) as LlmReadinessModelInput;
  const slice = new SyntheticLiveLlmReadinessSlice({
    enabled: isLlmReadinessSyntheticLiveSliceEnabled(request.env ?? {}),
    transport: transportOrError,
    fixtures
  });

  const response = await slice.run({
    providerRunId,
    input
  });
  const evaluation = response.outputCandidate
    ? evaluateLlmReadinessEvalOutputCandidateMatch(fixture, response.outputCandidate)
    : undefined;

  const auditBuild = createLlmReadinessAgentAuditRecord({
    auditId: buildAuditId(providerRunId),
    request: { input },
    response
  });

  if (!auditBuild.ok || !auditBuild.auditRecord) {
    return {
      ok: false,
      errors: auditBuild.errors,
      fixtureId: fixture.fixtureId,
      providerRunId,
      evaluation,
      input,
      response
    };
  }

  const runResultBuild = createLlmReadinessRunResult({
    resultId: buildResultId(providerRunId),
    request: { input },
    response,
    auditRecord: auditBuild.auditRecord
  });

  if (!runResultBuild.ok || !runResultBuild.runResult) {
    return {
      ok: false,
      errors: runResultBuild.errors,
      fixtureId: fixture.fixtureId,
      providerRunId,
      evaluation,
      input,
      response,
      auditRecord: auditBuild.auditRecord
    };
  }

  return {
    ok: true,
    errors: [],
    fixtureId: fixture.fixtureId,
    providerRunId,
    evaluation,
    input,
    response,
    auditRecord: auditBuild.auditRecord,
    runResult: runResultBuild.runResult
  };
}
