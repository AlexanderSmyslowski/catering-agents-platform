import { evaluateQuantityDecision, type QuantityDecisionInput, type QuantityDecisionResult } from "./quantity-decision.js";
import { evaluateQuantityRecipeProductionBridge, type QuantityRecipeProductionBridgeResult, type RecipeOutputMapping } from "./quantity-recipe-production-bridge.js";
import { scaleRecipe, type ScaledRecipeResult } from "./rules/scaling.js";
import type { IngredientLine, Recipe } from "./types.js";

export type QuantityOverrideEditOrigin = "target_output" | "recipe_total" | "purchase_ingredient";
export type QuantityOverrideStaleArtifact =
  | "effective_event_recipe"
  | "kitchen_sheet"
  | "production_batch"
  | "production_summary"
  | "purchase_requirements"
  | "quantity_cost_calculation"
  | "quantity_recipe_bridge";

export type QuantityOverrideEdit =
  | { origin: "target_output"; perUnitAmount: number; unit: string }
  | { origin: "recipe_total"; targetAmount: number; unit: string }
  | { origin: "purchase_ingredient"; ingredientId: string; amount: number; unit: string };

export interface QuantityOverridePreviewInput {
  eventSpecId: string;
  componentId: string;
  recipe: Recipe;
  currentAuthority: QuantityDecisionInput;
  outputMapping: RecipeOutputMapping;
  recommendationReference?: string;
  edit: QuantityOverrideEdit;
}

interface QuantityOverridePreviewReady {
  status: "preview_ready";
  eventSpecId: string;
  componentId: string;
  recipeId: string;
  editOrigin: QuantityOverrideEditOrigin;
  purchaseIngredientId?: string;
  previousAuthority: QuantityDecisionInput;
  proposedAuthority: QuantityDecisionInput;
  scaleFactor: number;
  proportionalBaseline: ScaledRecipeResult;
  effectiveRecipeQuantity: ScaledRecipeResult;
  purchaseQuantities: IngredientLine[];
  staleArtifacts: QuantityOverrideStaleArtifact[];
  recommendationReference?: string;
  summary: string;
  issues: string[];
}

interface QuantityOverridePreviewBlocked {
  status: "blocked";
  issues: string[];
}

export type QuantityOverridePreviewResult = QuantityOverridePreviewReady | QuantityOverridePreviewBlocked;

export interface ConfirmQuantityOverrideInput {
  preview: QuantityOverridePreviewResult;
  overrideId: string;
  confirmedAt: string;
  operatorId?: string;
}

export interface ConfirmedQuantityOverride {
  overrideId: string;
  eventSpecId: string;
  componentId: string;
  recipeId: string;
  editOrigin: QuantityOverrideEditOrigin;
  purchaseIngredientId?: string;
  previousAuthority: QuantityDecisionInput;
  newAuthority: QuantityDecisionInput;
  scaleFactor: number;
  operatorId?: string;
  confirmedAt: string;
  recommendationReference?: string;
  staleArtifacts: QuantityOverrideStaleArtifact[];
}

export type ConfirmedQuantityOverrideResult =
  | { status: "confirmed"; override: ConfirmedQuantityOverride }
  | { status: "blocked"; issues: string[] };

export interface RecalculateQuantityLineageInput {
  confirmedOverride: ConfirmedQuantityOverride;
  recipe: Recipe;
  outputMapping: RecipeOutputMapping;
}

export interface QuantityLineageRecalculationResult {
  quantityDecision: QuantityDecisionResult;
  bridge: QuantityRecipeProductionBridgeResult;
  currentRecipe?: ScaledRecipeResult;
  purchaseQuantities?: IngredientLine[];
  staleArtifacts: QuantityOverrideStaleArtifact[];
}

