import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runLlmReadinessSyntheticLivePreflight } from "@catering/shared-core";

const docPath = "docs/architecture/PA53_SYNTHETIC_LIVE_PREFLIGHT_POLICY_HINTS.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA53 synthetic-live preflight policy hints", () => {
  it("documents the preflight policy hint slice without widening scope", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA53 Synthetic-Live Preflight Policy Hints");
    expect(doc).toContain("kein neuer");
    expect(doc).toContain("Providerpfad");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine neuen APIs");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine echten");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("reports missing optional local policy hints as warnings but not hard errors", () => {
    const result = runLlmReadinessSyntheticLivePreflight({
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: "sk-test",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.policyReady).toBe(false);
    expect(result.operatorNamePresent).toBe(false);
    expect(result.budgetNotePresent).toBe(false);
    expect(result.humanApprovalRequired).toBe(true);
    expect(result.rawPromptResponseLoggingAllowed).toBe(false);
    expect(result.preferredEvidenceCommand).toBe("npm run llm:synthetic-live:check");
    expect(result.warnings).toEqual([
      "CATERING_SYNTHETIC_LLM_OPERATOR_NAME should be set for named internal operator runs",
      "CATERING_SYNTHETIC_LLM_BUDGET_NOTE should be set to a local test or monthly budget note"
    ]);
    expect(result.errors).toEqual([]);
  });

  it("marks the preflight as policy-ready when optional local operator hints are present", () => {
    const result = runLlmReadinessSyntheticLivePreflight({
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: "sk-test",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test",
        CATERING_SYNTHETIC_LLM_OPERATOR_NAME: "Alexander",
        CATERING_SYNTHETIC_LLM_BUDGET_NOTE: "local-test-budget"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.policyReady).toBe(true);
    expect(result.operatorNamePresent).toBe(true);
    expect(result.budgetNotePresent).toBe(true);
    expect(result.operatorName).toBe("Alexander");
    expect(result.budgetNote).toBe("local-test-budget");
    expect(result.warnings).toEqual([]);
  });

  it("keeps the new policy-hint layer discoverable from repo docs", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa53-synthetic-live-preflight-policy-hints.test.ts");
    expect(memory).toContain(docPath);
  });
});
