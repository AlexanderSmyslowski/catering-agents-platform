import type {
  QuantityDecisionBasis,
  QuantityDecisionDishRole,
  QuantityDecisionEvidenceKind,
  QuantityDecisionInput
} from "./quantity-decision.js";

export type QuantityRecommendationStatus =
  | "recommended"
  | "evidence_insufficient"
  | "conflicting_evidence"
  | "invalid_input";

export type QuantityRecommendationEvidenceSourceKind =
  | "professional_reference"
  | "internal_rule"
  | "operator_instruction";

export type QuantityRecommendationAdjustmentKind =
  | "menu_competition"
  | "service_format"
  | "explicit_portion_instruction"
  | "dish_role"
  | "operator_adjustment";

export interface QuantityRecommendationEvidence {
  evidenceId: string;
  sourceKind: QuantityRecommendationEvidenceSourceKind;
  reference: string;
  dishRole: QuantityDecisionDishRole;
  serviceFormats?: string[];
  basis: QuantityDecisionBasis;
  unit: string;
  minAmount: number;
  preferredAmount: number;
  maxAmount: number;
  rationale: string;
}

export interface QuantityRecommendationAdjustment {
  factorId: string;
  factorKind: QuantityRecommendationAdjustmentKind;
  reason: string;
  multiplier: number;
}

export interface QuantityRecommendationInput {
  decisionId: string;
  eventSpecId: string;
  componentId: string;
  guestCount: number;
  serviceFormat: string;
  dishRole: QuantityDecisionDishRole;
  basis: QuantityDecisionBasis;
  evidence: QuantityRecommendationEvidence[];
  adjustments?: QuantityRecommendationAdjustment[];
}

export type QuantityRecommendationIssueCode =
  | "invalid_identifier"
  | "invalid_service_format"
  | "invalid_guest_count"
  | "invalid_evidence"
  | "invalid_adjustment"
  | "incompatible_units"
  | "evidence_insufficient"
  | "conflicting_evidence";

export interface QuantityRecommendationIssue {
  code: QuantityRecommendationIssueCode;
  message: string;
}

export interface QuantityRecommendationRange {
  min: number;
  max: number;
  unit: string;
}

export interface QuantityRecommendationAdjustmentTraceEntry {
  factorId: string;
  factorKind: QuantityRecommendationAdjustmentKind;
  reason: string;
  multiplier: number;
  beforeAmount: number;
  afterAmount: number;
}

export interface QuantityRecommendationResult {
  status: QuantityRecommendationStatus;
  recommendedAmount?: number;
  unit?: string;
  professionalRange?: QuantityRecommendationRange;
  evidenceReferences: string[];
  adjustmentTrace: QuantityRecommendationAdjustmentTraceEntry[];
  rationale?: string;
  decisionCandidate?: QuantityDecisionInput;
  issues: QuantityRecommendationIssue[];
}

const allowedAdjustmentKinds = new Set<QuantityRecommendationAdjustmentKind>([
  "menu_competition",
  "service_format",
  "explicit_portion_instruction",
  "dish_role",
  "operator_adjustment"
]);

function normalizedNumber(value: number): number {
  return Number(value.toFixed(6));
}

