import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessContractVersion,
  llmReadinessEvalFixtures,
  validateLlmReadinessModelInputCandidate,
  type LlmReadinessModelInput
} from "@catering/shared-core";

const docPath = "docs/architecture/PA29_LLM_READINESS_INPUT_VALIDATION.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

describe("PA29 LLM readiness input validation", () => {
  it("documents input validation without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA29 LLM-Readiness Input-Validation");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("accepts the existing synthetic eval fixture inputs", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(validateLlmReadinessModelInputCandidate(fixture.input)).toEqual({
        valid: true,
        errors: []
      });
    }
  });

  it("accepts a minimal read-only operator summary input candidate", () => {
    const candidate = {
      contractVersion: llmReadinessContractVersion,
      inputId: "input-pa29-operator-summary",
      kind: "operator_summary_request",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-pa29"
        },
        {
          objectType: "production_plan",
          objectId: "plan-synthetic-pa29"
        }
      ],
      policy: {
        providerCalls: "disabled",
        dataMode: "synthetic_or_demo_only",
        allowedToolEffects: ["read"]
      }
    } satisfies LlmReadinessModelInput;

    expect(validateLlmReadinessModelInputCandidate(candidate)).toEqual({
      valid: true,
      errors: []
    });
  });

  it("rejects provider real-data and write-tool input candidates", () => {
    const unsafeCandidate = {
      contractVersion: llmReadinessContractVersion,
      inputId: "input-pa29-unsafe",
      kind: "clarification_draft_request",
      sourceRefs: [{ objectType: "accepted_event_spec", objectId: "spec-synthetic-pa29" }],
      policy: {
        providerCalls: "enabled",
        dataMode: "real_data",
        allowedToolEffects: ["read", "write"]
      }
    };

    const result = validateLlmReadinessModelInputCandidate(unsafeCandidate);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("policy.providerCalls must be disabled");
    expect(result.errors).toContain("policy.dataMode must be synthetic_or_demo_only");
    expect(result.errors).toContain("policy.allowedToolEffects must be read or read+draft only");
  });

  it("rejects malformed candidates and raw prompt/provider payloads", () => {
    const unsafeCandidate = {
      contractVersion: "wrong",
      inputId: "",
      kind: "production_plan_writer",
      sourceRefs: [],
      policy: {},
      prompt: "system prompt",
      messages: [],
      providerResponse: "{}",
      toolCalls: [],
      secret: "nope"
    };

    const result = validateLlmReadinessModelInputCandidate(unsafeCandidate);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("contractVersion must match llm-readiness-v0");
    expect(result.errors).toContain("inputId must be a non-empty string");
    expect(result.errors).toContain("kind must be an allowed draft input kind");
    expect(result.errors).toContain("sourceRefs must contain safe object references");
    expect(result.errors).toContain("policy.providerCalls must be disabled");
    expect(result.errors).toContain("policy.dataMode must be synthetic_or_demo_only");
    expect(result.errors).toContain("policy.allowedToolEffects must be read or read+draft only");
    expect(result.errors).toContain("prompt is not allowed in readiness input candidates");
    expect(result.errors).toContain("messages is not allowed in readiness input candidates");
    expect(result.errors).toContain("providerResponse is not allowed in readiness input candidates");
    expect(result.errors).toContain("toolCalls is not allowed in readiness input candidates");
    expect(result.errors).toContain("secret is not allowed in readiness input candidates");
  });
});
