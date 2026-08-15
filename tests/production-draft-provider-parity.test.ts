import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LlmReadinessModelOutputCandidate } from "../shared-core/src/llm-readiness.js";
import { assessProductionDraftReference } from "../shared-core/src/production-reference-quality.js";

type ProductionReferenceExpectation = {
  caseId: string;
  sourceSha256: string;
  requiredComponentLabels: string[];
  allowedOpenQuestionFields: string[];
  forbiddenComponentLabels: string[];
};

const expectation = JSON.parse(readFileSync(
  path.join(process.cwd(), "tests/fixtures/production-reference-cases/koepff-flying-buffet-45p.expected.json"),
  "utf8"
)) as ProductionReferenceExpectation;

function candidate(labels: string[]): LlmReadinessModelOutputCandidate {
  return {
    contractVersion: "llm-readiness-v0",
    outputId: "output-reference-test",
    kind: "production_draft_extraction",
    sourceRefs: [{ objectType: "safe_source_anchor", objectId: expectation.sourceSha256 }],
    humanApprovalRequired: true,
    writesProductObject: false,
    text: JSON.stringify({
      components: labels.map((label) => ({ label })),
      openQuestions: []
    })
  };
}

describe("production draft provider parity", () => {
  it.each(["openai", "codex_cli"])("assesses %s with the same deterministic contract", (provider) => {
    const result = assessProductionDraftReference(expectation, candidate(expectation.requiredComponentLabels));

    expect(provider).toMatch(/openai|codex_cli/);
    expect(result).toMatchObject({
      passed: true,
      missingComponentLabels: [],
      duplicateComponentLabels: [],
      forbiddenComponentLabels: []
    });
  });

  it("names every omitted or duplicate position", () => {
    const duplicateDessert = expectation.requiredComponentLabels.at(-1)!;
    const missingVitello = expectation.requiredComponentLabels.find((label) => /vitello/i.test(label))!;
    const result = assessProductionDraftReference(
      expectation,
      candidate(expectation.requiredComponentLabels.filter((label) => label !== missingVitello).concat(duplicateDessert))
    );

    expect(result.passed).toBe(false);
    expect(result.missingComponentLabels).toEqual([missingVitello]);
    expect(result.duplicateComponentLabels).toEqual([duplicateDessert]);
  });

  it.each([
    ["forbidden service item", ["Weingläser"]],
    ["unknown open question field", expectation.requiredComponentLabels]
  ])("fails closed for %s", (_name, labels) => {
    const output = candidate(labels);
    if (_name === "unknown open question field") {
      output.text = JSON.stringify({
        components: labels.map((label) => ({ label })),
        openQuestions: [{ field: "unapproved.field", message: "Operator review required" }]
      });
    }

    const result = assessProductionDraftReference(expectation, output);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
