import { describe, expect, it } from "vitest";
import {
  buildProductionDossierDraftInput,
  validateLlmReadinessModelInputCandidate
} from "@catering/shared-core";

const spec = { specId: "spec-synthetic-dossier" };
const productionPlan = {
  planId: "plan-synthetic-dossier",
  eventSpecId: spec.specId
};
const purchaseList = {
  purchaseListId: "purchase-synthetic-dossier",
  eventSpecId: spec.specId
};

describe("production dossier draft input", () => {
  it("builds a schema-valid draft input from existing artifact references only", () => {
    const result = buildProductionDossierDraftInput({
      spec,
      productionPlan,
      purchaseList,
      recipes: [{ recipeId: "recipe-vitello" }, { recipeId: "recipe-tarte" }],
      conversationProjection: { sessionId: "production-session-spec-synthetic-dossier" }
    });

    expect(result.errors).toEqual([]);
    expect(result.input).toEqual({
      contractVersion: "llm-readiness-v0",
      inputId: "input-spec-synthetic-dossier-production-dossier-draft",
      kind: "production_dossier_draft_request",
      sourceRefs: [
        {
          objectType: "accepted_event_spec",
          objectId: "spec-synthetic-dossier",
          label: "accepted event spec"
        },
        {
          objectType: "production_plan",
          objectId: "plan-synthetic-dossier",
          label: "production plan"
        },
        {
          objectType: "purchase_list",
          objectId: "purchase-synthetic-dossier",
          label: "purchase list"
        },
        {
          objectType: "recipe_card",
          objectId: "recipe-vitello",
          label: "recipe card"
        },
        {
          objectType: "recipe_card",
          objectId: "recipe-tarte",
          label: "recipe card"
        },
        {
          objectType: "conversation_projection",
          objectId: "production-session-spec-synthetic-dossier",
          label: "clarification projection"
        }
      ],
      policy: {
        providerCalls: "disabled",
        dataMode: "synthetic_or_demo_only",
        allowedToolEffects: ["read", "draft"]
      }
    });
    expect(validateLlmReadinessModelInputCandidate(result.input)).toEqual({
      valid: true,
      errors: []
    });
    expect(JSON.stringify(result.input)).not.toContain("rawText");
    expect(JSON.stringify(result.input)).not.toContain("providerResponse");
  });

  it("deduplicates recipe cards and defaults the conversation projection id from the spec", () => {
    const result = buildProductionDossierDraftInput({
      spec,
      productionPlan,
      purchaseList,
      recipes: [
        { recipeId: "recipe-vitello" },
        { recipeId: " recipe-vitello " },
        { recipeId: "recipe-spargel" }
      ]
    });

    expect(result.errors).toEqual([]);
    expect(result.input?.sourceRefs.filter((sourceRef) => sourceRef.objectType === "recipe_card")).toEqual([
      {
        objectType: "recipe_card",
        objectId: "recipe-vitello",
        label: "recipe card"
      },
      {
        objectType: "recipe_card",
        objectId: "recipe-spargel",
        label: "recipe card"
      }
    ]);
    expect(result.input?.sourceRefs.at(-1)).toEqual({
      objectType: "conversation_projection",
      objectId: "production-session-spec-synthetic-dossier",
      label: "clarification projection"
    });
  });

  it("rejects incomplete or cross-spec artifacts instead of fabricating source refs", () => {
    const result = buildProductionDossierDraftInput({
      spec,
      productionPlan: {
        planId: "plan-other",
        eventSpecId: "spec-other"
      },
      purchaseList: {
        purchaseListId: "",
        eventSpecId: "spec-other"
      },
      recipes: []
    });

    expect(result.input).toBeUndefined();
    expect(result.errors).toEqual([
      "purchaseList.purchaseListId must be present",
      "productionPlan.eventSpecId must match spec.specId",
      "purchaseList.eventSpecId must match spec.specId",
      "recipes must include at least one recipeId"
    ]);
  });
});
