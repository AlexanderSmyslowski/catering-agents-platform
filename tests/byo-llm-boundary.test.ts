import { describe, expect, it, vi } from "vitest";
import {
  allowedByoLlmDraftUseCaseByType,
  byoLlmBoundaryPolicy,
  byoLlmProviderBoundaryByKind,
  isByoLlmProviderOptInEnabled,
  llmReadinessEvalFixtures,
  validateByoLlmProviderRunBoundary,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate
} from "@catering/shared-core";
import { OpenAiSyntheticLiveTransport } from "../shared-core/src/llm-readiness-openai-transport.js";

function cloneSyntheticInput(): LlmReadinessModelInput {
  return structuredClone(llmReadinessEvalFixtures[0].input) as LlmReadinessModelInput;
}

function cloneSyntheticOutput(): LlmReadinessModelOutputCandidate {
  return structuredClone(llmReadinessEvalFixtures[0].expectedOutput) as LlmReadinessModelOutputCandidate;
}

describe("BYO LLM boundary", () => {
  it("keeps provider calls disabled by default and requires explicit opt-in", () => {
    expect(byoLlmBoundaryPolicy.providerCallsDefault).toBe("disabled");
    expect(byoLlmBoundaryPolicy.providerCallsRequireExplicitOptIn).toBe(true);
    expect(isByoLlmProviderOptInEnabled({})).toBe(false);
    expect(isByoLlmProviderOptInEnabled({ CATERING_SYNTHETIC_LLM_SLICE: "0" })).toBe(false);
    expect(isByoLlmProviderOptInEnabled({ CATERING_SYNTHETIC_LLM_SLICE: "1" })).toBe(true);

    const result = validateByoLlmProviderRunBoundary({
      providerKind: "openai",
      input: cloneSyntheticInput()
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("provider calls require explicit synthetic-live opt-in");
  });

  it("rejects unsafe real-customer-data inputs before provider execution", () => {
    const input = cloneSyntheticInput() as unknown as Record<string, unknown>;
    input.policy = {
      providerCalls: "enabled",
      dataMode: "real_customer_data",
      allowedToolEffects: ["read", "draft"]
    };
    input.rawText = "real customer catering request";

    const result = validateByoLlmProviderRunBoundary({
      providerKind: "openai",
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      input: input as unknown as LlmReadinessModelInput
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("input.policy.providerCalls must be disabled");
    expect(result.errors).toContain("input.policy.dataMode must be synthetic_or_demo_only or pseudonymized_approved");
    expect(result.errors).toContain("input.rawText is not allowed in readiness input candidates");
  });

  it("accepts synthetic demo draft input only under explicit provider opt-in", () => {
    const blocked = validateByoLlmProviderRunBoundary({
      providerKind: "openai",
      env: {},
      input: cloneSyntheticInput(),
      outputCandidate: cloneSyntheticOutput()
    });
    expect(blocked.valid).toBe(false);
    expect(blocked.errors).toContain("provider calls require explicit synthetic-live opt-in");

    const allowed = validateByoLlmProviderRunBoundary({
      providerKind: "openai",
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      input: cloneSyntheticInput(),
      outputCandidate: cloneSyntheticOutput()
    });
    expect(allowed).toEqual({ valid: true, errors: [] });
  });

  it("keeps all allowed draft use cases human-approved and non-writing", () => {
    expect(byoLlmBoundaryPolicy.allowedDraftUseCases.map((useCase) => useCase.draftType)).toEqual([
      "clarification_question_draft",
      "production_draft_extraction",
      "intake_shadow_extraction",
      "offer_package_classification_draft",
      "recipe_research_summary_draft",
      "search_query_suggestion_draft",
      "uncertainty_summary_draft"
    ]);

    for (const useCase of byoLlmBoundaryPolicy.allowedDraftUseCases) {
      expect(useCase.providerCallsDefault).toBe("disabled");
      expect(useCase.externalCallsByDefault).toBe(false);
      expect(useCase.humanApprovalRequired).toBe(true);
      expect(useCase.writesProductObject).toBe(false);
    }

    expect(allowedByoLlmDraftUseCaseByType("clarification_question_draft")).toMatchObject({
      status: "implemented_readiness_contract"
    });
    expect(allowedByoLlmDraftUseCaseByType("production_draft_extraction")).toMatchObject({
      status: "implemented_readiness_contract"
    });
    expect(allowedByoLlmDraftUseCaseByType("intake_shadow_extraction")).toMatchObject({
      status: "implemented_readiness_contract"
    });
    expect(allowedByoLlmDraftUseCaseByType("offer_package_classification_draft")).toMatchObject({
      status: "implemented_readiness_contract"
    });
    expect(allowedByoLlmDraftUseCaseByType("recipe_research_summary_draft")).toMatchObject({
      status: "future_allowed_shape"
    });
  });

  it("rejects generated output that could write product objects or bypass human approval", () => {
    const output = cloneSyntheticOutput() as unknown as Record<string, unknown>;
    output.humanApprovalRequired = false;
    output.writesProductObject = true;

    const result = validateByoLlmProviderRunBoundary({
      providerKind: "openai",
      env: { CATERING_SYNTHETIC_LLM_SLICE: "1" },
      input: cloneSyntheticInput(),
      outputCandidate: output as unknown as LlmReadinessModelOutputCandidate
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("outputCandidate.humanApprovalRequired must be true");
    expect(result.errors).toContain("outputCandidate.writesProductObject must be false");
  });

  it("keeps OpenAI as one transport behind the provider boundary without real calls in this test", async () => {
    const boundary = byoLlmProviderBoundaryByKind("openai");
    expect(boundary).toMatchObject({
      providerKind: "openai",
      adapterId: "openai-responses",
      status: "synthetic_live_transport",
      explicitOptInRequired: true,
      realCustomerDataAllowed: false,
      writeEffectsAllowed: false
    });

    const fetchMock = vi.fn();
    const transport = new OpenAiSyntheticLiveTransport({
      apiKey: "sk-test",
      model: "gpt-test",
      fetchImpl: fetchMock as typeof fetch
    });

    const response = await transport.run({
      providerRunId: "byo-boundary-test",
      fixtureId: "fixture",
      promptSchemaId: "schema",
      promptArtifactId: "artifact",
      promptVersion: "v0",
      outputKind: "operator_summary_draft",
      systemPrompt: "JSON only",
      userPrompt: "No network should happen."
    });

    expect(response.ok).toBe(false);
    expect(response.errors).toContain(
      "OpenAI synthetic live transport only supports clarification_question_draft, production_draft_extraction, intake_shadow_extraction and offer_package_classification_draft"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
