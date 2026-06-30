import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LlmReadinessSyntheticLiveTransport } from "@catering/shared-core";
import { runSyntheticLiveMiniPilotCheckCli } from "../scripts/check-synthetic-live-mini-pilot.js";

const docPath = "docs/architecture/PA65_SYNTHETIC_LIVE_MINI_PILOT_SUMMARY_SIGNAL.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const testing = readFileSync("TESTING.md", "utf8");
const memory = readFileSync("memory.md", "utf8");

describe("PA65 synthetic-live mini-pilot summary signal", () => {
  it("documents the summary signal without widening runtime scope", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA65 Synthetic-Live Mini-Pilot Summary Signal");
    expect(doc).toContain("keinen neuen Providerpfad");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("kein Deployment");
    expect(doc).toContain("keine Produktschreibwirkung");
  });

  it("marks missing policy frames as blocked with a concrete next step", async () => {
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

    expect(result.summary.status).toBe("blocked");
    expect(result.summary.reason).toBe("mini_pilot_policy_incomplete");
    expect(result.summary.nextStep).toContain("PA62");
  });

  it("marks successful runs as ready with a human-review next step", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => ({
        ok: true,
        errors: [],
        providerId: "openai-responses",
        providerRequestId: "resp-mini-pilot-summary-1",
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

    expect(result.summary.status).toBe("ready");
    expect(result.summary.reason).toBe("mini_pilot_ready");
    expect(result.summary.nextStep).toContain("manuell prüfen");
  });

  it("keeps the summary signal discoverable from repo docs", () => {
    expect(testing).toContain(docPath);
    expect(testing).toContain("tests/pa65-synthetic-live-mini-pilot-summary-signal.test.ts");
    expect(memory).toContain(docPath);
  });
});