function nonBlank(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function issue(code: QuantityRecommendationIssueCode, message: string): QuantityRecommendationIssue {
  return { code, message };
}

function finalize(
  result: Omit<QuantityRecommendationResult, "issues"> & { issues: QuantityRecommendationIssue[] }
): QuantityRecommendationResult {
  return {
    ...result,
    evidenceReferences: [...result.evidenceReferences].sort((a, b) => a.localeCompare(b)),
    adjustmentTrace: [...result.adjustmentTrace].sort((a, b) => a.factorId.localeCompare(b.factorId)),
    issues: [...result.issues].sort((a, b) => a.code.localeCompare(b.code))
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return normalizedNumber((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function evidenceIsStructurallyValid(entry: QuantityRecommendationEvidence): boolean {
  return (
    nonBlank(entry.evidenceId) &&
    nonBlank(entry.reference) &&
    nonBlank(entry.unit) &&
    nonBlank(entry.rationale) &&
    positiveFinite(entry.minAmount) &&
    positiveFinite(entry.preferredAmount) &&
    positiveFinite(entry.maxAmount) &&
    entry.minAmount <= entry.preferredAmount &&
    entry.preferredAmount <= entry.maxAmount &&
    (entry.serviceFormats === undefined || entry.serviceFormats.every((format) => nonBlank(format)))
  );
}

function canonicalUnitValid(basis: QuantityDecisionBasis, unit: string): boolean {
  if (basis === "pieces_per_person") return unit === "pieces";
  if (basis === "servings_per_person") return unit === "servings";
  return nonBlank(unit);
}

function candidateEvidenceKind(rows: QuantityRecommendationEvidence[]): QuantityDecisionEvidenceKind {
  if (rows.every((row) => row.sourceKind === "operator_instruction")) return "operator_instruction";
  if (rows.every((row) => row.sourceKind === "internal_rule")) return "internal_rule";
  return "professional_reference";
}

export function recommendQuantity(input: QuantityRecommendationInput): QuantityRecommendationResult {
  const issues: QuantityRecommendationIssue[] = [];

  if (!nonBlank(input.decisionId) || !nonBlank(input.eventSpecId) || !nonBlank(input.componentId)) {
    issues.push(issue("invalid_identifier", "decisionId, eventSpecId und componentId müssen gesetzt sein."));
  }
  if (!nonBlank(input.serviceFormat)) {
    issues.push(issue("invalid_service_format", "serviceFormat muss gesetzt sein."));
  }
  if (input.basis !== "fixed_total" && (!Number.isInteger(input.guestCount) || input.guestCount <= 0)) {
    issues.push(issue("invalid_guest_count", "guestCount muss für personenbezogene Empfehlungen positiv und ganzzahlig sein."));
  }

  const malformedEvidence = input.evidence.filter((entry) => !evidenceIsStructurallyValid(entry));
  if (malformedEvidence.length > 0) {
    issues.push(issue("invalid_evidence", "Mindestens ein Evidenzeintrag ist unvollständig oder mathematisch ungültig."));
  }

  const adjustments = [...(input.adjustments ?? [])].sort((a, b) => a.factorId.localeCompare(b.factorId));
  if (
    adjustments.some(
      (entry) =>
        !nonBlank(entry.factorId) ||
        !nonBlank(entry.reason) ||
        !positiveFinite(entry.multiplier) ||
        !allowedAdjustmentKinds.has(entry.factorKind)
    )
  ) {
    issues.push(issue("invalid_adjustment", "Alle Anpassungen benötigen gültige ID, Begründung, Art und positiven Multiplikator."));
  }

  if (issues.length > 0) {
    return finalize({
      status: "invalid_input",
      evidenceReferences: [],
      adjustmentTrace: [],
      issues
    });
  }

  const serviceFormat = input.serviceFormat.trim();
  const compatible = input.evidence.filter((entry) => {
    const serviceMatches =
      entry.serviceFormats === undefined ||
      entry.serviceFormats.some((format) => format.trim() === serviceFormat);
    return entry.basis === input.basis && entry.dishRole === input.dishRole && serviceMatches;
  });

  if (compatible.length === 0) {
    return finalize({
      status: "evidence_insufficient",
      evidenceReferences: [],
      adjustmentTrace: [],
      issues: [issue("evidence_insufficient", "Keine kompatible professionelle Mengen-Evidenz vorhanden.")]
    });
  }

  const units = [...new Set(compatible.map((entry) => entry.unit.trim()))].sort((a, b) => a.localeCompare(b));
  if (units.length !== 1 || !canonicalUnitValid(input.basis, units[0]!)) {
    return finalize({
      status: "conflicting_evidence",
      evidenceReferences: compatible.map((entry) => entry.reference.trim()),
      adjustmentTrace: [],
      issues: [issue("incompatible_units", "Kompatible Evidenz verwendet keine eindeutige, zur Mengenbasis passende Einheit.")]
    });
  }

  const unit = units[0]!;
  const minAmount = Math.max(...compatible.map((entry) => entry.minAmount));
  const maxAmount = Math.min(...compatible.map((entry) => entry.maxAmount));

  if (minAmount > maxAmount) {
    return finalize({
      status: "conflicting_evidence",
      evidenceReferences: compatible.map((entry) => entry.reference.trim()),
      adjustmentTrace: [],
      issues: [issue("conflicting_evidence", "Die kompatiblen professionellen Mengenkorridore überschneiden sich nicht.")]
    });
  }

  let recommendedAmount = clamp(median(compatible.map((entry) => entry.preferredAmount)), minAmount, maxAmount);
  const adjustmentTrace: QuantityRecommendationAdjustmentTraceEntry[] = [];

  for (const adjustment of adjustments) {
    const beforeAmount = normalizedNumber(recommendedAmount);
    recommendedAmount = normalizedNumber(clamp(beforeAmount * adjustment.multiplier, minAmount, maxAmount));
    adjustmentTrace.push({
      factorId: adjustment.factorId.trim(),
      factorKind: adjustment.factorKind,
      reason: adjustment.reason.trim(),
      multiplier: adjustment.multiplier,
      beforeAmount,
      afterAmount: recommendedAmount
    });
  }

  recommendedAmount = normalizedNumber(recommendedAmount);
  const evidenceReferences = compatible.map((entry) => entry.reference.trim());
  const rationale = compatible
    .slice()
    .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))
    .map((entry) => `${entry.reference.trim()}: ${entry.rationale.trim()}`)
    .join(" | ");
  const evidenceKind = candidateEvidenceKind(compatible);

  const commonDecision = {
    decisionId: input.decisionId.trim(),
    eventSpecId: input.eventSpecId.trim(),
    componentId: input.componentId.trim(),
    guestCount: input.guestCount,
    serviceFormat,
    dishRole: input.dishRole,
    basis: input.basis,
    targetUnit: unit,
    rationale,
    evidence: {
      kind: evidenceKind,
      reference: evidenceReferences.slice().sort((a, b) => a.localeCompare(b)).join(" | ")
    },
    reviewStatus: "kitchen_review_required" as const
  };

  const decisionCandidate: QuantityDecisionInput =
    input.basis === "fixed_total"
      ? {
          ...commonDecision,
          targetAmount: recommendedAmount
        }
      : {
          ...commonDecision,
          perUnitAmount: recommendedAmount,
          perUnitUnit: unit,
          targetAmount: normalizedNumber(recommendedAmount * input.guestCount)
        };

  return finalize({
    status: "recommended",
    recommendedAmount,
    unit,
    professionalRange: {
      min: normalizedNumber(minAmount),
      max: normalizedNumber(maxAmount),
      unit
    },
    evidenceReferences,
    adjustmentTrace,
    rationale,
    decisionCandidate,
    issues: []
  });
}
