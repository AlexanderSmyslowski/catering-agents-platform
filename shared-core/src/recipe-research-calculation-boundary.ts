import type { Recipe } from "./types.js";

export const recipeResearchCalculationBoundaryPolicyVersion =
  "recipe-research-calculation-boundary-v0";

export type RecipeResearchSourceKind =
  | "internal_recipe_library"
  | "web_recipe_candidate"
  | "llm_recipe_summary";

export type RecipeResearchTrustStatus =
  | "trusted_production_input"
  | "candidate_review_required"
  | "draft_explanation_only";

export interface RecipeResearchBoundaryDecision {
  sourceKind: RecipeResearchSourceKind;
  trustStatus: RecipeResearchTrustStatus;
  trustedProductionInput: boolean;
  humanReviewRequired: boolean;
  reason: string;
}

export type LlmRecipeResearchDraftType =
  | "recipe_research_summary_draft"
  | "search_query_suggestion_draft"
  | "uncertainty_summary_draft";

export interface LlmRecipeResearchDraft {
  draftType: LlmRecipeResearchDraftType;
  humanApprovalRequired: boolean;
  writesProductObject: boolean;
  text: string;
  sourceRefs: string[];
}

export interface LlmRecipeResearchDraftValidation {
  valid: boolean;
  errors: string[];
}

export const recipeResearchCalculationBoundaryPolicy = {
  version: recipeResearchCalculationBoundaryPolicyVersion,
  webRecipeSearch: {
    defaultState: "disabled",
    optInEnvVar: "CATERING_ENABLE_WEB_RECIPE_SEARCH"
  },
  recipeTrust: {
    trustedInternalApprovalState: "approved_internal",
    trustedReviewedTiers: ["internal_verified", "internal_approved"],
    webCandidateTrustStatus: "candidate_review_required",
    humanReviewRequiredForWebCandidates: true
  },
  llmResearch: {
    allowedDraftTypes: [
      "recipe_research_summary_draft",
      "search_query_suggestion_draft",
      "uncertainty_summary_draft"
    ] as const,
    effect: "draft_explanation_only",
    canWriteProductObjects: false,
    humanApprovalRequired: true
  },
  deterministicOwners: {
    scaling: "shared-core/src/rules/scaling.ts",
    purchasing: "shared-core/src/rules/purchasing.ts",
    productionArtifacts: "production-service/src/rules/planning*.ts"
  },
  sourceMetadata: {
    purchaseListObjectPreservesSourceRecipes: true,
    purchaseListCsvExportsSourceRecipes: true
  },
  outOfAuthority: [
    "allergen_approval",
    "pricing_approval",
    "margin_approval",
    "final_recipe_write",
    "final_production_plan_write",
    "final_purchase_list_write"
  ] as const
} as const;

export function recipeResearchBoundaryForRecipe(
  recipe: Recipe
): RecipeResearchBoundaryDecision {
  const isReviewedProductionRecipe =
    recipe.source.approvalState === "approved_internal" &&
    (recipe.source.tier === "internal_verified" ||
      recipe.source.tier === "internal_approved");
  const isWebCandidate =
    recipe.source.originType === "web" ||
    recipe.source.tier === "internet_fallback";

  if (isReviewedProductionRecipe) {
    return {
      sourceKind: isWebCandidate ? "web_recipe_candidate" : "internal_recipe_library",
      trustStatus: "trusted_production_input",
      trustedProductionInput: true,
      humanReviewRequired: false,
      reason:
        "Recipe is explicitly reviewed and represented as trusted production input."
    };
  }

  if (isWebCandidate) {
    return {
      sourceKind: "web_recipe_candidate",
      trustStatus: "candidate_review_required",
      trustedProductionInput: false,
      humanReviewRequired: true,
      reason:
        "Web recipe materialization is candidate evidence only and remains review-required before trusted production use."
    };
  }

  if (
    recipe.source.approvalState === "approved_internal" &&
    (recipe.source.originType === "internal_db" ||
      recipe.source.originType === "approved_import")
  ) {
    return {
      sourceKind: "internal_recipe_library",
      trustStatus: "trusted_production_input",
      trustedProductionInput: true,
      humanReviewRequired: false,
      reason:
        "Recipe is already represented as approved internal recipe data."
    };
  }

  return {
    sourceKind: "internal_recipe_library",
    trustStatus: "candidate_review_required",
    trustedProductionInput: false,
    humanReviewRequired: true,
    reason:
      "Recipe is not approved internal production input and needs review before trusted production use."
  };
}

export function assertTrustedRecipeForDeterministicProduction(
  recipe: Recipe
): RecipeResearchBoundaryDecision {
  return recipeResearchBoundaryForRecipe(recipe);
}

export function classifyRecipeProductionTrust(
  recipe: Recipe
): RecipeResearchBoundaryDecision {
  return recipeResearchBoundaryForRecipe(recipe);
}

export function isTrustedProductionRecipe(recipe: Recipe): boolean {
  return classifyRecipeProductionTrust(recipe).trustedProductionInput;
}

export function requiresRecipeOperatorReview(recipe: Recipe): boolean {
  return classifyRecipeProductionTrust(recipe).humanReviewRequired;
}

export function validateLlmRecipeResearchDraft(
  draft: LlmRecipeResearchDraft
): LlmRecipeResearchDraftValidation {
  const errors: string[] = [];
  const allowedDraftTypes =
    recipeResearchCalculationBoundaryPolicy.llmResearch.allowedDraftTypes;

  if (!allowedDraftTypes.includes(draft.draftType)) {
    errors.push("LLM recipe research draft type is not allowed.");
  }

  if (!draft.humanApprovalRequired) {
    errors.push("LLM recipe research drafts require human approval.");
  }

  if (draft.writesProductObject) {
    errors.push("LLM recipe research drafts cannot write product objects.");
  }

  if (draft.text.trim().length === 0) {
    errors.push("LLM recipe research drafts require explanation text.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
