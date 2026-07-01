import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SyntheticLiveLlmReadinessSlice,
  findLlmReadinessPromptArtifactByInputKind,
  isLlmReadinessSyntheticLiveSliceEnabled,
  llmReadinessEvalFixtures,
  validateLlmReadinessPromptArtifacts,
  type LlmReadinessModelInput,
  type LlmReadinessSyntheticLiveTransport
} from "@catering/shared-core";

const docPath = "docs/architecture/PA42_SYNTHETIC_LIVE_LLM_SLICE.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneInput(index: number): LlmReadinessModelInput {
  return structuredClone(llmReadinessEvalFixtures[index].input) as LlmReadinessModelInput;
}

describe("PA42 synthetic live LLM slice", () => {
  it("documents the feature-flagged synthetic-only live provider corridor", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA42 Synthetic-Live LLM Slice");
    expect(doc).toContain("Feature-Flag");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Runtime-Schreibwirkung");
    expect(doc).toContain("keine echten Daten");
  });

  it("keeps prompt artifacts non-empty and aligned with the prompt-schema registry", () => {
    expect(validateLlmReadinessPromptArtifacts()).toEqual({
      valid: true,
      errors: []
    });

    const clarificationArtifact = findLlmReadinessPromptArtifactByInputKind("clarification_draft_request");
    const operatorArtifact = findLlmReadinessPromptArtifactByInputKind("operator_summary_request");
    const dossierArtifact = findLlmReadinessPromptArtifactByInputKind("production_dossier_draft_request");

    expect(clarificationArtifact?.status).toBe("synthetic_live_ready");
    expect(operatorArtifact?.status).toBe("providerless_contract_only");
    expect(dossierArtifact?.status).toBe("providerless_contract_only");
    expect(clarificationArtifact?.systemPrompt).toContain("JSON");
  });

  it("parses the synthetic live feature flag conservatively", () => {
    expect(isLlmReadinessSyntheticLiveSliceEnabled({ CATERING_SYNTHETIC_LLM_SLICE: "1" })).toBe(true);
    expect(isLlmReadinessSyntheticLiveSliceEnabled({ CATERING_SYNTHETIC_LLM_SLICE: "true" })).toBe(true);
    expect(isLlmReadinessSyntheticLiveSliceEnabled({ CATERING_SYNTHETIC_LLM_SLICE: "0" })).toBe(false);
    expect(isLlmReadinessSyntheticLiveSliceEnabled({})).toBe(false);
  });

  it("builds a valid synthetic-live clarification draft when the feature flag is enabled", async () => {
    const transport: LlmReadinessSyntheticLiveTransport = {
      run: async () => ({
        ok: true,
        errors: [],
        providerId: "fake-provider",
        providerRequestId: "req-1",
        text: "Bitte klaeren, fuer wie viele Personen die Kaffeepause geplant werden soll.",
        structuredCandidate: {
          reason: "missingFields",
          reasonCode: "attendees.expected"
        }
      })
    };

    const slice = new SyntheticLiveLlmReadinessSlice({
      enabled: true,
      transport
    });

    const response = await slice.run({
      providerRunId: "live-run-1",
      input: cloneInput(0)
    });

    expect(response).toEqual({
      ok: true,
      errors: [],
      adapterId: "llm-readiness-synthetic-live-slice",
      adapterMode: "synthetic_live",
      fixtureId: "llm-eval-synthetic-coffee-break-missing-attendees",
      promptSchemaId: "clarification-question-draft-prompt-schema.v0",
      providerId: "fake-provider",
      providerRequestId: "req-1",
      outputCandidate: {
        contractVersion: "llm-readiness-v0",
        outputId: "input-llm-eval-coffee-break-001-synthetic-live-output",
        kind: "clarification_question_draft",
        sourceRefs: cloneInput(0).sourceRefs,
        humanApprovalRequired: true,
        writesProductObject: false,
        text: "Bitte klaeren, fuer wie viele Personen die Kaffeepause geplant werden soll.",
        structuredCandidate: {
          reason: "missingFields",
          reasonCode: "attendees.expected"
        }
      }
    });
  });

  it("rejects live runs while the feature flag is disabled", async () => {
    const slice = new SyntheticLiveLlmReadinessSlice({
      enabled: false,
      transport: {
        run: async () => {
          throw new Error("transport should not run when disabled");
        }
      }
    });

    const response = await slice.run({
      providerRunId: "live-run-2",
      input: cloneInput(0)
    });

    expect(response.ok).toBe(false);
    expect(response.errors).toContain("synthetic live slice feature flag is disabled");
  });

  it("keeps operator summary out of the first live slice", async () => {
    const slice = new SyntheticLiveLlmReadinessSlice({
      enabled: true,
      transport: {
        run: async () => {
          throw new Error("transport should not run for blocked input kinds");
        }
      }
    });

    const response = await slice.run({
      providerRunId: "live-run-3",
      input: cloneInput(1)
    });

    expect(response.ok).toBe(false);
    expect(response.errors).toContain("input.kind is not enabled for the first synthetic live slice");
  });

  it("rejects live outputs whose source refs or structured candidate keys drift", async () => {
    const slice = new SyntheticLiveLlmReadinessSlice({
      enabled: true,
      transport: {
        run: async () => ({
          ok: true,
          errors: [],
          providerId: "fake-provider",
          text: "Bitte klaeren, fuer wie viele Personen die Kaffeepause geplant werden soll.",
          structuredCandidate: {
            reason: "missingFields"
          }
        })
      }
    });

    const response = await slice.run({
      providerRunId: "live-run-4",
      input: cloneInput(0)
    });

    expect(response.ok).toBe(false);
    expect(response.errors).toContain("outputCandidate.structuredCandidate keys must match the fixture contract");
  });
});
