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
      "intake_seed_demo",
      "intake_archive_request",
      "intake_spec_update",
      "intake_spec_governance_finalize",
      "offer_draft_creation",
      "offer_recipe_upload",
      "offer_variant_promotion",
      "offer_seed_demo",
      "production_plan_creation",
      "production_draft_import",
      "production_recipe_upload",
      "production_clarification_draft",
      "production_clarification_draft_decision",
      "production_recipe_review",
      "offer_recipe_review",
      "production_seed_demo",
      "export_read",
      "llm_readiness_draft",
      "web_recipe_search"
    ]);

    for (const path of dataIngressPaths) {
      expect(path.requiredGate.trim()).not.toBe("");
      expect(path.scope).toMatch(/synthetic|operator|uploaded|read_only/);
    }

    expect(dataIngressPaths.find((path) => path.id === "intake_seed_demo")).toMatchObject({
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
    expect(dataIngressPaths.find((path) => path.id === "production_clarification_draft")).toMatchObject({
      externalExposure: "blocked_until_decision",
      requiredGate: expect.stringContaining("CATERING_SYNTHETIC_LLM_SLICE")
    });
    expect(dataIngressPaths.find((path) => path.id === "production_draft_import")).toMatchObject({
      externalExposure: "blocked_until_decision",
      requiredGate: expect.stringContaining("no product writes")
    });
    expect(dataIngressPaths.find((path) => path.id === "web_recipe_search")).toMatchObject({
      externalExposure: "disabled_by_default",
      requiredGate: "CATERING_ENABLE_WEB_RECIPE_SEARCH explicit opt-in"
    });

    const ingressRoutes = dataIngressPaths.flatMap((path) =>
      "route" in path ? path.route.split(" and ") : []
    );
    expect(ingressRoutes).toEqual(
      expect.arrayContaining([
        "POST /v1/intake/normalize",
        "POST /v1/intake/specs/manual",
        "POST /v1/intake/seed-demo",
        "POST /v1/intake/documents",
        "POST /v1/intake/documents/upload",
        "POST /v1/intake/requests/:requestId/archive",
        "PATCH /v1/intake/specs/:specId",
        "POST /v1/intake/spec-governance/finalize",
        "POST /v1/offers/drafts",
        "POST /v1/offers/from-text",
        "POST /v1/offers/drafts/:draftId/promote",
        "POST /v1/offers/seed-demo",
        "POST /v1/offers/recipes/import-text",
        "POST /v1/offers/recipes/upload",
        "PATCH /v1/offers/recipes/:recipeId/review",
        "POST /v1/production/drafts",
        "POST /v1/production/plans",
        "POST /v1/production/specs/:specId/clarification-drafts",
        "POST /v1/production/clarification-drafts/:draftId/decision",
        "POST /v1/production/seed-demo",
        "POST /v1/production/recipes/import-text",
        "POST /v1/production/recipes/upload",
        "PATCH /v1/production/recipes/:recipeId/review"
      ])
    );
  });

  it("inventories audit and evidence paths without treating exports as approval", () => {
    expect(ids(auditEvidencePaths)).toEqual(
      expect.arrayContaining([
        "intake_normalized",
        "intake_documents_normalized",
        "intake_soft_archive",
        "intake_manual_spec_created",
        "intake_spec_updated",
        "intake_spec_governance_finalized",
        "intake_seed_demo",
        "offer_draft_created",
        "offer_draft_created_from_text",
        "offer_promoted_variant",
        "offer_seed_demo",
        "offer_recipe_imported_text",
        "offer_recipe_uploaded_file",
        "offer_recipe_reviewed",
        "production_plan_created",
        "production_draft_imported",
        "production_seed_demo",
        "production_clarification_draft_created",
        "production_clarification_draft_rejected",
        "production_clarification_draft_approved",
        "production_clarification_draft_rejected_by_operator",
        "production_recipe_imported_text",
        "production_recipe_uploaded_file",
        "production_recipe_reviewed",
        "offer_html_export",
        "production_plan_html_export",
        "production_folder_html_export",
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
        "intake.manual_spec_created",
        "intake.spec_updated",
        "intake.spec_governance_finalized",
        "intake.seed_demo",
        "offer.promoted_variant",
        "recipe.imported_text",
        "recipe.uploaded_file",
        "production.plan_created",
        "production.seed_demo",
        "production.clarification_draft_approved",
        "recipe.reviewed"
      ])
    );

    const auditActions = auditEvidencePaths.flatMap((path) =>
      "action" in path ? [path.action] : []
    );

    expect(auditActions).toEqual(
      expect.arrayContaining([
        "intake.documents_normalized",
        "intake.manual_spec_created",
        "intake.normalized",
        "intake.request_soft_archived",
        "intake.seed_demo",
        "intake.spec_governance_finalized",
        "intake.spec_updated",
        "offer.draft_created",
        "offer.draft_created_from_text",
        "offer.promoted_variant",
        "offer.seed_demo",
        "production.clarification_draft_approved",
        "production.clarification_draft_created",
        "production.clarification_draft_rejected",
        "production.clarification_draft_rejected_by_operator",
        "production.plan_created",
        "production.production_draft_imported",
        "production.seed_demo",
        "recipe.imported_text",
        "recipe.reviewed",
        "recipe.uploaded_file"
      ])
    );

    const exports = auditEvidencePaths.filter((path) => path.evidenceKind === "export");
    expect(exports).toHaveLength(4);
    expect(exports.every((path) => path.readOnlyEvidence)).toBe(true);
    expect(exports.every((path) => path.productApprovalEffect === "none")).toBe(true);
  });

  it("keeps external LLM and web recipe gates disabled by default", () => {
    expect(externalBoundaryGates).toEqual([
      expect.objectContaining({
        id: "llm_provider_gate",
        boundary: "llm_provider",
        defaultState: "disabled",
        enablementGate: expect.stringContaining("CATERING_SYNTHETIC_LLM_SLICE"),
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
