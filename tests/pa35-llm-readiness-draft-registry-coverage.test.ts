import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessDraftContracts,
  llmReadinessEvalFixtures,
  validateLlmReadinessEvalFixtureCoverage,
  type LlmReadinessEvalFixture
} from "@catering/shared-core";

const docPath = "docs/architecture/PA35_LLM_READINESS_DRAFT_REGISTRY_COVERAGE.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneFixtures(): LlmReadinessEvalFixture[] {
  return structuredClone(llmReadinessEvalFixtures) as unknown as LlmReadinessEvalFixture[];
}

describe("PA35 LLM readiness draft registry coverage", () => {
  it("documents draft registry coverage without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA35 LLM-Readiness Draft-Registry-Coverage");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("keeps every current draft contract covered by at least one valid synthetic eval fixture", () => {
    expect(llmReadinessDraftContracts.map((contract) => contract.contractId)).toEqual([
      "clarification-question-draft.v0",
      "operator-summary-draft.v0",
      "production-draft-extraction.v0",
      "intake-shadow-extraction.v0",
      "offer-package-classification.v0"
    ]);

    expect(validateLlmReadinessEvalFixtureCoverage()).toEqual({
      valid: true,
      errors: []
    });
  });

  it("rejects missing coverage for a registered draft contract", () => {
    const fixtures = cloneFixtures().filter((fixture) => fixture.input.kind === "clarification_draft_request");

    expect(validateLlmReadinessEvalFixtureCoverage(fixtures)).toEqual({
      valid: false,
      errors: [
        "draft contract operator-summary-draft.v0 must have a valid synthetic eval fixture",
        "draft contract production-draft-extraction.v0 must have a valid synthetic eval fixture",
        "draft contract intake-shadow-extraction.v0 must have a valid synthetic eval fixture",
        "draft contract offer-package-classification.v0 must have a valid synthetic eval fixture"
      ]
    });
  });

  it("does not count invalid fixtures as contract coverage", () => {
    const fixtures = cloneFixtures();
    fixtures[1].expectedOutput.kind = "clarification_question_draft";

    expect(validateLlmReadinessEvalFixtureCoverage(fixtures)).toEqual({
      valid: false,
      errors: [
        "llm-eval-synthetic-buffet-operator-summary must be a valid readiness eval fixture",
        "draft contract operator-summary-draft.v0 must have a valid synthetic eval fixture"
      ]
    });
  });

  it("rejects non-array fixture collections", () => {
    expect(validateLlmReadinessEvalFixtureCoverage({})).toEqual({
      valid: false,
      errors: ["fixtures must be an array"]
    });
  });
});
