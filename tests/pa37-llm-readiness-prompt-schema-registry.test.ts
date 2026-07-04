import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findLlmReadinessPromptSchemaEntryByContractId,
  llmReadinessContractVersion,
  llmReadinessDraftContracts,
  llmReadinessEvalFixtures,
  llmReadinessForbiddenPayloadKeys,
  llmReadinessPromptSchemaRegistry
} from "@catering/shared-core";

const docPath = "docs/architecture/PA37_LLM_READINESS_PROMPT_SCHEMA_REGISTRY.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

describe("PA37 LLM readiness prompt schema registry", () => {
  it("documents a schema-only prompt/schema registry without provider runtime", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA37 LLM-Readiness Prompt-/Schema-Registry");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("covers every PA28 draft contract exactly once", () => {
    const contractIds = llmReadinessPromptSchemaRegistry.map((entry) => entry.draftContractId);

    expect(unique(contractIds)).toEqual(llmReadinessDraftContracts.map((contract) => contract.contractId));
    expect(contractIds).toHaveLength(llmReadinessDraftContracts.length);
  });

  it("keeps prompt/schema entries schema-only synthetic and human-approved", () => {
    for (const entry of llmReadinessPromptSchemaRegistry) {
      expect(entry.readinessContractVersion).toBe(llmReadinessContractVersion);
      expect(entry.status).toBe("schema_contract_only");
      expect(entry.providerCalls).toBe("disabled");
      expect(["synthetic_or_demo_only", "pseudonymized_approved"]).toContain(entry.dataMode);
      expect(entry.humanApprovalRequired).toBe(true);
      expect(entry.writesProductObject).toBe(false);
      expect(entry.allowedToolEffects).not.toContain("write");
      expect(entry.forbiddenPayloadKeys).toEqual(llmReadinessForbiddenPayloadKeys);
      expect(entry.promptArtifactId).toContain(".prompt");
      expect(entry.policyArtifactId).toContain(".policy");
      expect(entry.outputSchemaId).toContain(".output-schema.");
      expect(entry.promptVersion).toBe("v0");
      expect(entry.policyVersion).toBe("v0");
      expect(entry.fixtureIds.length).toBeGreaterThan(0);
    }
  });

  it("matches prompt/schema entries to existing draft contracts and fixtures", () => {
    for (const contract of llmReadinessDraftContracts) {
      const entry = findLlmReadinessPromptSchemaEntryByContractId(contract.contractId);

      expect(entry).toBeDefined();
      expect(entry?.inputKind).toBe(contract.inputKind);
      expect(entry?.outputKind).toBe(contract.outputKind);
      expect(entry?.allowedToolEffects).toEqual(contract.allowedToolEffects);
      expect(entry?.requiredSourceObjectTypes).toEqual(contract.requiredSourceObjectTypes);
      expect(entry?.humanApprovalRequired).toBe(contract.humanApprovalRequired);
      expect(entry?.writesProductObject).toBe(contract.writesProductObject);

      const fixtures = llmReadinessEvalFixtures.filter((fixture) =>
        entry?.fixtureIds.includes(fixture.fixtureId)
      );

      expect(fixtures).toHaveLength(entry?.fixtureIds.length ?? 0);
      expect(fixtures.map((fixture) => fixture.input.kind)).toEqual(
        Array(fixtures.length).fill(contract.inputKind)
      );
      expect(fixtures.map((fixture) => fixture.expectedOutput.kind)).toEqual(
        Array(fixtures.length).fill(contract.outputKind)
      );
    }
  });

  it("does not smuggle prompt text provider config secrets or tool calls into the registry", () => {
    for (const entry of llmReadinessPromptSchemaRegistry) {
      expect(Object.prototype.hasOwnProperty.call(entry, "prompt")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(entry, "promptText")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(entry, "messages")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(entry, "provider")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(entry, "providerResponse")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(entry, "secret")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(entry, "toolCalls")).toBe(false);
    }
  });
});
