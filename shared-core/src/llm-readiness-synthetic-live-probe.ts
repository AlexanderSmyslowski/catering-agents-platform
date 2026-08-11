import { createHash } from "node:crypto";
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
import {
  createByoLlmProviderDescriptor,
  evaluateByoLlmProviderDataGate,
  loadByoLlmExternalProcessingApprovalFromEnv
} from "./byo-llm-provider-data-policy.js";
import type { LlmReadinessModelInput, LlmReadinessSourceRef } from "./llm-readiness.js";
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
  evalMatched?: boolean;
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

function sanitizeSyntheticFixtures(
  fixtures: readonly LlmReadinessEvalFixture[]
): readonly LlmReadinessEvalFixture[] {
  const sanitizeSourceRefs = (sourceRefs: readonly LlmReadinessSourceRef[]) => sourceRefs.map((sourceRef, index) => ({
    ...sourceRef,
    // Source ids are operator-facing prompt material in this eval harness;
    // hash even synthetic caller-supplied ids before they can leave the process.
    objectId: `synthetic-ref-${createHash("sha256").update(sourceRef.objectId).digest("hex").slice(0, 16)}`,
    label: `synthetic-source-${index + 1}`
  }));
  return fixtures.map((fixture) => {
    const sourceRefs = sanitizeSourceRefs(fixture.input.sourceRefs);
    return {
      ...fixture,
      // Caller-supplied fixture titles are not trusted provider input.
      title: `Synthetic clarification fixture ${fixture.fixtureId}`,
      input: {
        ...fixture.input,
        sourceRefs
      },
      expectedOutput: {
        ...fixture.expectedOutput,
        sourceRefs: sanitizeSourceRefs(fixture.expectedOutput.sourceRefs)
      }
    };
  });
}

function evaluateExternalProbeApproval(
  env: Record<string, string | undefined>
): { allowed: boolean; errors: string[] } {
  let approval;
  try {
    const businessId = env.CATERING_LLM_BUSINESS_ID?.trim() || env.CATERING_DEFAULT_BUSINESS_ID?.trim() || "local";
    const model = env.CATERING_SYNTHETIC_LLM_MODEL?.trim() || "unknown";
    const actualRegion = env.CATERING_LLM_PROCESSING_REGION?.trim() || "unknown";
    const retentionPolicy = env.CATERING_LLM_RETENTION_POLICY?.trim() || "unknown";
    const endpoint = env.CATERING_OPENAI_RESPONSES_URL?.trim() || "https://api.openai.com/v1/responses";
    const trainingUse = env.CATERING_LLM_TRAINING_USE === "contractually_excluded"
      ? "contractually_excluded"
      : env.CATERING_LLM_TRAINING_USE === "allowed" ? "allowed" : "unknown";
    const maximumEstimatedCostEur = Number(env.CATERING_LLM_MAX_ESTIMATED_COST_EUR ?? Number.MAX_VALUE);
    const descriptor = createByoLlmProviderDescriptor({
      providerKind: "openai",
      dataLeavesInstallation: true,
      providerModel: model,
      capability: "structured_output",
      actualRegion,
      maximumEstimatedCostEur,
      retentionPolicy,
      trainingUse,
      endpoint,
      metadataVerified: Boolean(
        businessId &&
        env.CATERING_SYNTHETIC_LLM_MODEL?.trim() &&
        env.CATERING_LLM_PROCESSING_REGION?.trim() &&
        env.CATERING_LLM_MAX_ESTIMATED_COST_EUR?.trim() &&
        env.CATERING_LLM_RETENTION_POLICY?.trim() &&
        env.CATERING_LLM_TRAINING_USE === "contractually_excluded" &&
        env.CATERING_OPENAI_RESPONSES_URL?.trim()
      )
    });
    approval = loadByoLlmExternalProcessingApprovalFromEnv(env);

    return evaluateByoLlmProviderDataGate({
      provider: descriptor,
      context: {
        businessId,
        dataClass: "synthetic_demo",
        purpose: "clarification_draft"
      },
      approval
    });
  } catch {
    return { allowed: false, errors: ["external provider metadata or approval is invalid"] };
  }
}

export async function runLlmReadinessSyntheticLiveProbe(
  request: LlmReadinessSyntheticLiveProbeRequest
): Promise<LlmReadinessSyntheticLiveProbeResult> {
  const fixtures = sanitizeSyntheticFixtures(request.fixtures ?? llmReadinessEvalFixtures);
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

  // The probe is an evaluation harness, not a second production ingestion
  // path. A caller-supplied fixture must remain synthetic and draft-only; in
  // particular, pseudonymized or confidential inputs must never reach its
  // transport without the product use-case gate.
  if (
    fixture.input.policy.providerCalls !== "disabled" ||
    fixture.input.policy.dataMode !== "synthetic_or_demo_only"
  ) {
    return {
      ok: false,
      errors: ["synthetic-live probe accepts only synthetic_demo fixtures"],
      fixtureId: fixture.fixtureId
    };
  }

  let transportOrError: LlmReadinessSyntheticLiveTransport | { errors: string[] };
  if (request.transport) {
    // A supplied transport is the in-process fake used by the evaluation
    // harness. The CLI and product surfaces cannot inject this test seam.
    transportOrError = request.transport;
  } else {
    const approvalDecision = evaluateExternalProbeApproval(request.env ?? {});
    if (!approvalDecision.allowed) {
      return {
        ok: false,
        errors: approvalDecision.errors,
        fixtureId: fixture.fixtureId
      };
    }
    transportOrError = createOpenAiSyntheticLiveTransportFromEnv(request.env ?? {});
  }

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
      evalMatched: evaluation?.valid,
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
      evalMatched: evaluation?.valid,
      input,
      response,
      auditRecord: auditBuild.auditRecord
    };
  }

  return {
    // A persisted rejected run is still a valid audit artifact, but it is not
    // a successful probe and must keep the mini-pilot fail-closed.
    ok: response.ok,
    errors: response.ok ? [] : response.errors,
    fixtureId: fixture.fixtureId,
    providerRunId,
    evaluation,
    evalMatched: evaluation?.valid,
    input,
    response,
    auditRecord: auditBuild.auditRecord,
    runResult: runResultBuild.runResult
  };
}
