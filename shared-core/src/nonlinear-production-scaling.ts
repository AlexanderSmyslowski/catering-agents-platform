import { scaleRecipe, type ScaledRecipeResult } from "./rules/scaling.js";
import type { Recipe } from "./types.js";

export type ProductionScalingRuleReviewStatus =
  | "candidate"
  | "approved"
  | "rejected"
  | "superseded"
  | "revoked";

export type ProductionScalingCorrectionModel =
  | { kind: "factor"; factor: number }
  | { kind: "cap"; amount: number; unit: string }
  | { kind: "floor"; amount: number; unit: string }
  | { kind: "anchor"; servings: number; amount: number; unit: string };

export interface ProductionScalingRule {
  ruleId: string;
  recipeId: string;
  ingredientId: string;
  minServings: number;
  maxServings: number;
  requiredContext?: string[];
  model: ProductionScalingCorrectionModel;
  rationale: string;
  supportingObservationIds: string[];
  reviewStatus: ProductionScalingRuleReviewStatus;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ProductionScalingAdjustment {
  ruleId: string;
  ingredientId: string;
  baselineAmount: number;
  effectiveAmount: number;
  unit: string;
}

export interface EffectiveRecipeScalingResult {
  proportionalBaseline: ScaledRecipeResult;
  effectiveRecipe: ScaledRecipeResult;
  appliedRuleIds: string[];
  relevantCandidateIds: string[];
  adjustments: ProductionScalingAdjustment[];
  issues: string[];
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function normalize(value: number): number {
  return Number(value.toFixed(2));
}

function contextMatches(required: string[] | undefined, actual: string[] | undefined): boolean {
  if (!required?.length) return true;
  const actualSet = new Set(actual ?? []);
  return required.every((entry) => actualSet.has(entry));
}

export function applyNonlinearProductionScaling(input: {
  recipe: Recipe;
  targetServings: number;
  rules: ProductionScalingRule[];
  context?: string[];
}): EffectiveRecipeScalingResult {
  const proportionalBaseline = scaleRecipe(input.recipe, input.targetServings);
  const effectiveRecipe: ScaledRecipeResult = {
    ...proportionalBaseline,
    ingredients: proportionalBaseline.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: { ...ingredient.quantity }
    }))
  };
  const issues: string[] = [];
  const adjustments: ProductionScalingAdjustment[] = [];
  const appliedRuleIds: string[] = [];

  const relevantCandidateIds = input.rules
    .filter((rule) =>
      rule.recipeId === input.recipe.recipeId &&
      rule.reviewStatus === "candidate" &&
      input.targetServings >= rule.minServings &&
      input.targetServings <= rule.maxServings &&
      contextMatches(rule.requiredContext, input.context)
    )
    .map((rule) => rule.ruleId)
    .sort();

  const applicable = input.rules.filter((rule) =>
    rule.reviewStatus === "approved" &&
    rule.recipeId === input.recipe.recipeId &&
    input.targetServings >= rule.minServings &&
    input.targetServings <= rule.maxServings &&
    contextMatches(rule.requiredContext, input.context) &&
    (rule.model.kind !== "anchor" || rule.model.servings === input.targetServings)
  );

  const byIngredient = new Map<string, ProductionScalingRule[]>();
  for (const rule of applicable) {
    const entries = byIngredient.get(rule.ingredientId) ?? [];
    entries.push(rule);
    byIngredient.set(rule.ingredientId, entries);
  }

  for (const [ingredientId, rules] of byIngredient.entries()) {
    if (rules.length > 1) {
      issues.push(`conflicting_approved_rules:${ingredientId}`);
      continue;
    }
    const rule = rules[0]!;
    const ingredient = effectiveRecipe.ingredients.find((entry) => entry.ingredientId === ingredientId);
    const baselineIngredient = proportionalBaseline.ingredients.find((entry) => entry.ingredientId === ingredientId);
    if (!ingredient || !baselineIngredient) {
      issues.push(`rule_ingredient_missing:${rule.ruleId}`);
      continue;
    }

    const baselineAmount = baselineIngredient.quantity.amount;
    let effectiveAmount: number | undefined;
    if (rule.model.kind === "factor") {
      if (!finitePositive(rule.model.factor)) {
        issues.push(`rule_numeric_invalid:${rule.ruleId}`);
        continue;
      }
      effectiveAmount = baselineAmount * rule.model.factor;
    } else {
      if (!finitePositive(rule.model.amount)) {
        issues.push(`rule_numeric_invalid:${rule.ruleId}`);
        continue;
      }
      if (rule.model.unit !== ingredient.quantity.unit) {
        issues.push(`rule_unit_mismatch:${rule.ruleId}`);
        continue;
      }
      if (rule.model.kind === "cap") effectiveAmount = Math.min(baselineAmount, rule.model.amount);
      if (rule.model.kind === "floor") effectiveAmount = Math.max(baselineAmount, rule.model.amount);
      if (rule.model.kind === "anchor") effectiveAmount = rule.model.amount;
    }

    if (effectiveAmount === undefined || !finitePositive(effectiveAmount)) {
      issues.push(`rule_numeric_invalid:${rule.ruleId}`);
      continue;
    }
    ingredient.quantity.amount = normalize(effectiveAmount);
    adjustments.push({
      ruleId: rule.ruleId,
      ingredientId,
      baselineAmount,
      effectiveAmount: ingredient.quantity.amount,
      unit: ingredient.quantity.unit
    });
    appliedRuleIds.push(rule.ruleId);
  }

  issues.sort();
  adjustments.sort((a, b) => a.ingredientId.localeCompare(b.ingredientId) || a.ruleId.localeCompare(b.ruleId));
  appliedRuleIds.sort();

  return {
    proportionalBaseline,
    effectiveRecipe,
    appliedRuleIds,
    relevantCandidateIds,
    adjustments,
    issues
  };
}
