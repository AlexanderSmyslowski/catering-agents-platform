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

export type ApproveExperienceRuleCandidateResult =
  | { status: "approved"; rule: ProductionScalingRule }
  | { status: "blocked"; issues: string[] };

export interface ExperienceEvidenceSummary {
  totalMatchingObservations: number;
  confirmingObservations: number;
  contradictingObservations: number;
  outcomeCounts: Record<ProductionObservationOutcome, number>;
  observedMinServings?: number;
  observedMaxServings?: number;
  coversLowerHalf: boolean;
  coversUpperHalf: boolean;
  contextMatchCount: number;
  reviewNeeded: boolean;
  classification: "low" | "medium" | "high";
}

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

export function approveExperienceRuleCandidate(input: {
  candidate: ProductionScalingRule;
  reviewerId: string;
  approvedAt: string;
  minServings?: number;
  maxServings?: number;
  model?: ProductionScalingCorrectionModel;
  rationale?: string;
}): ApproveExperienceRuleCandidateResult {
  const issues: string[] = [];
  if (input.candidate.reviewStatus !== "candidate") issues.push("rule_not_candidate");
  if (!input.reviewerId.trim()) issues.push("reviewer_invalid");
  if (!validDate(input.approvedAt)) issues.push("approval_timestamp_invalid");

  const minServings = input.minServings ?? input.candidate.minServings;
  const maxServings = input.maxServings ?? input.candidate.maxServings;
  if (!positive(minServings) || !positive(maxServings) || minServings > maxServings) issues.push("approved_range_invalid");

  const model = input.model ?? input.candidate.model;
  if (!modelValid(model)) issues.push("approved_model_invalid");
  const rationale = input.rationale?.trim() || input.candidate.rationale.trim();
  if (!rationale) issues.push("approved_rationale_invalid");

  if (issues.length) return { status: "blocked", issues: [...new Set(issues)].sort() };

  return {
    status: "approved",
    rule: {
      ...input.candidate,
      minServings,
      maxServings,
      model,
      rationale,
      reviewStatus: "approved",
      approvedBy: input.reviewerId.trim(),
      approvedAt: input.approvedAt
    }
  };
}

function expectedAmount(rule: ProductionScalingRule, observation: ProductionObservation): number | undefined {
  const baseline = observation.proportionalBaselineAmount;
  if (rule.model.kind === "factor") return baseline * rule.model.factor;
  if (rule.model.kind === "cap") return Math.min(baseline, rule.model.amount);
  if (rule.model.kind === "floor") return Math.max(baseline, rule.model.amount);
  if (rule.model.kind === "anchor" && observation.productionServings === rule.model.servings) return rule.model.amount;
  return undefined;
}

function contextMatches(required: string[] | undefined, actual: string[] | undefined): boolean {
  if (!required?.length) return true;
  const actualSet = new Set(actual ?? []);
  return required.every((entry) => actualSet.has(entry));
}

export function summarizeExperienceEvidence(input: {
  rule: ProductionScalingRule;
  observations: ProductionObservation[];
}): ExperienceEvidenceSummary {
  const matching = input.observations.filter((observation) =>
    observation.recipeId === input.rule.recipeId &&
    observation.ingredientId === input.rule.ingredientId &&
    observation.productionServings >= input.rule.minServings &&
    observation.productionServings <= input.rule.maxServings
  );

  let confirmingObservations = 0;
  let contradictingObservations = 0;
  let contextMatchCount = 0;
  const outcomeCounts: Record<ProductionObservationOutcome, number> = {
    successful: 0,
    mixed: 0,
    unsuccessful: 0,
    not_assessed: 0
  };

  for (const observation of matching) {
    outcomeCounts[observation.outcome] += 1;
    if (contextMatches(input.rule.requiredContext, observation.context)) contextMatchCount += 1;
    const expected = expectedAmount(input.rule, observation);
    if (expected === undefined || !positive(expected)) continue;
    const relativeError = Math.abs(observation.actualAmount - expected) / expected;
    if (relativeError <= 0.05) confirmingObservations += 1;
    else contradictingObservations += 1;
  }

  const servings = matching.map((entry) => entry.productionServings);
  const observedMinServings = servings.length ? Math.min(...servings) : undefined;
  const observedMaxServings = servings.length ? Math.max(...servings) : undefined;
  const midpoint = input.rule.minServings + (input.rule.maxServings - input.rule.minServings) / 2;
  const coversLowerHalf = matching.some((entry) => entry.productionServings <= midpoint);
  const coversUpperHalf = matching.some((entry) => entry.productionServings >= midpoint);
  const reviewNeeded = contradictingObservations > 0;

  let classification: "low" | "medium" | "high" = "low";
  if (!reviewNeeded && confirmingObservations >= 4 && coversLowerHalf && coversUpperHalf) classification = "high";
  else if (!reviewNeeded && confirmingObservations >= 2) classification = "medium";

  return {
    totalMatchingObservations: matching.length,
    confirmingObservations,
    contradictingObservations,
    outcomeCounts,
    observedMinServings,
    observedMaxServings,
    coversLowerHalf,
    coversUpperHalf,
    contextMatchCount,
    reviewNeeded,
    classification
  };
}
