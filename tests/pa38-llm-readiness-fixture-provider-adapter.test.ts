import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FixtureOnlyLlmReadinessProviderAdapter,
  findLlmReadinessPromptSchemaEntryByInputKind,
  llmReadinessEvalFixtures,
  type LlmReadinessModelInput
} from "@catering/shared-core";

const docPath = "docs/architecture/PA38_LLM_READINESS_FIXTURE_PROVIDER_ADAPTER.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneInput(index: number): LlmReadinessModelInput {
  return structuredClone(llmReadinessEvalFixtures[index].input) as LlmReadinessModelInput;
}

describe("PA38 LLM readiness fixture provider adapter", () => {
  it("documents a fixture-only provider adapter without provider runtime", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA38 LLM-Readiness Fixture-ProviderAdapter");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("resolves each current synthetic fixture input through the fixture-only adapter", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();

    for (const [index, fixture] of llmReadinessEvalFixtures.entries()) {
      const promptSchemaEntry = findLlmReadinessPromptSchemaEntryByInputKind(fixture.input.kind);
      const response = await adapter.run({ input: cloneInput(index) });

      expect(response).toEqual({
        ok: true,
        errors: [],
        adapterId: "llm-readiness-fixture-provider-adapter",
        adapterMode: "fixture_only",
        fixtureId: fixture.fixtureId,
        promptSchemaId: promptSchemaEntry?.promptSchemaId,
        outputCandidate: fixture.expectedOutput
      });
    }
  });

  it("accepts an explicitly requested matching prompt schema id", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const input = cloneInput(0);
    const promptSchemaId = findLlmReadinessPromptSchemaEntryByInputKind(input.kind)?.promptSchemaId;

    const response = await adapter.run({ input, promptSchemaId });

    expect(response.ok).toBe(true);
    expect(response.promptSchemaId).toBe(promptSchemaId);
  });

  it("rejects mismatched prompt schema requests", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const response = await adapter.run({
      input: cloneInput(0),
      promptSchemaId: "operator-summary-draft-prompt-schema.v0"
    });

    expect(response).toEqual({
      ok: false,
      errors: ["request.promptSchemaId must match the registered prompt schema"],
      adapterId: "llm-readiness-fixture-provider-adapter",
      adapterMode: "fixture_only",
      promptSchemaId: "clarification-question-draft-prompt-schema.v0"
    });
  });

  it("rejects invalid synthetic inputs before any fixture resolution", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const input = cloneInput(0) as unknown as Record<string, unknown>;
    const policy = structuredClone(cloneInput(0).policy) as Record<string, unknown>;
    policy.providerCalls = "enabled";
    input.policy = policy;
    input.providerResponse = "{}";

    const response = await adapter.run({ input: input as unknown as LlmReadinessModelInput });

    expect(response.ok).toBe(false);
    expect(response.errors).toContain("input.policy.providerCalls must be disabled");
    expect(response.errors).toContain("input.providerResponse is not allowed in readiness input candidates");
  });

  it("rejects unmatched but otherwise valid synthetic inputs", async () => {
    const adapter = new FixtureOnlyLlmReadinessProviderAdapter();
    const input = cloneInput(1);
    input.sourceRefs = input.sourceRefs.map((sourceRef) =>
      sourceRef.objectType === "purchase_list"
        ? { ...sourceRef, objectId: "purchase-synthetic-other" }
        : sourceRef
    );

    expect(await adapter.run({ input })).toEqual({
      ok: false,
      errors: ["no synthetic fixture matches input"],
      adapterId: "llm-readiness-fixture-provider-adapter",
      adapterMode: "fixture_only",
      promptSchemaId: "operator-summary-draft-prompt-schema.v0"
    });
  });
});
