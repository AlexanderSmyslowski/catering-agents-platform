import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  runLlmReadinessSyntheticLiveProbe,
  type LlmReadinessSyntheticLiveTransport
} from "@catering/shared-core";

const docPath = "docs/architecture/PA44_SYNTHETIC_LIVE_PROBE_RUNNER.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("PA44 synthetic-live probe runner", () => {
  it("documents a local probe runner without widening the product corridor", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA44 Synthetic-Live Probe Runner");
    expect(doc).toContain("keine UI");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Runtime-Conversation");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("keeps the probe script discoverable from package.json", () => {
    expect(packageJson.scripts["llm:synthetic-live:probe"]).toBe(
      "tsx scripts/run-synthetic-live-llm-readiness.ts"
    );
    expect(existsSync("scripts/run-synthetic-live-llm-readiness.ts")).toBe(true);
  });

  it("runs the full synthetic-live probe corridor with a fake transport", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => ({
        ok: true,
        errors: [],
        providerId: "openai-responses",
        providerRequestId: "resp-probe-1",
        text: "Bitte klären, für wie viele Personen die Kaffeepause geplant werden soll.",
        structuredCandidate: {
          reason: "missingFields",
          reasonCode: "attendees.expected"
        }
      })
    };

    const result = await runLlmReadinessSyntheticLiveProbe({
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1"
      },
      transport
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.fixtureId).toBe(llmReadinessEvalFixtures[0].fixtureId);
    expect(result.providerRunId).toBe(
      `synthetic-live-probe-${llmReadinessEvalFixtures[0].fixtureId}`
    );
    expect(result.auditRecord?.status).toBe("matched_provider");
    expect(result.runResult?.status).toBe("completed");
    expect(result.runResult?.providerId).toBe("openai-responses");
    expect(result.runResult?.providerRequestId).toBe("resp-probe-1");
  });

  it("fails cleanly when a non-clarification fixture is requested", async () => {
    const result = await runLlmReadinessSyntheticLiveProbe({
      fixtureId: llmReadinessEvalFixtures[1].fixtureId,
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1"
      },
      transport: {
        run: async () => {
          throw new Error("transport should not run");
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["fixtureId must match a synthetic clarification fixture"]);
  });
});
