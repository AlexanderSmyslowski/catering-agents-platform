import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createLlmReadinessAgentAuditRecord,
  createLlmReadinessRunResult,
  FixtureOnlyLlmReadinessProviderAdapter,
  llmReadinessEvalFixtures,
  validateLlmReadinessRunResult,
  type LlmReadinessModelInput
} from "@catering/shared-core";

const docPath = "docs/architecture/PA40_LLM_READINESS_RUN_RESULT.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneInput(index: number): LlmReadinessModelInput {
  return structuredClone(llmReadinessEvalFixtures[index].input) as LlmReadinessModelInput;
}

async function buildAudit(index: number, promptSchemaId?: string) {
  const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
  const input = cloneInput(index);
  const request = promptSchemaId ? { input, promptSchemaId } : { input };
  const response = await adapter.run(request);
  const audit = createLlmReadinessAgentAuditRecord({
    auditId: `audit-${index}-${promptSchemaId ?? "ok"}`,
    request,
    response
  });

  return { input, request, response, audit };
}

describe("PA40 LLM readiness run result", () => {
  it("documents a providerless synthetic-only run-result anchor without runtime writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA40 LLM-Readiness Run-Result");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("builds a completed run result from a successful fixture-only run", async () => {
    const { input, request, response, audit } = await buildAudit(1);
    expect(audit.ok).toBe(true);

    const build = createLlmReadinessRunResult({
      resultId: "run-synthetic-summary-1",
      request,
      response,
      auditRecord: audit.auditRecord!
    });

    expect(build.ok).toBe(true);
    expect(build.errors).toEqual([]);
    expect(build.runResult).toMatchObject({
      resultVersion: "llm-readiness-run-result-v0",
      readinessContractVersion: "llm-readiness-v0",
      promptSchemaRegistryVersion: "llm-readiness-prompt-schema-registry-v0",
      agentAuditVersion: "llm-readiness-agent-audit-v0",
      resultId: "run-synthetic-summary-1",
      auditId: audit.auditRecord?.auditId,
      status: "completed",
      adapterId: "llm-readiness-fixture-provider-adapter",
      adapterMode: "fixture_only",
      inputId: input.inputId,
      inputKind: input.kind,
      outputKind: "operator_summary_draft",
      promptSchemaId: "operator-summary-draft-prompt-schema.v0",
      fixtureId: "llm-eval-synthetic-buffet-operator-summary",
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      allowedToolEffects: ["read"],
      sourceRefs: input.sourceRefs,
      humanApprovalRequired: true,
      writesProductObject: false,
      outputCandidate: response.outputCandidate,
      errorCount: 0,
      errors: []
    });

    expect(validateLlmReadinessRunResult(build.runResult).valid).toBe(true);
  });

  it("rejects completed production dossier run results that miss the dossier-specific draft contract", async () => {
    const { request, response, audit } = await buildAudit(2);
    expect(audit.ok).toBe(true);

    const invalidDossierResponse = {
      ...response,
      outputCandidate: {
        ...response.outputCandidate!,
        text: "Verständnis des Angebots\nRückfragen\nAnnahmen",
        structuredCandidate: {
          sectionCount: 8,
          summaryKind: "production_dossier",
          dataMode: "synthetic_or_demo_only",
          approval: "pending_human_review"
        }
      }
    };

    const build = createLlmReadinessRunResult({
      resultId: "run-synthetic-production-dossier-invalid",
      request,
      response: invalidDossierResponse,
      auditRecord: audit.auditRecord!
    });

    expect(build.ok).toBe(false);
    expect(build.runResult).toBeUndefined();
    expect(build.errors).toContain("response.outputCandidate.structuredCandidate.sectionCount must be 9");
    expect(build.errors).toContain(
      "response.outputCandidate.text must mention production dossier sections: missing kalkulation, mengen, rezept, metro, mise-en-place, abschluss"
    );
  });

  it("builds a rejected run result from a rejected fixture-only run", async () => {
    const { request, response, audit } = await buildAudit(0, "operator-summary-draft-prompt-schema.v0");
    expect(audit.ok).toBe(true);

    const build = createLlmReadinessRunResult({
      resultId: "run-synthetic-rejected-1",
      request,
      response,
      auditRecord: audit.auditRecord!
    });

    expect(build.ok).toBe(true);
    expect(build.runResult).toMatchObject({
      resultId: "run-synthetic-rejected-1",
      status: "rejected",
      promptSchemaId: "clarification-question-draft-prompt-schema.v0",
      outputKind: "clarification_question_draft",
      fixtureId: undefined,
      outputCandidate: undefined,
      errorCount: 1,
      errors: ["request.promptSchemaId must match the registered prompt schema"]
    });

    expect(validateLlmReadinessRunResult(build.runResult).valid).toBe(true);
  });

  it("rejects invalid build requests before producing a run result", async () => {
    const { request, response, audit } = await buildAudit(0);
    expect(audit.ok).toBe(true);

    const build = createLlmReadinessRunResult({
      resultId: "",
      request,
      response,
      auditRecord: {
        ...audit.auditRecord!,
        adapterId: "other-adapter"
      }
    });

    expect(build.ok).toBe(false);
    expect(build.errors).toContain("resultId must be a non-empty string");
    expect(build.errors).toContain("auditRecord.adapterId must match response.adapterId");
    expect(build.runResult).toBeUndefined();
  });

  it("rejects malformed run-result records via the record validator", () => {
    const validation = validateLlmReadinessRunResult({
      resultVersion: "llm-readiness-run-result-v0",
      readinessContractVersion: "llm-readiness-v0",
      promptSchemaRegistryVersion: "llm-readiness-prompt-schema-registry-v0",
      agentAuditVersion: "llm-readiness-agent-audit-v0",
      resultId: "run-broken",
      auditId: "audit-broken",
      status: "completed",
      adapterId: "llm-readiness-fixture-provider-adapter",
      adapterMode: "fixture_only",
      inputId: "input-broken",
      inputKind: "clarification_draft_request",
      outputKind: "clarification_question_draft",
      promptSchemaId: "clarification-question-draft-prompt-schema.v0",
      promptArtifactId: "clarification-question-draft.prompt",
      promptVersion: "v0",
      policyArtifactId: "clarification-question-draft.policy",
      policyVersion: "v0",
      outputSchemaId: "clarification-question-draft.output-schema.v0",
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      allowedToolEffects: ["read", "draft"],
      sourceRefs: cloneInput(0).sourceRefs,
      humanApprovalRequired: true,
      writesProductObject: false,
      errorCount: 0,
      errors: []
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("fixtureId is required when status is completed");
    expect(validation.errors).toContain("outputCandidate is required when status is completed");
  });
});
