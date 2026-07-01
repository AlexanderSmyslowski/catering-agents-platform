import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createLlmReadinessAgentAuditRecord,
  FixtureOnlyLlmReadinessProviderAdapter,
  llmReadinessEvalFixtures,
  validateLlmReadinessAgentAuditRecord,
  type LlmReadinessModelInput
} from "@catering/shared-core";

const docPath = "docs/architecture/PA39_LLM_READINESS_AGENT_AUDIT.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneInput(index: number): LlmReadinessModelInput {
  return structuredClone(llmReadinessEvalFixtures[index].input) as LlmReadinessModelInput;
}

describe("PA39 LLM readiness agent audit", () => {
  it("documents a providerless agent audit anchor without runtime writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA39 LLM-Readiness AgentAudit");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("builds a matched-fixture audit record from a successful fixture-only adapter run", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const input = cloneInput(0);
    const response = await adapter.run({ input });

    const build = createLlmReadinessAgentAuditRecord({
      auditId: "audit-synthetic-clarification-1",
      request: { input },
      response
    });

    expect(build.ok).toBe(true);
    expect(build.errors).toEqual([]);
    expect(build.auditRecord).toMatchObject({
      auditVersion: "llm-readiness-agent-audit-v0",
      readinessContractVersion: "llm-readiness-v0",
      promptSchemaRegistryVersion: "llm-readiness-prompt-schema-registry-v0",
      auditId: "audit-synthetic-clarification-1",
      status: "matched_fixture",
      adapterId: "llm-readiness-fixture-provider-adapter",
      adapterMode: "fixture_only",
      inputId: input.inputId,
      inputKind: input.kind,
      outputKind: response.outputCandidate?.kind,
      promptSchemaId: "clarification-question-draft-prompt-schema.v0",
      promptArtifactId: "clarification-question-draft.prompt",
      policyArtifactId: "clarification-question-draft.policy",
      outputSchemaId: "clarification-question-draft.output-schema.v0",
      fixtureId: "llm-eval-synthetic-coffee-break-missing-attendees",
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      allowedToolEffects: ["read", "draft"],
      sourceRefs: input.sourceRefs,
      humanApprovalRequired: true,
      writesProductObject: false,
      errorCount: 0,
      errors: []
    });

    expect(validateLlmReadinessAgentAuditRecord(build.auditRecord).valid).toBe(true);
  });

  it("builds a rejected audit record for a prompt-schema mismatch rejection", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const input = cloneInput(0);
    const response = await adapter.run({
      input,
      promptSchemaId: "operator-summary-draft-prompt-schema.v0"
    });

    const build = createLlmReadinessAgentAuditRecord({
      auditId: "audit-synthetic-rejected-1",
      request: { input, promptSchemaId: "operator-summary-draft-prompt-schema.v0" },
      response
    });

    expect(build.ok).toBe(true);
    expect(build.auditRecord).toMatchObject({
      auditId: "audit-synthetic-rejected-1",
      status: "rejected",
      promptSchemaId: "clarification-question-draft-prompt-schema.v0",
      outputKind: "clarification_question_draft",
      fixtureId: undefined,
      errorCount: 1,
      errors: ["request.promptSchemaId must match the registered prompt schema"]
    });

    expect(validateLlmReadinessAgentAuditRecord(build.auditRecord).valid).toBe(true);
  });

  it("rejects invalid build requests before producing an audit record", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const input = cloneInput(1) as unknown as Record<string, unknown>;
    const policy = structuredClone(cloneInput(1).policy) as Record<string, unknown>;
    policy.providerCalls = "enabled";
    input.policy = policy;
    const response = await adapter.run({ input: cloneInput(1) });

    const build = createLlmReadinessAgentAuditRecord({
      auditId: "",
      request: { input: input as unknown as LlmReadinessModelInput },
      response
    });

    expect(build.ok).toBe(false);
    expect(build.errors).toContain("auditId must be a non-empty string");
    expect(build.errors).toContain("request.input.policy.providerCalls must be disabled");
    expect(build.auditRecord).toBeUndefined();
  });

  it("rejects production dossier outputs that fail the dossier-specific draft contract", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const input = cloneInput(2);
    const response = await adapter.run({ input });
    const outputCandidate = structuredClone(response.outputCandidate);

    if (outputCandidate) {
      outputCandidate.text = "Verstaendnis\nRueckfragen\nAnnahmen";
      outputCandidate.structuredCandidate = {
        sectionCount: 8,
        summaryKind: "production_dossier",
        dataMode: "synthetic_or_demo_only",
        approval: "pending_human_review"
      };
    }

    const build = createLlmReadinessAgentAuditRecord({
      auditId: "audit-synthetic-production-dossier-invalid",
      request: { input },
      response: {
        ...response,
        outputCandidate
      }
    });

    expect(build.ok).toBe(false);
    expect(build.errors).toContain("response.outputCandidate.structuredCandidate.sectionCount must be 9");
    expect(build.errors).toContain(
      "response.outputCandidate.text must mention production dossier sections: missing kalkulation, mengen, rezept, metro, mise-en-place, abschluss"
    );
    expect(build.auditRecord).toBeUndefined();
  });

  it("rejects malformed audit records via the record validator", () => {
    const validation = validateLlmReadinessAgentAuditRecord({
      auditVersion: "llm-readiness-agent-audit-v0",
      readinessContractVersion: "llm-readiness-v0",
      promptSchemaRegistryVersion: "llm-readiness-prompt-schema-registry-v0",
      auditId: "audit-broken",
      status: "matched_fixture",
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
      errorCount: 1,
      errors: []
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("errorCount must match errors.length");
    expect(validation.errors).toContain("fixtureId is required when status is matched_fixture");
  });
});
