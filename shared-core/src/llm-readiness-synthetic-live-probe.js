import { createLlmReadinessAgentAuditRecord } from "./llm-readiness-agent-audit.js";
import { evaluateLlmReadinessEvalOutputCandidateMatch } from "./llm-readiness-eval-harness.js";
import { llmReadinessEvalFixtures } from "./fixtures/llm-readiness-eval-fixtures.js";
import { createOpenAiSyntheticLiveTransportFromEnv } from "./llm-readiness-openai-transport.js";
import { createLlmReadinessRunResult } from "./llm-readiness-run-result.js";
import {
  isLlmReadinessSyntheticLiveSliceEnabled,
  SyntheticLiveLlmReadinessSlice
} from "./llm-readiness-synthetic-live-slice.js";

function findClarificationFixture(fixtures, fixtureId) {
  const matchingFixtures = fixtures.filter((fixture) => fixture.input.kind === "clarification_draft_request");
  if (fixtureId) {
    return matchingFixtures.find((fixture) => fixture.fixtureId === fixtureId);
  }

  return matchingFixtures[0];
}

function buildAuditId(providerRunId) {
  return `audit-${providerRunId}`;
}

function buildResultId(providerRunId) {
  return `run-${providerRunId}`;
}

export async function runLlmReadinessSyntheticLiveProbe(request) {
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
  const input = structuredClone(fixture.input);
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
