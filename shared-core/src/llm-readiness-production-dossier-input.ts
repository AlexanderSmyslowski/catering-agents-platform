import {
  llmReadinessContractVersion,
  validateLlmReadinessModelInputCandidate,
  type LlmReadinessModelInput,
  type LlmReadinessSourceRef
} from "./llm-readiness.js";
import type { AcceptedEventSpec, ProductionPlan, PurchaseList, Recipe } from "./types.js";

export interface ProductionDossierDraftInputArtifacts {
  spec: Pick<AcceptedEventSpec, "specId">;
  productionPlan: Pick<ProductionPlan, "planId" | "eventSpecId">;
  purchaseList: Pick<PurchaseList, "purchaseListId" | "eventSpecId">;
  recipes: Array<Pick<Recipe, "recipeId">>;
  conversationProjection?: string | { sessionId?: string };
}

export interface ProductionDossierDraftInputBuildResult {
  input?: LlmReadinessModelInput;
  errors: string[];
}

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueIds(values: unknown[]): string[] {
  return [...new Set(values.map(cleanId).filter(Boolean))];
}

function conversationProjectionId(
  specId: string,
  conversationProjection: ProductionDossierDraftInputArtifacts["conversationProjection"]
): string {
  const explicitId =
    typeof conversationProjection === "string"
      ? cleanId(conversationProjection)
      : cleanId(conversationProjection?.sessionId);

  return explicitId || (specId ? `production-session-${specId}` : "");
}

function validateArtifacts(input: ProductionDossierDraftInputArtifacts, recipeIds: string[]): string[] {
  const errors: string[] = [];
  const specId = cleanId(input.spec.specId);
  const planId = cleanId(input.productionPlan.planId);
  const planSpecId = cleanId(input.productionPlan.eventSpecId);
  const purchaseListId = cleanId(input.purchaseList.purchaseListId);
  const purchaseListSpecId = cleanId(input.purchaseList.eventSpecId);

  if (!specId) {
    errors.push("spec.specId must be present");
  }
  if (!planId) {
    errors.push("productionPlan.planId must be present");
  }
  if (!purchaseListId) {
    errors.push("purchaseList.purchaseListId must be present");
  }
  if (specId && planSpecId && planSpecId !== specId) {
    errors.push("productionPlan.eventSpecId must match spec.specId");
  }
  if (specId && purchaseListSpecId && purchaseListSpecId !== specId) {
    errors.push("purchaseList.eventSpecId must match spec.specId");
  }
  if (recipeIds.length === 0) {
    errors.push("recipes must include at least one recipeId");
  }

  return errors;
}

export function buildProductionDossierDraftInput(
  artifacts: ProductionDossierDraftInputArtifacts
): ProductionDossierDraftInputBuildResult {
  const specId = cleanId(artifacts.spec.specId);
  const planId = cleanId(artifacts.productionPlan.planId);
  const purchaseListId = cleanId(artifacts.purchaseList.purchaseListId);
  const recipeIds = uniqueIds(artifacts.recipes.map((recipe) => recipe.recipeId));
  const projectionId = conversationProjectionId(specId, artifacts.conversationProjection);
  const artifactErrors = validateArtifacts(artifacts, recipeIds);

  if (!projectionId) {
    artifactErrors.push("conversationProjection.sessionId must be present");
  }

  if (artifactErrors.length > 0) {
    return { errors: [...new Set(artifactErrors)] };
  }

  const sourceRefs: LlmReadinessSourceRef[] = [
    {
      objectType: "accepted_event_spec",
      objectId: specId,
      label: "accepted event spec"
    },
    {
      objectType: "production_plan",
      objectId: planId,
      label: "production plan"
    },
    {
      objectType: "purchase_list",
      objectId: purchaseListId,
      label: "purchase list"
    },
    ...recipeIds.map((recipeId) => ({
      objectType: "recipe_card" as const,
      objectId: recipeId,
      label: "recipe card"
    })),
    {
      objectType: "conversation_projection",
      objectId: projectionId,
      label: "clarification projection"
    }
  ];
  const input: LlmReadinessModelInput = {
    contractVersion: llmReadinessContractVersion,
    inputId: `input-${specId}-production-dossier-draft`,
    kind: "production_dossier_draft_request",
    sourceRefs,
    policy: {
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      allowedToolEffects: ["read", "draft"]
    }
  };
  const validation = validateLlmReadinessModelInputCandidate(input);

  return validation.valid
    ? { input, errors: [] }
    : { errors: validation.errors };
}
