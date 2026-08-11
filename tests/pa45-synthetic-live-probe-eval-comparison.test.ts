import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateLlmReadinessEvalOutputCandidateMatch,
  llmReadinessEvalFixtures,
  type LlmReadinessSyntheticLiveTransport
} from "@catering/shared-core";
import { runLlmReadinessSyntheticLiveProbe } from "../shared-core/src/llm-readiness-synthetic-live-probe.js";

const docPath = "docs/architecture/PA45_SYNTHETIC_LIVE_PROBE_EVAL_COMPARISON.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

describe("PA45 synthetic-live probe eval comparison", () => {
  it("documents the eval comparison layer above the probe runner", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA45 Synthetic-Live Probe Eval Comparison");
    expect(doc).toContain("keine neue Runtime");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("returns detailed pass-state checks for a matching expected output", () => {
    const fixture = llmReadinessEvalFixtures[0];
    const result = evaluateLlmReadinessEvalOutputCandidateMatch(
      fixture,
      structuredClone(fixture.expectedOutput)
    );

    expect(result).toEqual({
      valid: true,
      errors: [],
      checks: {
        outputKindMatches: true,
        humanApprovalMatches: true,
        writesProductObjectMatches: true,
        sourceRefsMatch: true,
        textMatches: true,
        structuredCandidateMatches: true
      }
    });
  });

  it("surfaces eval mismatches through the probe result when text drifts", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => ({
        ok: true,
        errors: [],
        providerId: "openai-responses",
        providerRequestId: "resp-probe-drift-1",
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
    expect(result.evaluation).toMatchObject({
      valid: false,
      errors: ["candidate.text must match fixture expectedOutput.text"],
      checks: {
        outputKindMatches: true,
        humanApprovalMatches: true,
        writesProductObjectMatches: true,
        sourceRefsMatch: true,
        textMatches: false,
        structuredCandidateMatches: true
      }
    });
    expect(result.runResult?.status).toBe("completed");
  });
});
