import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  validateLlmReadinessEvalFixture,
  type LlmReadinessEvalFixture
} from "@catering/shared-core";

const docPath = "docs/architecture/PA33_LLM_READINESS_OUTPUT_SOURCE_REF_VALIDATION.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneFixture(index: number): LlmReadinessEvalFixture {
  return structuredClone(llmReadinessEvalFixtures[index]) as LlmReadinessEvalFixture;
}

describe("PA33 LLM readiness output source ref validation", () => {
  it("documents output source ref validation without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA33 LLM-Readiness Output SourceRef-Validation");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("keeps existing synthetic eval fixtures valid", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
        valid: true,
        errors: []
      });
    }
  });

  it("rejects fixtures whose expected output drops required source refs", () => {
    const fixture = cloneFixture(1);
    fixture.expectedOutput.sourceRefs = fixture.expectedOutput.sourceRefs.filter(
      (sourceRef) => sourceRef.objectType !== "purchase_list"
    );

    expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
      valid: false,
      errors: ["expectedOutput.sourceRefs must include purchase_list"]
    });
  });

  it("keeps input and output source ref contract errors separate", () => {
    const fixture = cloneFixture(1);
    fixture.input.sourceRefs = fixture.input.sourceRefs.filter(
      (sourceRef) => sourceRef.objectType !== "production_plan"
    );
    fixture.expectedOutput.sourceRefs = fixture.expectedOutput.sourceRefs.filter(
      (sourceRef) => sourceRef.objectType !== "purchase_list"
    );

    const result = validateLlmReadinessEvalFixture(fixture);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("input.sourceRefs must include production_plan");
    expect(result.errors).toContain("expectedOutput.sourceRefs must include purchase_list");
  });
});
