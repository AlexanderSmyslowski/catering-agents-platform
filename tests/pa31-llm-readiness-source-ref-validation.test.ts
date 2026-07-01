import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessContractVersion,
  llmReadinessEvalFixtures,
  llmReadinessSourceObjectTypes,
  validateLlmReadinessEvalFixture,
  validateLlmReadinessModelInputCandidate,
  validateLlmReadinessModelOutputCandidate
} from "@catering/shared-core";

const docPath = "docs/architecture/PA31_LLM_READINESS_SOURCE_REF_VALIDATION.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

describe("PA31 LLM readiness source ref validation", () => {
  it("documents source ref validation without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA31 LLM-Readiness SourceRef-Validation");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("exports the safe source object type allowlist", () => {
    expect(llmReadinessSourceObjectTypes).toEqual([
      "accepted_event_spec",
      "production_plan",
      "purchase_list",
      "recipe_card",
      "conversation_projection",
      "safe_source_anchor"
    ]);

    for (const sourceObjectType of llmReadinessSourceObjectTypes) {
      expect(doc).toContain(sourceObjectType);
    }
  });

  it("rejects model input candidates with unknown source object types", () => {
    const candidate = {
      contractVersion: llmReadinessContractVersion,
      inputId: "input-pa31-unknown-source",
      kind: "operator_summary_request",
      sourceRefs: [
        {
          objectType: "customer_record",
          objectId: "customer-real-ish"
        }
      ],
      policy: {
        providerCalls: "disabled",
        dataMode: "synthetic_or_demo_only",
        allowedToolEffects: ["read"]
      }
    };

    expect(validateLlmReadinessModelInputCandidate(candidate)).toEqual({
      valid: false,
      errors: ["sourceRefs must contain safe object references"]
    });
  });

  it("rejects model output candidates with unknown source object types", () => {
    const candidate = {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-pa31-unknown-source",
      kind: "operator_summary_draft",
      sourceRefs: [
        {
          objectType: "provider_thread",
          objectId: "thread-pa31"
        }
      ],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: "Operator summary draft."
    };

    expect(validateLlmReadinessModelOutputCandidate(candidate)).toEqual({
      valid: false,
      errors: ["sourceRefs must contain safe object references"]
    });
  });

  it("keeps existing synthetic eval fixtures valid under the stricter source allowlist", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
        valid: true,
        errors: []
      });
    }
  });
});
