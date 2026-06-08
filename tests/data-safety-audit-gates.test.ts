import { describe, expect, it } from "vitest";
import {
  auditEvidencePaths,
  dataIngressPaths,
  externalBoundaryGates,
  llmReadinessDraftContracts,
  llmReadinessForbiddenBoundaries,
  validateLlmReadinessModelInputCandidate,
  type LlmReadinessModelInput
} from "@catering/shared-core";
import { isWebRecipeSearchEnabled } from "@catering/production-service";

function ids(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

describe("data safety and audit gates", () => {
  it("inventories the MVP ingress paths with explicit data scope and external exposure", () => {
    expect(ids(dataIngressPaths)).toEqual([
      "manual_intake",
      "manual_spec",
      "document_upload",
      "seed_demo",
      "offer_draft_creation",
      "offer_recipe_upload",
      "production_plan_creation",
      "production_recipe_upload",
      "export_read",
      "llm_readiness_draft",
      "web_recipe_search"
    ]);

    for (const path of dataIngressPaths) {
      expect(path.requiredGate.trim()).not.toBe("");
      expect(path.scope).toMatch(/synthetic|operator|uploaded|read_only/);
    }

    expect(dataIngressPaths.find((path) => path.id === "seed_demo")).toMatchObject({
      scope: "synthetic_demo",
      externalExposure: "none"
    });
    expect(dataIngressPaths.find((path) => path.id === "document_upload")).toMatchObject({
      scope: "uploaded_internal",
      externalExposure: "none"
    });
    expect(dataIngressPaths.find((path) => path.id === "llm_readiness_draft")).toMatchObject({
      scope: "synthetic_or_demo_only",
      externalExposure: "blocked_until_decision"
    });
    expect(dataIngressPaths.find((path) => path.id === "web_recipe_search")).toMatchObject({
      externalExposure: "disabled_by_default",
      requiredGate: "CATERING_ENABLE_WEB_RECIPE_SEARCH explicit opt-in"
    });
  });

  it("inventories audit and evidence paths without treating exports as approval", () => {
    expect(ids(auditEvidencePaths)).toEqual(
      expect.arrayContaining([
        "intake_normalized",
        "intake_documents_normalized",
        "intake_soft_archive",
        "offer_draft_created",
        "offer_promoted_variant",
        "production_plan_created",
        "recipe_reviewed",
        "offer_html_export",
        "production_plan_html_export",
        "purchase_list_csv_export",
        "llm_readiness_agent_audit"
      ])
    );

    const mutationActions = auditEvidencePaths
      .filter((path) => path.productApprovalEffect === "product_mutation")
      .map((path) => path.action);

    expect(mutationActions).toEqual(
      expect.arrayContaining([
        "intake.normalized",
        "intake.documents_normalized",
        "intake.request_soft_archived",
        "offer.promoted_variant",
        "production.plan_created",
        "recipe.reviewed"
      ])
    );

    const exports = auditEvidencePaths.filter((path) => path.evidenceKind === "export");
    expect(exports).toHaveLength(3);
    expect(exports.every((path) => path.readOnlyEvidence)).toBe(true);
    expect(exports.every((path) => path.productApprovalEffect === "none")).toBe(true);
  });

  it("keeps external LLM and web recipe gates disabled by default", () => {
    expect(externalBoundaryGates).toEqual([
      expect.objectContaining({
        id: "llm_provider_gate",
        boundary: "llm_provider",
        defaultState: "disabled",
        allowedDataScope: "synthetic_or_demo_only",
        writeEffectsAllowed: false
      }),
      expect.objectContaining({
        id: "web_recipe_search_gate",
        boundary: "web_recipe_search",
        defaultState: "disabled",
        writeEffectsAllowed: false
      })
    ]);

    expect(llmReadinessForbiddenBoundaries).toEqual(
      expect.arrayContaining(["noProvider", "noModelCalls", "noRealData", "noProductObjectWrites"])
    );
    expect(llmReadinessDraftContracts.every((contract) => contract.providerCalls === "disabled")).toBe(true);
    expect(llmReadinessDraftContracts.every((contract) => contract.dataMode === "synthetic_or_demo_only")).toBe(true);
    expect(llmReadinessDraftContracts.every((contract) => contract.writesProductObject === false)).toBe(true);

    expect(isWebRecipeSearchEnabled({})).toBe(false);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "0" })).toBe(false);
  });

  it("rejects non-synthetic or provider-enabled LLM inputs before any provider boundary", () => {
    const unsafeInput = {
      contractVersion: "llm-readiness-v0",
      inputId: "input-real-data-blocked",
      kind: "operator_summary_request",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-real-customer"
        }
      ],
      policy: {
        providerCalls: "enabled",
        dataMode: "real_customer_data",
        allowedToolEffects: ["read", "draft"]
      },
      rawText: "real customer raw text"
    };

    const result = validateLlmReadinessModelInputCandidate(
      unsafeInput as unknown as LlmReadinessModelInput
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("policy.providerCalls must be disabled");
    expect(result.errors).toContain("policy.dataMode must be synthetic_or_demo_only");
    expect(result.errors).toContain("rawText is not allowed in readiness input candidates");
  });
});
