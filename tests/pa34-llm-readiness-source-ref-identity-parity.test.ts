import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessEvalFixtures,
  validateLlmReadinessEvalFixture,
  type LlmReadinessEvalFixture
} from "@catering/shared-core";

const docPath = "docs/architecture/PA34_LLM_READINESS_SOURCE_REF_IDENTITY_PARITY.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

function cloneFixture(index: number): LlmReadinessEvalFixture {
  return structuredClone(llmReadinessEvalFixtures[index]) as LlmReadinessEvalFixture;
}

describe("PA34 LLM readiness source ref identity parity", () => {
  it("documents source ref identity parity without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA34 LLM-Readiness SourceRef-Identity-Parity");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("keeps existing synthetic eval fixtures valid", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
        valid: true,
        errors: []
      });
    }
  });

  it("rejects expected outputs that keep the source type but drift to another source id", () => {
    const fixture = cloneFixture(1);
    const purchaseSourceRef = fixture.expectedOutput.sourceRefs.find(
      (sourceRef) => sourceRef.objectType === "purchase_list"
    );

    if (!purchaseSourceRef) {
      throw new Error("fixture must contain a purchase_list source ref");
    }

    purchaseSourceRef.objectId = "purchase-synthetic-different";

    expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
      valid: false,
      errors: ["expectedOutput.sourceRefs must include purchase_list source purchase-synthetic-buffet"]
    });
  });

  it("does not duplicate identity errors when the required output source type is missing", () => {
    const fixture = cloneFixture(1);
    fixture.expectedOutput.sourceRefs = fixture.expectedOutput.sourceRefs.filter(
      (sourceRef) => sourceRef.objectType !== "purchase_list"
    );

    expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
      valid: false,
      errors: ["expectedOutput.sourceRefs must include purchase_list"]
    });
  });
});
