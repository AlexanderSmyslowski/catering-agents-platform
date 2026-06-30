import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LlmReadinessSyntheticLiveTransport } from "@catering/shared-core";
import { runSyntheticLiveMiniPilotCheckCli } from "../scripts/check-synthetic-live-mini-pilot.js";

const docPath = "docs/architecture/PA64_SYNTHETIC_LIVE_MINI_PILOT_CHECK_ENTRY.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA64 synthetic-live mini-pilot check entry", () => {
  it("documents the bundled mini-pilot check without widening runtime scope", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA64 Synthetic-Live Mini-Pilot Check Entry");
    expect(doc).toContain("keinen neuen Providerpfad");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("keeps the dedicated mini-pilot check script discoverable", () => {
    expect(packageJson.scripts["llm:synthetic-live:check:mini-pilot"]).toBe(
      "tsx scripts/check-synthetic-live-mini-pilot.ts"
    );
    expect(existsSync("scripts/check-synthetic-live-mini-pilot.ts")).toBe(true);
  });

  it("returns a failing combined result when the mini-pilot policy is incomplete", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => {
        throw new Error("transport should not run when mini-pilot check is blocked");
      }
    };

    const result = await runSyntheticLiveMiniPilotCheckCli([], {
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: "sk-test",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test",
        CATERING_SYNTHETIC_LLM_OPERATOR_NAME: "Alexander",
        CATERING_SYNTHETIC_LLM_BUDGET_NOTE: "pilot-budget"
      },
      transport
    });

    expect(result.ok).toBe(false);
    expect(result.preflight.ok).toBe(true);
    expect(result.preflight.miniPilotReady).toBe(false);
    expect(result.probe?.ok).toBe(false);
    expect(result.errors).toContain("mini-pilot policy is not fully marked as ready");
  });

  it("returns a passing combined result when the mini-pilot frame and output are valid", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => ({
        ok: true,
        errors: [],
        providerId: "openai-responses",
        providerRequestId: "resp-mini-pilot-check-1",
        text: "Bitte klären, für wie viele Personen die Kaffeepause geplant werden soll.",
        structuredCandidate: {
          reason: "missingFields",
          reasonCode: "attendees.expected"
        }
      })
    };

    const result = await runSyntheticLiveMiniPilotCheckCli([], {
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
      },
      transport
    });

    expect(result.ok).toBe(true);
    expect(result.preflight.miniPilotReady).toBe(true);
    expect(result.probe?.ok).toBe(true);
    expect(result.probe?.evalMatched).toBe(true);
  });

  it("keeps the entry discoverable from repo docs", () => {
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa64-synthetic-live-mini-pilot-check-entry.test.ts");
    expect(memory).toContain(docPath);
  });
});