const STALE_ARTIFACTS: QuantityOverrideStaleArtifact[] = [
  "effective_event_recipe",
  "kitchen_sheet",
  "production_batch",
  "production_summary",
  "purchase_requirements",
  "quantity_cost_calculation",
  "quantity_recipe_bridge"
];

function normalize(value: number): number {
  return Number(value.toFixed(6));
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function blocked(...issues: string[]): QuantityOverridePreviewBlocked {
  return { status: "blocked", issues: issues.sort((a, b) => a.localeCompare(b)) };
}

function currentTargetServings(input: QuantityOverridePreviewInput): number | undefined {
  if (input.outputMapping.recipeId !== input.recipe.recipeId) return undefined;
  if (input.outputMapping.outputUnit !== input.currentAuthority.targetUnit) return undefined;
  if (!positive(input.outputMapping.outputAmount) || !positive(input.outputMapping.recipeServings)) return undefined;
  return input.currentAuthority.targetAmount / input.outputMapping.outputAmount * input.outputMapping.recipeServings;
}

export function previewQuantityOverride(input: QuantityOverridePreviewInput): QuantityOverridePreviewResult {
  const issues: string[] = [];
  if (input.currentAuthority.eventSpecId !== input.eventSpecId) issues.push("quantity_event_binding_mismatch");
  if (input.currentAuthority.componentId !== input.componentId) issues.push("quantity_component_binding_mismatch");
  if (input.outputMapping.recipeId !== input.recipe.recipeId) issues.push("output_mapping_recipe_mismatch");
  if (input.outputMapping.outputUnit !== input.currentAuthority.targetUnit) issues.push("output_mapping_unit_mismatch");
  const servings = currentTargetServings(input);
  if (!positive(servings ?? 0)) issues.push("current_recipe_scale_unavailable");
  if (issues.length) return blocked(...issues);

  const currentScaled = scaleRecipe(input.recipe, servings!);
  let proposedTarget = input.currentAuthority.targetAmount;
  let proposedPerUnit = input.currentAuthority.perUnitAmount;
  let purchaseIngredientId: string | undefined;

  if (input.edit.origin === "target_output") {
    if (!positive(input.edit.perUnitAmount)) return blocked("proposed_quantity_invalid");
    if (input.edit.unit !== input.currentAuthority.targetUnit) return blocked("unit_mismatch");
    proposedPerUnit = input.edit.perUnitAmount;
    proposedTarget = normalize(input.edit.perUnitAmount * input.currentAuthority.guestCount);
  } else if (input.edit.origin === "recipe_total") {
    if (!positive(input.edit.targetAmount)) return blocked("proposed_quantity_invalid");
    if (input.edit.unit !== input.currentAuthority.targetUnit) return blocked("unit_mismatch");
    proposedTarget = normalize(input.edit.targetAmount);
    if (input.currentAuthority.basis !== "fixed_total") proposedPerUnit = normalize(proposedTarget / input.currentAuthority.guestCount);
  } else {
    const purchaseEdit = input.edit;
    if (!positive(purchaseEdit.amount)) return blocked("proposed_quantity_invalid");
    const matches = currentScaled.ingredients.filter((line) => line.ingredientId === purchaseEdit.ingredientId);
    if (matches.length !== 1) return blocked("purchase_ingredient_untraceable");
    const line = matches[0]!;
    if (line.quantity.unit !== purchaseEdit.unit) return blocked("unit_mismatch");
    const factor = purchaseEdit.amount / line.quantity.amount;
    proposedTarget = normalize(input.currentAuthority.targetAmount * factor);
    if (input.currentAuthority.basis !== "fixed_total") proposedPerUnit = normalize((input.currentAuthority.perUnitAmount ?? 0) * factor);
    purchaseIngredientId = purchaseEdit.ingredientId;
  }

  const scaleFactor = normalize(proposedTarget / input.currentAuthority.targetAmount);
  const targetServings = servings! * scaleFactor;
  const proportionalBaseline = scaleRecipe(input.recipe, targetServings);
  const proposedAuthority: QuantityDecisionInput = {
    ...input.currentAuthority,
    decisionId: `${input.currentAuthority.decisionId}-preview`,
    perUnitAmount: proposedPerUnit,
    targetAmount: proposedTarget,
    evidence: { kind: "operator_instruction", reference: "quantity_override_preview" },
    reviewStatus: "kitchen_review_required",
    rationale: "Vom Nutzer vorgeschlagene Mengenänderung; vor Bestätigung neu zu prüfen."
  };

  return {
    status: "preview_ready",
    eventSpecId: input.eventSpecId,
    componentId: input.componentId,
    recipeId: input.recipe.recipeId,
    editOrigin: input.edit.origin,
    purchaseIngredientId,
    previousAuthority: input.currentAuthority,
    proposedAuthority,
    scaleFactor,
    proportionalBaseline,
    effectiveRecipeQuantity: proportionalBaseline,
    purchaseQuantities: proportionalBaseline.ingredients,
    staleArtifacts: [...STALE_ARTIFACTS],
    recommendationReference: input.recommendationReference,
    summary: `Mengenänderung auf Faktor ${scaleFactor}; neues Ziel ${proposedTarget} ${input.currentAuthority.targetUnit}.`,
    issues: []
  };
}

export function confirmQuantityOverride(input: ConfirmQuantityOverrideInput): ConfirmedQuantityOverrideResult {
  if (input.preview.status !== "preview_ready") return { status: "blocked", issues: ["preview_not_confirmable"] };
  if (!input.overrideId.trim() || !input.confirmedAt.trim() || !Number.isFinite(Date.parse(input.confirmedAt))) {
    return { status: "blocked", issues: ["confirmation_metadata_invalid"] };
  }
  return {
    status: "confirmed",
    override: {
      overrideId: input.overrideId,
      eventSpecId: input.preview.eventSpecId,
      componentId: input.preview.componentId,
      recipeId: input.preview.recipeId,
      editOrigin: input.preview.editOrigin,
      purchaseIngredientId: input.preview.purchaseIngredientId,
      previousAuthority: input.preview.previousAuthority,
      newAuthority: input.preview.proposedAuthority,
      scaleFactor: input.preview.scaleFactor,
      operatorId: input.operatorId,
      confirmedAt: input.confirmedAt,
      recommendationReference: input.preview.recommendationReference,
      staleArtifacts: [...input.preview.staleArtifacts]
    }
  };
}

export function recalculateQuantityLineage(input: RecalculateQuantityLineageInput): QuantityLineageRecalculationResult {
  const quantityInput: QuantityDecisionInput = {
    ...input.confirmedOverride.newAuthority,
    decisionId: input.confirmedOverride.overrideId,
    evidence: { kind: "operator_instruction", reference: input.confirmedOverride.overrideId },
    reviewStatus: "kitchen_review_required",
    rationale: "Bestätigte Nutzer-Mengenänderung; Küchenfreigabe für die neue Eventmenge erforderlich."
  };
  const quantityDecision = evaluateQuantityDecision(quantityInput);
  const bridge = evaluateQuantityRecipeProductionBridge({
    eventSpecId: input.confirmedOverride.eventSpecId,
    componentId: input.confirmedOverride.componentId,
    quantityDecision: quantityInput,
    recipe: input.recipe,
    outputMapping: input.outputMapping
  });

  if (bridge.status !== "ready_for_scaling" || bridge.targetServings === undefined) {
    return { quantityDecision, bridge, staleArtifacts: [...input.confirmedOverride.staleArtifacts] };
  }

  const currentRecipe = scaleRecipe(input.recipe, bridge.targetServings);
  return {
    quantityDecision,
    bridge,
    currentRecipe,
    purchaseQuantities: currentRecipe.ingredients,
    staleArtifacts: [...input.confirmedOverride.staleArtifacts]
  };
}
