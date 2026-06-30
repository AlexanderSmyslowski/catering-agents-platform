import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createLlmReadinessAgentAuditRecord,
  createLlmReadinessRunResult,
  llmReadinessEvalFixtures,
  SyntheticLiveLlmReadinessSlice,
  validateLlmReadinessAgentAuditRecord,
  validateLlmReadinessRunResult,
  type LlmReadinessModelInput,
  type LlmReadinessSyntheticLiveTransport
} from "@catering/shared-core";

const docPath = "docs/architecture/PA43_SYNTHETIC_LIVE_AUDIT_RUN_RESULT.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneInput(index: number): LlmReadinessModelInput {
  return structuredClone(llmReadinessEvalFixtures[index].input) as LlmReadinessModelInput;
}

async function buildSyntheticLiveClarificationRun() {
  const transport: LlmReadinessSyntheticLiveTransport = {
    run: async () => ({
      ok: true,
      errors: [],
      providerId: "openai-responses-api",
      providerRequestId: "resp_123",
      text: "Bitte klären, für wie viele Personen die Kaffeepause geplant werden soll.",
      structuredCandidate: {
        reason: "missingFields",
        reasonCode: "attendees.expected"
      }
    })
  };

  const input = cloneInput(0);
  const slice = new SyntheticLiveLlmReadinessSlice({
    enabled: true,
    transport
  });
  const response = await slice.run({
    providerRunId: "live-run-pa43-1",
    input
  });

  return {
    input,
    request: { input },
    response
  };
}

describe("PA43 synthetic-live audit and run-result", () => {
  it("documents the synthetic-live audit/run-result bridge", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA43 Synthetic-Live Audit und Run-Result");
    expect(doc).toContain("matched_provider");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Runtime-Conversation");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("builds a matched-provider audit record from a successful synthetic-live slice run", async () => {
    const { request, response } = await buildSyntheticLiveClarificationRun();

    const build = createLlmReadinessAgentAuditRecord({
      auditId: "audit-pa43-live-1",
      request,
      response
    });

    expect(build.ok).toBe(true);
    expect(build.errors).toEqual([]);
    expect(build.auditRecord).toMatchObject({
      auditId: "audit-pa43-live-1",
      status: "matched_provider",
      adapterId: "llm-readiness-synthetic-live-slice",
      adapterMode: "synthetic_live",
      fixtureId: "llm-eval-synthetic-coffee-break-missing-attendees",
      providerId: "openai-responses-api",
      providerRequestId: "resp_123",
      outputKind: "clarification_question_draft",
      promptSchemaId: "clarification-question-draft-prompt-schema.v0",
      promptArtifactId: "clarification-question-draft.prompt",
      policyArtifactId: "clarification-question-draft.policy",
      outputSchemaId: "clarification-question-draft.output-schema.v0",
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      humanApprovalRequired: true,
      writesProductObject: false,
      errorCount: 0,
      errors: []
    });

    expect(validateLlmReadinessAgentAuditRecord(build.auditRecord).valid).toBe(true);
  });

  it("carries synthetic-live provider metadata into the completed run result", async () => {
    const { request, response } = await buildSyntheticLiveClarificationRun();
    const audit = createLlmReadinessAgentAuditRecord({
      auditId: "audit-pa43-live-2",
      request,
      response
    });
    expect(audit.ok).toBe(true);

    const build = createLlmReadinessRunResult({
      resultId: "run-pa43-live-1",
      request,
      response,
      auditRecord: audit.auditRecord!
    });

    expect(build.ok).toBe(true);
    expect(build.errors).toEqual([]);
    expect(build.runResult).toMatchObject({
      resultId: "run-pa43-live-1",
      status: "completed",
      adapterId: "llm-readiness-synthetic-live-slice",
      adapterMode: "synthetic_live",
      fixtureId: "llm-eval-synthetic-coffee-break-missing-attendees",
      providerId: "openai-responses-api",
      providerRequestId: "resp_123",
      outputKind: "clarification_question_draft",
      promptSchemaId: "clarification-question-draft-prompt-schema.v0",
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      humanApprovalRequired: true,
      writesProductObject: false,
      outputCandidate: response.outputCandidate,
      errorCount: 0,
      errors: []
    });

    expect(validateLlmReadinessRunResult(build.runResult).valid).toBe(true);
  });
});
