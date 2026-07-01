import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  validateLlmReadinessEvalFixture,
  type LlmReadinessEvalFixture
} from "@catering/shared-core";

const docPath = "docs/architecture/PA30_LLM_READINESS_EVAL_FIXTURE_VALIDATION.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneFixture(index: number): LlmReadinessEvalFixture {
  return structuredClone(llmReadinessEvalFixtures[index]) as LlmReadinessEvalFixture;
}

describe("PA30 LLM readiness eval fixture validation", () => {
  it("documents fixture validation without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA30 LLM-Readiness Eval-Fixture-Validation");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("accepts every current synthetic eval fixture through one central validator", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
        valid: true,
        errors: []
      });
    }
  });

  it("rejects provider real-data write-tool and raw payload fixture violations", () => {
    const fixture = cloneFixture(0);
    fixture.input.policy.providerCalls = "enabled" as never;
    fixture.input.policy.dataMode = "real_data" as never;
    fixture.input.policy.allowedToolEffects = ["read", "write"] as never;
    Object.assign(fixture.input, {
      prompt: "system prompt",
      providerResponse: "{}",
      toolCalls: [],
      secret: "nope"
    });

    const result = validateLlmReadinessEvalFixture(fixture);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("input.policy.providerCalls must be disabled");
    expect(result.errors).toContain("input.policy.dataMode must be synthetic_or_demo_only");
    expect(result.errors).toContain("input.policy.allowedToolEffects must be read or read+draft only");
    expect(result.errors).toContain("input.policy.providerCalls must match the draft contract");
    expect(result.errors).toContain("input.policy.dataMode must match the draft contract");
    expect(result.errors).toContain("input.policy.allowedToolEffects must match the draft contract");
    expect(result.errors).toContain("input.prompt is not allowed in readiness input candidates");
    expect(result.errors).toContain("input.providerResponse is not allowed in readiness input candidates");
    expect(result.errors).toContain("input.toolCalls is not allowed in readiness input candidates");
    expect(result.errors).toContain("input.secret is not allowed in readiness input candidates");
  });

  it("rejects fixtures that do not match a registered draft contract", () => {
    const fixture = cloneFixture(0);
    fixture.expectedOutput.kind = "operator_summary_draft";

    const result = validateLlmReadinessEvalFixture(fixture);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("expectedOutput.kind must match the draft contract outputKind");
  });

  it("applies the production dossier draft output contract to matching fixtures", () => {
    const fixture = cloneFixture(2);
    fixture.expectedOutput.text = "Verstaendnis\nRueckfragen\nAnnahmen";
    fixture.expectedOutput.structuredCandidate = {
      sectionCount: 8,
      summaryKind: "production_dossier",
      dataMode: "synthetic_or_demo_only",
      approval: "pending_human_review"
    };

    const result = validateLlmReadinessEvalFixture(fixture);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "productionDossierDraft.structuredCandidate.sectionCount must be 9"
    );
    expect(result.errors).toContain(
      "productionDossierDraft.text must mention production dossier sections: missing kalkulation, mengen, rezept, metro, mise-en-place, abschluss"
    );
  });

  it("rejects missing required source references and stale forbidden-key lists", () => {
    const fixture = cloneFixture(1);
    fixture.input.sourceRefs = fixture.input.sourceRefs.filter((sourceRef) => sourceRef.objectType !== "purchase_list");
    fixture.disallowedPayloadKeys = fixture.disallowedPayloadKeys.filter((key) => key !== "toolCalls");

    const result = validateLlmReadinessEvalFixture(fixture);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("input.sourceRefs must include purchase_list");
    expect(result.errors).toContain("disallowedPayloadKeys must match llmReadinessForbiddenPayloadKeys");
  });
});
