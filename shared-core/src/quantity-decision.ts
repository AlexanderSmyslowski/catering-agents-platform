export type QuantityDecisionBasis =
  | "per_person_weight"
  | "pieces_per_person"
  | "servings_per_person"
  | "fixed_total";

export type QuantityDecisionDishRole =
  | "main"
  | "side"
  | "starter"
  | "dessert"
  | "snack"
  | "fingerfood"
  | "condiment"
  | "beverage_food_component"
  | "other";

export type QuantityDecisionEvidenceKind =
  | "internal_rule"
  | "professional_reference"
  | "operator_instruction"
  | "ai_candidate"
  | "explicit_assumption";

export type QuantityDecisionReviewStatus =
  | "provisional"
  | "kitchen_review_required"
  | "approved"
  | "rejected";

export interface QuantityDecisionEvidence {
  kind: QuantityDecisionEvidenceKind;
  reference?: string;
}

export interface QuantityDecisionInput {
  decisionId: string;
  eventSpecId: string;
  componentId: string;
  guestCount: number;
  serviceFormat: string;
  dishRole: QuantityDecisionDishRole;
  basis: QuantityDecisionBasis;
  perUnitAmount?: number;
  perUnitUnit?: string;
  targetAmount: number;
  targetUnit: string;
  rationale: string;
  evidence: QuantityDecisionEvidence;
  reviewStatus: QuantityDecisionReviewStatus;
}

export type QuantityDecisionIssueCode =
  | "invalid_guest_count"
  | "invalid_per_unit_amount"
  | "missing_per_unit_unit"
  | "unexpected_per_unit_fields"
  | "invalid_target_amount"
  | "target_amount_mismatch"
  | "target_unit_mismatch"
  | "invalid_rationale"
  | "review_status_incompatible_with_evidence"
  | "decision_rejected";

export interface QuantityDecisionIssue {
  code: QuantityDecisionIssueCode;
  message: string;
}

export interface QuantityDecisionResult {
  valid: boolean;
  usableForPlanning: boolean;
  decision: QuantityDecisionInput;
  issues: QuantityDecisionIssue[];
}

const invalidatingIssueCodes = new Set<QuantityDecisionIssueCode>([
  "invalid_guest_count",
  "invalid_per_unit_amount",
  "missing_per_unit_unit",
  "unexpected_per_unit_fields",
  "invalid_target_amount",
  "target_amount_mismatch",
  "target_unit_mismatch",
  "invalid_rationale",
  "review_status_incompatible_with_evidence"
]);

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function normalizeAmount(value: number): number {
  return Number(value.toFixed(6));
}

function issue(code: QuantityDecisionIssueCode, message: string): QuantityDecisionIssue {
  return { code, message };
}

export function evaluateQuantityDecision(input: QuantityDecisionInput): QuantityDecisionResult {
  const issues: QuantityDecisionIssue[] = [];
  const perPersonBasis = input.basis !== "fixed_total";

  if (!Number.isInteger(input.guestCount) || input.guestCount <= 0) {
    issues.push(issue("invalid_guest_count", "guestCount muss eine positive ganze Zahl sein."));
  }

  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    issues.push(issue("invalid_target_amount", "targetAmount muss endlich und positiv sein."));
  }

  if (!input.rationale.trim()) {
    issues.push(issue("invalid_rationale", "rationale darf nicht leer sein."));
  }

  if (perPersonBasis) {
    if (!isPositiveFinite(input.perUnitAmount)) {
      issues.push(issue("invalid_per_unit_amount", "perUnitAmount muss endlich und positiv sein."));
    }

    if (!input.perUnitUnit?.trim()) {
      issues.push(issue("missing_per_unit_unit", "perUnitUnit ist für personenbezogene Mengen erforderlich."));
    }

    const expectedCanonicalUnit =
      input.basis === "pieces_per_person"
        ? "pieces"
        : input.basis === "servings_per_person"
          ? "servings"
          : input.perUnitUnit;

    if (
      !input.targetUnit.trim() ||
      !input.perUnitUnit?.trim() ||
      input.targetUnit !== input.perUnitUnit ||
      (expectedCanonicalUnit !== undefined && input.targetUnit !== expectedCanonicalUnit)
    ) {
      issues.push(issue("target_unit_mismatch", "targetUnit passt nicht zur gewählten Mengenbasis."));
    }

    if (
      isPositiveFinite(input.perUnitAmount) &&
      Number.isInteger(input.guestCount) &&
      input.guestCount > 0 &&
      Number.isFinite(input.targetAmount) &&
      input.targetAmount > 0
    ) {
      const expectedTarget = normalizeAmount(input.perUnitAmount * input.guestCount);
      if (normalizeAmount(input.targetAmount) !== expectedTarget) {
        issues.push(
          issue(
            "target_amount_mismatch",
            `targetAmount ${input.targetAmount} entspricht nicht ${input.perUnitAmount} × ${input.guestCount} = ${expectedTarget}.`
          )
        );
      }
    }
  } else if (input.perUnitAmount !== undefined || input.perUnitUnit !== undefined) {
    issues.push(
      issue(
        "unexpected_per_unit_fields",
        "fixed_total darf keine personenbezogenen Mengenfelder enthalten."
      )
    );
  }

  if (
    input.reviewStatus === "approved" &&
    (input.evidence.kind === "professional_reference" ||
      input.evidence.kind === "ai_candidate" ||
      input.evidence.kind === "explicit_assumption")
  ) {
    issues.push(
      issue(
        "review_status_incompatible_with_evidence",
        `${input.evidence.kind} darf nicht automatisch den Status approved tragen.`
      )
    );
  }

  if (input.reviewStatus === "rejected") {
    issues.push(issue("decision_rejected", "Die Mengenentscheidung wurde verworfen."));
  }

  issues.sort((a, b) => a.code.localeCompare(b.code));

  const valid = !issues.some((entry) => invalidatingIssueCodes.has(entry.code));
  const usableForPlanning = valid && input.reviewStatus !== "rejected";

  return {
    valid,
    usableForPlanning,
    decision: {
      ...input,
      rationale: input.rationale.trim(),
      serviceFormat: input.serviceFormat.trim(),
      targetUnit: input.targetUnit.trim(),
      perUnitUnit: input.perUnitUnit?.trim(),
      targetAmount: Number.isFinite(input.targetAmount) ? normalizeAmount(input.targetAmount) : input.targetAmount,
      perUnitAmount:
        input.perUnitAmount !== undefined && Number.isFinite(input.perUnitAmount)
          ? normalizeAmount(input.perUnitAmount)
          : input.perUnitAmount
    },
    issues
  };
}