import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  llmReadinessContractVersion,
  llmReadinessForbiddenBoundaries,
  llmReadinessToolBoundaries,
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate
} from "@catering/shared-core";

const docPath = "docs/architecture/PA26_LLM_READINESS_CONTRACT.md";
const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";

describe("PA26 LLM readiness contract", () => {
  it("anchors the readiness contract without provider runtime or product writes", () => {
    expect(existsSync(docPath)).toBe(true);
    expect(doc).toContain("PA26 LLM-Readiness-Vertrag ohne Provider");
    expect(doc).toContain("keine LLM-Runtime");
    expect(doc).toContain("kein Provider");
    expect(doc).toContain("keine Secrets");
    expect(doc).toContain("keine Modellaufrufe");
    expect(doc).toContain("keine neue API");
    expect(doc).toContain("keine Persistenz");
    expect(doc).toContain("keine Schreibwirkung");
  });

  it("keeps hard forbidden boundaries explicit in code and documentation", () => {
    for (const boundary of [
      "noProvider",
      "noProviderSecrets",
      "noModelCalls",
      "noRealData",
      "noApiEndpoint",
      "noPersistence",
      "noMigration",
      "noRuntimeConversationSession",
      "noProductObjectWrites",
      "noToolOrchestrationWithWriteEffect"
    ]) {
      expect(llmReadinessForbiddenBoundaries).toContain(boundary);
      expect(doc).toContain(boundary);
    }
  });

  it("allows read and draft tool boundaries while keeping write tools decision-required", () => {
    const readTools = llmReadinessToolBoundaries.filter((tool) => tool.effect === "read");
    const draftTools = llmReadinessToolBoundaries.filter((tool) => tool.effect === "draft");
    const writeTools = llmReadinessToolBoundaries.filter((tool) => tool.effect === "write");

    expect(readTools.map((tool) => tool.status)).toEqual([
      "allowed_without_provider",
      "allowed_without_provider",
      "allowed_without_provider"
    ]);
    expect(draftTools.map((tool) => tool.status)).toEqual([
      "allowed_without_provider",
      "allowed_without_provider"
    ]);
    expect(draftTools.every((tool) => tool.requiresHumanApproval)).toBe(true);
    expect(writeTools.length).toBeGreaterThan(0);
    expect(writeTools.every((tool) => tool.status === "decision_required")).toBe(true);
    expect(writeTools.every((tool) => tool.requiresHumanApproval)).toBe(true);
  });

  it("keeps model input provider calls disabled and data limited to synthetic or demo context", () => {
    const input = {
      contractVersion: llmReadinessContractVersion,
      inputId: "input-pa26-001",
      kind: "clarification_draft_request",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-pa26",
          label: "synthetic accepted spec"
        }
      ],
      policy: {
        providerCalls: "disabled",
        dataMode: "synthetic_or_demo_only",
        allowedToolEffects: ["read", "draft"]
      }
    } satisfies LlmReadinessModelInput;

    expect(input.policy.providerCalls).toBe("disabled");
    expect(input.policy.dataMode).toBe("synthetic_or_demo_only");
    expect(input.policy.allowedToolEffects).toEqual(["read", "draft"]);
  });

  it("accepts only human-approved draft outputs that do not write product objects", () => {
    const candidate = {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-pa26-001",
      kind: "clarification_question_draft",
      sourceRefs: [
        {
          objectType: "safe_source_anchor",
          objectId: "source-anchor-pa26",
          label: "safe source anchor"
        }
      ],
      humanApprovalRequired: true,
      writesProductObject: false,
      text: "Bitte klaeren, ob die Kaffeepause vor oder nach dem Vortrag stattfinden soll.",
      structuredCandidate: {
        reasonCode: "event.schedule"
      }
    } satisfies LlmReadinessModelOutputCandidate;

    expect(validateLlmReadinessModelOutputCandidate(candidate)).toEqual({
      valid: true,
      errors: []
    });
  });

  it("rejects unsafe output candidates with writes raw payloads or provider/tool material", () => {
    const unsafeCandidate = {
      contractVersion: llmReadinessContractVersion,
      outputId: "output-pa26-unsafe",
      kind: "clarification_question_draft",
      sourceRefs: [{ objectType: "safe_source_anchor", objectId: "source-anchor-pa26" }],
      humanApprovalRequired: false,
      writesProductObject: true,
      text: "write this into the spec",
      rawText: "real raw document text",
      prompt: "system prompt",
      providerResponse: "{}",
      toolCalls: []
    };

    const result = validateLlmReadinessModelOutputCandidate(unsafeCandidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("humanApprovalRequired must be true");
    expect(result.errors).toContain("writesProductObject must be false");
    expect(result.errors).toContain("rawText is not allowed in readiness output candidates");
    expect(result.errors).toContain("prompt is not allowed in readiness output candidates");
    expect(result.errors).toContain("providerResponse is not allowed in readiness output candidates");
    expect(result.errors).toContain("toolCalls is not allowed in readiness output candidates");
  });
});
