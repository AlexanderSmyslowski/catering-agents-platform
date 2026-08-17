import type { Recipe } from "./types.js";

export type RecipeKnowledgeArtifactKind =
  | "source_fact"
  | "transcribed_recipe"
  | "operational_adaptation"
  | "ai_derived_candidate";

export type RecipeKnowledgeDerivationMethod =
  | "direct_transcription"
  | "human_adaptation"
  | "ai_derivation"
  | "internal_original";

export type RecipeKnowledgeVerificationStatus = "verified" | "unverified";

export interface RecipeKnowledge {
  artifactKind: RecipeKnowledgeArtifactKind;
  sourceCitation: {
    title: string;
    author?: string;
    edition?: string;
    publisher?: string;
    location?: string;
    sourceUrl?: string;
  };
  derivation: {
    basedOnRecipeId?: string;
    method: RecipeKnowledgeDerivationMethod;
    notes?: string;
  };
  production: {
    yieldLossPercent?: number;
    prepLeadMinutes?: number;
    holdMinutes?: number;
    regenerationInstructions?: string;
    equipmentNotes?: string[];
    criticalParameters?: Array<{
      name: string;
      value: number | string;
      unit?: string;
    }>;
  };
  verification: {
    sourceStatus: RecipeKnowledgeVerificationStatus;
    allergenStatus: RecipeKnowledgeVerificationStatus;
    productionStatus: RecipeKnowledgeVerificationStatus;
    verifiedBy?: string;
    verifiedAt?: string;
  };
  version: {
    revision: number;
    supersedesRecipeId?: string;
  };
}

export interface RecipeEventUseReview {
  eventSpecId: string;
  recipeId: string;
  reviewedBy: string;
  reviewedAt: string;
  decision: "accepted_for_event" | "rejected_for_event";
  confirmations: {
    quantitiesAndYield: boolean;
    methodAndEquipment: boolean;
    allergensAndDiet: boolean;
    holdingAndRegeneration: boolean;
  };
}

declare module "./types.js" {
  interface Recipe {
    knowledge?: RecipeKnowledge;
  }
}

export interface RecipeKnowledgeMaturityResult {
  status: "reference_only" | "review_required" | "production_ready";
  blockers: string[];
}

export interface RecipeEventUseResult {
  status: "blocked" | "kitchen_review_required" | "event_usable";
  blockers: string[];
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validDateTime(value: unknown): value is string {
  return nonBlank(value) && Number.isFinite(Date.parse(value));
}

function verificationEvidenceComplete(recipe: Recipe): boolean {
  const verification = recipe.knowledge?.verification;
  if (!verification) return false;
  return nonBlank(verification.verifiedBy) && validDateTime(verification.verifiedAt);
}

export function evaluateRecipeKnowledgeMaturity(recipe: Recipe): RecipeKnowledgeMaturityResult {
  if (recipe.source.approvalState === "rejected") {
    return { status: "review_required", blockers: ["recipe_rejected"] };
  }

  const knowledge = recipe.knowledge;
  if (!knowledge) {
    return { status: "review_required", blockers: ["knowledge_missing"] };
  }

  if (knowledge.artifactKind === "source_fact") {
    return { status: "reference_only", blockers: [] };
  }

  if (knowledge.artifactKind === "ai_derived_candidate") {
    return { status: "review_required", blockers: ["ai_candidate_not_durable"] };
  }

  const blockers: string[] = [];
  if (!["approved_internal", "auto_usable"].includes(recipe.source.approvalState)) {
    blockers.push("durable_recipe_approval_missing");
  }

  if (knowledge.verification.sourceStatus !== "verified") {
    blockers.push("source_verification_missing");
  }
  if (knowledge.verification.allergenStatus !== "verified") {
    blockers.push("allergen_verification_missing");
  }
  if (knowledge.verification.productionStatus !== "verified") {
    blockers.push("production_verification_missing");
  }
  if (!verificationEvidenceComplete(recipe)) {
    blockers.push("verification_identity_missing");
  }

  return blockers.length === 0
    ? { status: "production_ready", blockers: [] }
    : { status: "review_required", blockers };
}

export function validateRecipeEventUseReview(value: RecipeEventUseReview): RecipeEventUseReview {
  const errors: string[] = [];

  if (!nonBlank(value?.eventSpecId)) errors.push("eventSpecId is required");
  if (!nonBlank(value?.recipeId)) errors.push("recipeId is required");
  if (!nonBlank(value?.reviewedBy)) errors.push("reviewedBy is required");
  if (!validDateTime(value?.reviewedAt)) errors.push("reviewedAt must be a valid date-time");
  if (!["accepted_for_event", "rejected_for_event"].includes(value?.decision)) {
    errors.push("decision is invalid");
  }

  const confirmations = value?.confirmations;
  for (const field of [
    "quantitiesAndYield",
    "methodAndEquipment",
    "allergensAndDiet",
    "holdingAndRegeneration"
  ] as const) {
    if (!confirmations || typeof confirmations[field] !== "boolean") {
      errors.push(`confirmations.${field} must be boolean`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Recipe event-use review validation failed: ${errors.join("; ")}`);
  }

  return value;
}

export function evaluateRecipeEventUse(input: {
  recipe: Recipe;
  eventSpecId: string;
  review?: RecipeEventUseReview;
}): RecipeEventUseResult {
  const { recipe, eventSpecId, review } = input;

  if (recipe.source.approvalState === "rejected") {
    return { status: "blocked", blockers: ["recipe_rejected"] };
  }

  if (recipe.knowledge?.artifactKind === "source_fact") {
    return { status: "blocked", blockers: ["source_fact_not_recipe"] };
  }

  if (evaluateRecipeKnowledgeMaturity(recipe).status === "production_ready") {
    return { status: "event_usable", blockers: [] };
  }

  if (!review) {
    return { status: "kitchen_review_required", blockers: ["event_review_missing"] };
  }

  try {
    validateRecipeEventUseReview(review);
  } catch {
    return { status: "blocked", blockers: ["event_review_invalid"] };
  }

  if (review.eventSpecId !== eventSpecId || review.recipeId !== recipe.recipeId) {
    return { status: "blocked", blockers: ["event_review_binding_mismatch"] };
  }

  if (review.decision === "rejected_for_event") {
    return { status: "blocked", blockers: ["event_review_rejected"] };
  }

  const blockers: string[] = [];
  if (!review.confirmations.quantitiesAndYield) blockers.push("quantities_and_yield_unconfirmed");
  if (!review.confirmations.methodAndEquipment) blockers.push("method_and_equipment_unconfirmed");
  if (!review.confirmations.allergensAndDiet) blockers.push("allergens_and_diet_unconfirmed");
  if (!review.confirmations.holdingAndRegeneration) blockers.push("holding_and_regeneration_unconfirmed");

  return blockers.length === 0
    ? { status: "event_usable", blockers: [] }
    : { status: "kitchen_review_required", blockers };
}
