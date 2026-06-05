import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  runLlmReadinessSyntheticLiveProbe,
  type LlmReadinessSyntheticLiveTransport
} from "@catering/shared-core";
import {
  parseSyntheticLiveProbeCliArgs,
  shouldFailSyntheticLiveProbeProcess
} from "../scripts/run-synthetic-live-llm-readiness.js";

const docPath = "docs/architecture/PA46_SYNTHETIC_LIVE_PROBE_FAIL_ON_EVAL_MISMATCH.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

describe("PA46 synthetic-live probe fail on eval mismatch", () => {
  it("documents the optional hard-fail CLI mode", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA46 Synthetic-Live Probe Fail-on-Eval-Mismatch");
    expect(doc).toContain("--fail-on-eval-mismatch");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("parses the mismatch flag conservatively", () => {
    expect(parseSyntheticLiveProbeCliArgs([])).toEqual({
      failOnEvalMismatch: false
    });

    expect(
      parseSyntheticLiveProbeCliArgs([
        "--fixture-id=test-fixture",
        "--provider-run-id=run-1",
        "--fail-on-eval-mismatch"
      ])
    ).toEqual({
      fixtureId: "test-fixture",
      providerRunId: "run-1",
      failOnEvalMismatch: true
    });
  });

  it("marks drifted probe results as eval mismatches without changing the base run status", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => ({
        ok: true,
        errors: [],
        providerId: "openai-responses",
        providerRequestId: "resp-probe-drift-2",
        text: "Bitte klaeren, fuer wie viele Gaeste die Kaffeepause geplant werden soll.",
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
    expect(result.evalMatched).toBe(false);
    expect(result.fixtureId).toBe(llmReadinessEvalFixtures[0].fixtureId);
    expect(
      shouldFailSyntheticLiveProbeProcess(result, { failOnEvalMismatch: false })
    ).toBe(false);
    expect(
      shouldFailSyntheticLiveProbeProcess(result, { failOnEvalMismatch: true })
    ).toBe(true);
  });

  it("still fails hard for non-ok probe runs regardless of the eval flag", () => {
    expect(
      shouldFailSyntheticLiveProbeProcess(
        { ok: false, evalMatched: undefined },
        { failOnEvalMismatch: false }
      )
    ).toBe(true);
  });
});
