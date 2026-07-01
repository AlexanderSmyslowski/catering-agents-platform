import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  validateLlmReadinessEvalOutputCandidateMatch,
  type LlmReadinessEvalFixture,
  type LlmReadinessModelOutputCandidate
} from "@catering/shared-core";

const docPath = "docs/architecture/PA36_LLM_READINESS_EVAL_HARNESS.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneFixture(index: number): LlmReadinessEvalFixture {
  return structuredClone(llmReadinessEvalFixtures[index]) as LlmReadinessEvalFixture;
}

function cloneExpectedOutput(index: number): LlmReadinessModelOutputCandidate {
  return structuredClone(llmReadinessEvalFixtures[index].expectedOutput) as LlmReadinessModelOutputCandidate;
}

describe("PA36 LLM readiness eval harness", () => {
  it("documents the providerless eval harness without runtime writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA36 LLM-Readiness Eval-Harness");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("accepts each current fixture expected output with whitespace-normalized text", () => {
    llmReadinessEvalFixtures.forEach((fixture, index) => {
      const candidate = cloneExpectedOutput(index);
      candidate.text = ` ${candidate.text}\n`;

      expect(validateLlmReadinessEvalOutputCandidateMatch(fixture, candidate)).toEqual({
        valid: true,
        errors: []
      });
    });
  });

  it("rejects output candidates whose kind drifts from the fixture expectation", () => {
    const fixture = cloneFixture(1);
    const candidate = cloneExpectedOutput(1);
    candidate.kind = "clarification_question_draft";

    expect(validateLlmReadinessEvalOutputCandidateMatch(fixture, candidate)).toEqual({
      valid: false,
      errors: ["candidate.kind must match fixture expectedOutput.kind"]
    });
  });

  it("rejects output candidates whose source refs or structured candidate drift", () => {
    const fixture = cloneFixture(1);
    const candidate = cloneExpectedOutput(1);
    candidate.sourceRefs = candidate.sourceRefs.filter((sourceRef) => sourceRef.objectType !== "purchase_list");
    candidate.structuredCandidate = {
      summaryKind: "operator_context",
      dataMode: "synthetic_but_different"
    } as never;

    expect(validateLlmReadinessEvalOutputCandidateMatch(fixture, candidate)).toEqual({
      valid: false,
      errors: [
        "candidate.sourceRefs must match fixture expectedOutput.sourceRefs",
        "candidate.structuredCandidate must match fixture expectedOutput.structuredCandidate"
      ]
    });
  });

  it("surfaces invalid output candidates through candidate-prefixed harness errors", () => {
    const fixture = cloneFixture(0);
    const candidate = cloneExpectedOutput(0) as unknown as Record<string, unknown>;
    candidate.writesProductObject = true;
    candidate.providerResponse = "{}";

    const result = validateLlmReadinessEvalOutputCandidateMatch(fixture, candidate);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("candidate.writesProductObject must be false");
    expect(result.errors).toContain("candidate.providerResponse is not allowed in readiness output candidates");
    expect(result.errors).toContain(
      "candidate.writesProductObject must match fixture expectedOutput.writesProductObject"
    );
  });

  it("uses input-specific draft output validation for production dossier candidates", () => {
    const fixture = cloneFixture(2);
    const candidate = cloneExpectedOutput(2);
    candidate.text = "Verstaendnis\nRueckfragen\nAnnahmen";
    candidate.structuredCandidate = {
      sectionCount: 8,
      summaryKind: "production_dossier",
      dataMode: "synthetic_or_demo_only",
      approval: "pending_human_review"
    };

    const result = validateLlmReadinessEvalOutputCandidateMatch(fixture, candidate);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("candidate.structuredCandidate.sectionCount must be 9");
    expect(result.errors).toContain(
      "candidate.text must mention production dossier sections: missing kalkulation, mengen, rezept, metro, mise-en-place, abschluss"
    );
  });

  it("surfaces invalid fixtures through fixture-prefixed harness errors", () => {
    const fixture = cloneFixture(0);
    fixture.disallowedPayloadKeys = fixture.disallowedPayloadKeys.filter((key) => key !== "toolCalls");
    const candidate = cloneExpectedOutput(0);

    expect(validateLlmReadinessEvalOutputCandidateMatch(fixture, candidate)).toEqual({
      valid: false,
      errors: ["fixture.disallowedPayloadKeys must match llmReadinessForbiddenPayloadKeys"]
    });
  });
});
