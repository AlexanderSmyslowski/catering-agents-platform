import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runLlmReadinessSyntheticLivePreflight } from "@catering/shared-core";

const docPath = "docs/architecture/PA62_SYNTHETIC_LIVE_MINI_PILOT_POLICY.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA62 synthetic-live mini-pilot policy", () => {
  it("documents the mini-pilot policy without widening runtime scope", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA62 Synthetic-Live Mini-Pilot Policy");
    expect(doc).toContain("keine neue Provider-Runtime");
    expect(doc).toContain("keine neuen APIs");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("Produktschreibwirkung");
  });

  it("shows the mini-pilot as not ready when the extra pilot boundary is not explicitly marked", () => {
    const result = runLlmReadinessSyntheticLivePreflight({
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: "sk-test",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test",
        CATERING_SYNTHETIC_LLM_OPERATOR_NAME: "Alexander",
        CATERING_SYNTHETIC_LLM_BUDGET_NOTE: "pilot-budget"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.policyReady).toBe(true);
    expect(result.miniPilotReady).toBe(false);
    expect(result.writeEffectsAllowed).toBe(false);
    expect(result.pilotScope).toBe("internal_named_users_draft_only");
    expect(result.preferredMiniPilotCommand).toBe("npm run llm:synthetic-live:check");
    expect(result.miniPilotWarnings).toEqual([
      "CATERING_SYNTHETIC_LLM_MINI_PILOT should be set for the approved mini-pilot corridor",
      "CATERING_SYNTHETIC_LLM_OPERATOR_SCOPE should stay named_internal_operators",
      "CATERING_SYNTHETIC_LLM_DATA_SCOPE should stay synthetic_demo_or_approved_internal",
      "CATERING_SYNTHETIC_LLM_OUTPUT_SCOPE should stay draft_only",
      "CATERING_SYNTHETIC_LLM_HUMAN_APPROVAL should stay required"
    ]);
  });

  it("marks the preflight as mini-pilot-ready when the approved narrow pilot frame is fully present", () => {
    const result = runLlmReadinessSyntheticLivePreflight({
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: "sk-test",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test",
        CATERING_SYNTHETIC_LLM_OPERATOR_NAME: "Alexander",
        CATERING_SYNTHETIC_LLM_BUDGET_NOTE: "pilot-budget",
        CATERING_SYNTHETIC_LLM_MINI_PILOT: "1",
        CATERING_SYNTHETIC_LLM_OPERATOR_SCOPE: "named_internal_operators",
        CATERING_SYNTHETIC_LLM_DATA_SCOPE: "synthetic_demo_or_approved_internal",
        CATERING_SYNTHETIC_LLM_OUTPUT_SCOPE: "draft_only",
        CATERING_SYNTHETIC_LLM_HUMAN_APPROVAL: "required"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.policyReady).toBe(true);
    expect(result.miniPilotReady).toBe(true);
    expect(result.miniPilotEnabled).toBe(true);
    expect(result.namedOperatorScopeConfirmed).toBe(true);
    expect(result.approvedDataScopeConfirmed).toBe(true);
    expect(result.draftOnlyConfirmed).toBe(true);
    expect(result.humanApprovalConfirmed).toBe(true);
    expect(result.writeEffectsAllowed).toBe(false);
    expect(result.miniPilotWarnings).toEqual([]);
  });

  it("keeps the mini-pilot policy discoverable from repo docs", () => {
    expect(readme).toContain(docPath);
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa62-synthetic-live-mini-pilot-policy.test.ts");
    expect(memory).toContain(docPath);
  });
});
