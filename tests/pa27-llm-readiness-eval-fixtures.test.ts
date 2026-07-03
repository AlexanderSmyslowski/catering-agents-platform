import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  validateLlmReadinessModelOutputCandidate
} from "@catering/shared-core";

const docPath = "docs/architecture/PA27_LLM_READINESS_EVAL_FIXTURES.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

const forbiddenPayloadKeys = [
  "rawText",
  "extractedText",
  "prompt",
  "messages",
  "providerResponse",
  "toolCalls",
  "secret",
  "apiKey"
];

describe("PA27 LLM readiness eval fixtures", () => {
  it("documents synthetic eval fixtures without provider runtime", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA27 LLM-Readiness Eval-Fixtures");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine echten Daten");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("provides the first clarification and operator-summary eval cases", () => {
    expect(llmReadinessEvalFixtures.map((fixture) => fixture.fixtureId)).toEqual([
      "llm-eval-synthetic-coffee-break-missing-attendees",
      "llm-eval-synthetic-buffet-operator-summary",
      "llm-eval-synthetic-flying-buffet-production-draft",
      "llm-eval-synthetic-intake-shadow-lunch"
    ]);

    expect(llmReadinessEvalFixtures.map((fixture) => fixture.expectedOutput.kind)).toEqual([
      "clarification_question_draft",
      "operator_summary_draft",
      "production_draft_extraction",
      "intake_shadow_extraction"
    ]);
  });

  it("keeps every fixture synthetic or demo only and disables provider calls", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(fixture.fixtureId).toContain("synthetic");
      expect(fixture.input.policy.providerCalls).toBe("disabled");
      expect(fixture.input.policy.dataMode).toBe("synthetic_or_demo_only");
      expect(JSON.stringify(fixture)).toContain("synthetic");
      expect(JSON.stringify(fixture)).not.toMatch(/kunde|customer|email|phone|telefon|@/i);
    }
  });

  it("keeps expected outputs valid under the PA26 readiness contract", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(validateLlmReadinessModelOutputCandidate(fixture.expectedOutput)).toEqual({
        valid: true,
        errors: []
      });
      expect(fixture.expectedOutput.humanApprovalRequired).toBe(true);
      expect(fixture.expectedOutput.writesProductObject).toBe(false);
    }
  });

  it("does not carry raw prompts provider responses secrets or tool calls", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      for (const forbiddenKey of forbiddenPayloadKeys) {
        expect(fixture.disallowedPayloadKeys).toContain(forbiddenKey);
        expect(Object.prototype.hasOwnProperty.call(fixture.input, forbiddenKey)).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(fixture.expectedOutput, forbiddenKey)).toBe(false);
      }
    }
  });
});
