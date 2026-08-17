import {
  evaluateQuantityDecision,
  type QuantityDecisionInput
} from "./quantity-decision.js";
import {
  evaluateRecipeEventUse,
  type RecipeEventUseReview
} from "./recipe-knowledge-foundation.js";
import type { Recipe } from "./types.js";

export interface RecipeOutputMapping {
  recipeId: string;
  outputAmount: number;
  outputUnit: string;
  recipeServings: number;
  reviewedBy: string;
  reviewedAt: string;
}

export type QuantityRecipeProductionBridgeStatus =
  | "blocked"
  | "review_required"
  | "ready_for_scaling";

export interface QuantityRecipeProductionBridgeInput {
  eventSpecId: string;
  componentId: string;
  quantityDecision: QuantityDecisionInput;
  recipe: Recipe;
  recipeEventUseReview?: RecipeEventUseReview;
  outputMapping?: RecipeOutputMapping;
}

export interface QuantityRecipeProductionBridgeResult {
  status: QuantityRecipeProductionBridgeStatus;
  eventSpecId: string;
  componentId: string;
  recipeId: string;
  targetOutput: {
    amount: number;
    unit: string;
  };
  targetServings?: number;
  conversionMethod?: "direct_servings" | "reviewed_output_mapping";
  issues: string[];
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validDateTime(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function normalizeAmount(value: number): number {
  return Number(value.toFixed(6));
}

export function evaluateQuantityRecipeProductionBridge(
  input: QuantityRecipeProductionBridgeInput
): QuantityRecipeProductionBridgeResult {
  const quantity = evaluateQuantityDecision(input.quantityDecision);
  const issues: string[] = [];
  let blocked = false;
  let reviewRequired = false;

  if (quantity.decision.eventSpecId !== input.eventSpecId) {
    issues.push("quantity_event_binding_mismatch");
    blocked = true;
  }

  if (quantity.decision.componentId !== input.componentId) {
    issues.push("quantity_component_binding_mismatch");
    blocked = true;
  }

  if (!quantity.valid) {
    issues.push("quantity_invalid");
    blocked = true;
  } else if (!quantity.usableForPlanning) {
    issues.push("quantity_unusable");
    blocked = true;
  } else if (quantity.decision.reviewStatus !== "approved") {
    issues.push("quantity_review_required");
    reviewRequired = true;
  }

  const recipeUse = evaluateRecipeEventUse({
    recipe: input.recipe,
    eventSpecId: input.eventSpecId,
    review: input.recipeEventUseReview
  });

  if (recipeUse.status === "blocked") {
    issues.push("recipe_event_blocked");
    blocked = true;
  } else if (recipeUse.status === "kitchen_review_required") {
    issues.push("recipe_event_review_required");
    reviewRequired = true;
  }

  let targetServings: number | undefined;
  let conversionMethod: "direct_servings" | "reviewed_output_mapping" | undefined;

  if (quantity.valid && quantity.decision.targetUnit === "servings") {
    targetServings = quantity.decision.targetAmount;
    conversionMethod = "direct_servings";
  } else if (quantity.valid) {
    const mapping = input.outputMapping;

    if (!mapping) {
      issues.push("output_mapping_missing");
      reviewRequired = true;
    } else {
      if (mapping.recipeId !== input.recipe.recipeId) {
        issues.push("output_mapping_recipe_mismatch");
        blocked = true;
      }

      if (!mapping.outputUnit.trim() || mapping.outputUnit.trim() !== quantity.decision.targetUnit) {
        issues.push("output_mapping_unit_mismatch");
        blocked = true;
      }

      if (!positiveFinite(mapping.outputAmount)) {
        issues.push("output_mapping_output_amount_invalid");
        blocked = true;
      }

      if (!positiveFinite(mapping.recipeServings)) {
        issues.push("output_mapping_recipe_servings_invalid");
        blocked = true;
      }

      if (!mapping.reviewedBy.trim()) {
        issues.push("output_mapping_reviewer_missing");
        blocked = true;
      }

      if (!validDateTime(mapping.reviewedAt)) {
        issues.push("output_mapping_reviewed_at_invalid");
        blocked = true;
      }

      if (!blocked) {
        targetServings = normalizeAmount(
          quantity.decision.targetAmount / mapping.outputAmount * mapping.recipeServings
        );
        conversionMethod = "reviewed_output_mapping";
      }
    }
  }

  issues.sort((a, b) => a.localeCompare(b));

  const baseResult = {
    eventSpecId: input.eventSpecId,
    componentId: input.componentId,
    recipeId: input.recipe.recipeId,
    targetOutput: {
      amount: quantity.decision.targetAmount,
      unit: quantity.decision.targetUnit
    },
    issues
  };

  if (blocked) {
    return {
      ...baseResult,
      status: "blocked"
    };
  }

  if (reviewRequired || targetServings === undefined || conversionMethod === undefined) {
    return {
      ...baseResult,
      status: "review_required"
    };
  }

  return {
    ...baseResult,
    status: "ready_for_scaling",
    targetServings,
    conversionMethod
  };
}
