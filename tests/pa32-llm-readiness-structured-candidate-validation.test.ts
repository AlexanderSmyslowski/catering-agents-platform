import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessContractVersion,
  llmReadinessEvalFixtures,
  validateLlmReadinessEvalFixture,
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelOutputCandidate
} from "@catering/shared-core";

const docPath = "docs/architecture/PA32_LLM_READINESS_STRUCTURED_CANDIDATE_VALIDATION.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

describe("PA32 LLM readiness structured candidate validation", () => {
  it("documents structured candidate validation without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA32 LLM-Readiness StructuredCandidate-Validation");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("accepts flat scalar structured draft data", () => {
    const candidate = {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-pa32-flat-structured-candidate",
      kind: "operator_summary_draft",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-pa32"
        }
      ],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: "Operator summary draft.",
      structuredCandidate: {
        summaryKind: "operator_context",
        confidenceHint: 0.82,
        needsReview: true,
        nextAction: null
      }
    } satisfies LlmReadinessModelOutputCandidate;

    expect(validateLlmReadinessModelOutputCandidate(candidate)).toEqual({
      valid: true,
      errors: []
    });
  });

  it("rejects nested arrays objects and non-finite structured draft values", () => {
    const candidate = {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-pa32-nested-structured-candidate",
      kind: "operator_summary_draft",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-pa32"
        }
      ],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: "Operator summary draft.",
      structuredCandidate: {
        nested: { value: "unsafe" },
        list: ["unsafe"],
        impossibleNumber: Number.POSITIVE_INFINITY
      }
    };

    expect(validateLlmReadinessModelOutputCandidate(candidate)).toEqual({
      valid: false,
      errors: ["structuredCandidate must be a flat scalar object"]
    });
  });

  it("rejects forbidden payload keys inside structured draft data", () => {
    const candidate = {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-pa32-forbidden-structured-candidate",
      kind: "clarification_question_draft",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-pa32"
        }
      ],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: "Bitte klaeren, ob Kaffee gewuenscht ist.",
      structuredCandidate: {
        reasonCode: "beverages.coffee",
        prompt: "do not smuggle prompt material here"
      }
    };

    expect(validateLlmReadinessModelOutputCandidate(candidate)).toEqual({
      valid: false,
      errors: ["structuredCandidate must not contain forbidden payload keys"]
    });
  });

  it("keeps existing synthetic eval fixtures valid under the structured candidate guard", () => {
    for (const fixture of llmReadinessEvalFixtures) {
      expect(validateLlmReadinessEvalFixture(fixture)).toEqual({
        valid: true,
        errors: []
      });
    }
  });
});
