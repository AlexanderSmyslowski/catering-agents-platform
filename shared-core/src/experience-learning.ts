import type { ProductionScalingCorrectionModel, ProductionScalingRule } from "./nonlinear-production-scaling.js";

export type ProductionObservationOutcome = "successful" | "mixed" | "unsuccessful" | "not_assessed";

export interface ProductionObservation {
  observationId: string;
  eventSpecId: string;
  componentId: string;
  recipeId: string;
  recipeVersion?: string;
  productionServings: number;
  ingredientId: string;
  proportionalBaselineAmount: number;
  plannedEffectiveAmount: number;
  actualAmount: number;
  unit: string;
  context?: string[];
  rationale: string;
  outcome: ProductionObservationOutcome;
  operatorId?: string;
  observedAt: string;
}

export interface ExperienceRuleCandidateProposal {
  candidateId: string;
  minServings: number;
  maxServings: number;
  model: ProductionScalingCorrectionModel;
  rationale: string;
  requiredContext?: string[];
}

export type ExperienceRuleCandidateResult =
  | { status: "candidate_created"; candidate: ProductionScalingRule }
  | { status: "blocked"; issues: string[] };

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validDate(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function validateObservation(observation: ProductionObservation): string[] {
  const issues: string[] = [];
  if (!observation.observationId.trim()) issues.push("observation_id_invalid");
  if (!observation.recipeId.trim() || !observation.ingredientId.trim()) issues.push("observation_binding_invalid");
  if (!positive(observation.productionServings)) issues.push("observation_servings_invalid");
  if (!positive(observation.proportionalBaselineAmount)) issues.push("observation_baseline_invalid");
  if (!positive(observation.plannedEffectiveAmount)) issues.push("observation_planned_invalid");
  if (!positive(observation.actualAmount)) issues.push("observation_actual_invalid");
  if (!observation.unit.trim()) issues.push("observation_unit_invalid");
  if (!observation.rationale.trim()) issues.push("observation_rationale_invalid");
  if (!validDate(observation.observedAt)) issues.push("observation_timestamp_invalid");
  return issues.sort();
}

function modelValid(model: ProductionScalingCorrectionModel): boolean {
  if (model.kind === "factor") return positive(model.factor);
  if (!positive(model.amount) || !model.unit.trim()) return false;
  return model.kind !== "anchor" || positive(model.servings);
}

export function createExperienceRuleCandidate(
  observation: ProductionObservation,
  proposal: ExperienceRuleCandidateProposal
): ExperienceRuleCandidateResult {
  const issues = validateObservation(observation);
  if (
    !Number.isFinite(proposal.minServings) ||
    !Number.isFinite(proposal.maxServings) ||
    proposal.minServings <= 0 ||
    proposal.maxServings <= 0 ||
    proposal.minServings > proposal.maxServings
  ) {
    issues.push("candidate_range_invalid");
  }
  if (!proposal.candidateId.trim()) issues.push("candidate_id_invalid");
  if (!proposal.rationale.trim()) issues.push("candidate_rationale_invalid");
  if (!modelValid(proposal.model)) issues.push("candidate_model_invalid");

  if (proposal.model.kind !== "factor" && proposal.model.unit !== observation.unit) {
    issues.push("candidate_unit_mismatch");
  }

  if (issues.length) return { status: "blocked", issues: [...new Set(issues)].sort() };

  const candidate: ProductionScalingRule = {
    ruleId: proposal.candidateId,
    recipeId: observation.recipeId,
    ingredientId: observation.ingredientId,
    minServings: proposal.minServings,
    maxServings: proposal.maxServings,
    requiredContext: proposal.requiredContext,
    model: proposal.model,
    rationale: proposal.rationale.trim(),
    supportingObservationIds: [observation.observationId],
    reviewStatus: "candidate"
  };

  return { status: "candidate_created", candidate };
}
