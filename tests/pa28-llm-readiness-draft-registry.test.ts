import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findLlmReadinessDraftContractByInputKind,
  llmReadinessContractVersion,
  llmReadinessDraftContracts,
  llmReadinessEvalFixtures,
  llmReadinessForbiddenPayloadKeys,
  llmReadinessModelInputKinds,
  llmReadinessModelOutputKinds
} from "@catering/shared-core";

const docPath = "docs/architecture/PA28_LLM_READINESS_DRAFT_REGISTRY.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

describe("PA28 LLM readiness draft registry", () => {
  it("documents a schema-only draft registry without provider runtime", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA28 LLM-Readiness Draft-Registry");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("covers every PA26 input and output kind exactly once", () => {
    const inputKinds = llmReadinessDraftContracts.map((contract) => contract.inputKind);
    const outputKinds = llmReadinessDraftContracts.map((contract) => contract.outputKind);

    expect(unique(inputKinds)).toEqual([...llmReadinessModelInputKinds]);
    expect(unique(outputKinds)).toEqual([...llmReadinessModelOutputKinds]);
    expect(inputKinds).toHaveLength(llmReadinessModelInputKinds.length);
    expect(outputKinds).toHaveLength(llmReadinessModelOutputKinds.length);
  });

  it("keeps contracts schema-only synthetic and human-approved", () => {
    for (const contract of llmReadinessDraftContracts) {
      expect(contract.readinessContractVersion).toBe(llmReadinessContractVersion);
      expect(contract.status).toBe("schema_contract_only");
      expect(contract.providerCalls).toBe("disabled");
      expect(contract.dataMode).toBe("synthetic_or_demo_only");
      expect(contract.humanApprovalRequired).toBe(true);
      expect(contract.writesProductObject).toBe(false);
      expect(contract.allowedToolEffects).not.toContain("write");
      expect(contract.forbiddenPayloadKeys).toEqual(llmReadinessForbiddenPayloadKeys);
    }
  });

  it("matches PA27 fixtures to their registered draft contracts", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      const contract = findLlmReadinessDraftContractByInputKind(fixture.input.kind);

      expect(contract).toBeDefined();
      expect(contract?.outputKind).toBe(fixture.expectedOutput.kind);
      expect(contract?.providerCalls).toBe(fixture.input.policy.providerCalls);
      expect(contract?.dataMode).toBe(fixture.input.policy.dataMode);
      expect(contract?.humanApprovalRequired).toBe(fixture.expectedOutput.humanApprovalRequired);
      expect(contract?.writesProductObject).toBe(fixture.expectedOutput.writesProductObject);

      const fixtureSourceTypes = fixture.input.sourceRefs.map((sourceRef) => sourceRef.objectType);
      for (const requiredSourceObjectType of contract?.requiredSourceObjectTypes ?? []) {
        expect(fixtureSourceTypes).toContain(requiredSourceObjectType);
      }
    }
  });

  it("does not smuggle prompt text provider config secrets or tool calls into the registry", () => {
    for (const contract of llmReadinessDraftContracts) {
      expect(Object.prototype.hasOwnProperty.call(contract, "prompt")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(contract, "promptText")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(contract, "messages")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(contract, "provider")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(contract, "providerResponse")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(contract, "secret")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(contract, "toolCalls")).toBe(false);
    }
  });
});
