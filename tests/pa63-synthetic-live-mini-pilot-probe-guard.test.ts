import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LlmReadinessSyntheticLiveTransport } from "@catering/shared-core";
import {
  parseSyntheticLiveProbeCliArgs,
  runSyntheticLiveProbeCli
} from "../scripts/run-synthetic-live-llm-readiness.js";

const docPath = "docs/architecture/PA63_SYNTHETIC_LIVE_MINI_PILOT_PROBE_GUARD.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA63 synthetic-live mini-pilot probe guard", () => {
  it("documents the guard without widening runtime scope", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA63 Synthetic-Live Mini-Pilot Probe Guard");
    expect(doc).toContain("keine neue Provider-Runtime");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("parses the mini-pilot guard flag", () => {
    expect(
      parseSyntheticLiveProbeCliArgs([
        "--fail-on-eval-mismatch",
        "--require-mini-pilot-ready"
      ])
    ).toEqual({
      failOnEvalMismatch: true,
      requireMiniPilotReady: true
    });
  });

  it("keeps the dedicated mini-pilot script discoverable", () => {
    expect(packageJson.scripts["llm:synthetic-live:probe:mini-pilot"]).toBe(
      "tsx scripts/run-synthetic-live-llm-readiness.ts --fail-on-eval-mismatch --require-mini-pilot-ready"
    );
  });

  it("blocks the probe when the mini-pilot policy is not fully present", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => {
        throw new Error("transport should not run when mini-pilot policy is incomplete");
      }
    };

    const result = await runSyntheticLiveProbeCli(
      {
        failOnEvalMismatch: true,
        requireMiniPilotReady: true
      },
      {
        env: {
          CATERING_SYNTHETIC_LLM_SLICE: "1",
          OPENAI_API_KEY: "sk-test",
          CATERING_SYNTHETIC_LLM_MODEL: "gpt-test",
          CATERING_SYNTHETIC_LLM_OPERATOR_NAME: "Alexander",
          CATERING_SYNTHETIC_LLM_BUDGET_NOTE: "pilot-budget"
        },
        transport
      }
    );

    expect(result.ok).toBe(false);
    expect(result.preflight?.ok).toBe(true);
    expect(result.preflight?.miniPilotReady).toBe(false);
    expect(result.errors).toContain("mini-pilot policy is not fully marked as ready");
    expect(result.errors).toContain(
      "miniPilot.CATERING_SYNTHETIC_LLM_MINI_PILOT should be set for the approved mini-pilot corridor"
    );
    expect(result.response).toBeUndefined();
  });

  it("allows the probe when the approved mini-pilot frame is fully marked", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => ({
        ok: true,
        errors: [],
        providerId: "openai-responses",
        providerRequestId: "resp-mini-pilot-1",
        text: "Bitte klären, ob die Kaffeepause am Vormittag oder am Nachmittag stattfinden soll.",
        structuredCandidate: {
          reason: "missingFields",
          reasonCode: "coffeeBreak.timeWindow"
        }
      })
    };

    const result = await runSyntheticLiveProbeCli(
      {
        failOnEvalMismatch: false,
        requireMiniPilotReady: true
      },
      {
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
      }
    );

    expect(result.ok).toBe(true);
    expect(result.preflight?.miniPilotReady).toBe(true);
    expect(result.response?.ok).toBe(true);
    expect(result.auditRecord?.providerId).toBe("openai-responses");
  });

  it("keeps the guard discoverable from repo docs", () => {
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa63-synthetic-live-mini-pilot-probe-guard.test.ts");
    expect(memory).toContain(docPath);
  });
});
