import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  type LlmReadinessSyntheticLiveTransport
} from "@catering/shared-core";
import { runLlmReadinessSyntheticLiveProbe } from "../shared-core/src/llm-readiness-synthetic-live-probe.js";

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
        text: "Bitte klaeren, fuer wie viele Personen die Kaffeepause geplant werden soll.",
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

  it("marks a rejected provider response as a failed probe", async () => {
    const result = await runLlmReadinessSyntheticLiveProbe({
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      transport: {
        run: async () => ({
          ok: false,
          errors: ["provider returned a bounded failure"],
          providerId: "openai-responses"
        })
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["provider returned a bounded failure"]);
    expect(result.runResult?.status).toBe("rejected");
  });

  it("rejects a caller-supplied non-synthetic fixture before transport execution", async () => {
    let calls = 0;
    const originalFixture = structuredClone(llmReadinessEvalFixtures[0]);
    const fixture = {
      ...originalFixture,
      input: {
        ...originalFixture.input,
        policy: {
          ...originalFixture.input.policy,
          dataMode: "pseudonymized_approved" as const
        }
      }
    };
    const result = await runLlmReadinessSyntheticLiveProbe({
      fixtures: [fixture],
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      transport: {
        run: async () => {
          calls += 1;
          throw new Error("transport must not run");
        }
      }
    });

    expect(result).toMatchObject({
      ok: false,
      errors: ["synthetic-live probe accepts only synthetic_demo fixtures"]
    });
    expect(calls).toBe(0);
  });

  it("requires the server-side external approval before the default OpenAI transport is created", async () => {
    const result = await runLlmReadinessSyntheticLiveProbe({
      env: {
        CATERING_SYNTHETIC_LLM_SLICE: "1",
        OPENAI_API_KEY: "test-only-not-used",
        CATERING_SYNTHETIC_LLM_MODEL: "gpt-test",
        CATERING_LLM_BUSINESS_ID: "local",
        CATERING_LLM_PROCESSING_REGION: "eu",
        CATERING_LLM_MAX_ESTIMATED_COST_EUR: "0.12",
        CATERING_LLM_RETENTION_POLICY: "zero-retention",
        CATERING_LLM_TRAINING_USE: "contractually_excluded"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("external provider calls require a matching processing approval");
    expect(JSON.stringify(result)).not.toContain("test-only-not-used");
  });

  it("does not forward caller-supplied fixture identity text to the fake transport", async () => {
    const fixture = structuredClone(llmReadinessEvalFixtures[0]);
    fixture.title = "Kundin Max Mustermann, Musterstrasse 7";
    fixture.input.sourceRefs = [{
      ...fixture.input.sourceRefs[0],
      objectId: "Max Mustermann / Musterstrasse 7",
      label: "Kundin Max Mustermann"
    }];
    fixture.expectedOutput.sourceRefs = [{
      ...fixture.expectedOutput.sourceRefs[0],
      objectId: "Max Mustermann / Musterstrasse 7",
      label: "Kundin Max Mustermann"
    }];
    let userPrompt = "";
    const result = await runLlmReadinessSyntheticLiveProbe({
      fixtures: [fixture],
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      transport: {
        run: async (request) => {
          userPrompt = request.userPrompt;
          return {
            ok: true,
            errors: [],
            providerId: "fixture-transport",
            text: fixture.expectedOutput.text,
            structuredCandidate: fixture.expectedOutput.structuredCandidate
          };
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(userPrompt).not.toContain("Max Mustermann");
    expect(userPrompt).not.toContain("Musterstrasse 7");
    expect(userPrompt).toContain("synthetic-source-1");
  });
});
