import {
  validateLlmReadinessModelOutputCandidate,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessSourceRef,
  type LlmReadinessStructuredCandidateValue
} from "./llm-readiness.js";
import {
  validateLlmReadinessEvalFixture,
  type LlmReadinessEvalFixture
} from "./fixtures/llm-readiness-eval-fixtures.js";
import { validateLlmReadinessDraftOutputForInput } from "./llm-readiness-draft-output-validation.js";

export interface LlmReadinessEvalOutputMatchValidation {
  valid: boolean;
  errors: string[];
}

export interface LlmReadinessEvalOutputMatchChecks {
  outputKindMatches: boolean;
  humanApprovalMatches: boolean;
  writesProductObjectMatches: boolean;
  sourceRefsMatch: boolean;
  textMatches: boolean;
  structuredCandidateMatches: boolean;
}

export interface LlmReadinessEvalOutputMatchDetails {
  valid: boolean;
  errors: string[];
  checks: LlmReadinessEvalOutputMatchChecks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDraftText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sourceRefKey(sourceRef: Pick<LlmReadinessSourceRef, "objectType" | "objectId">): string {
  return `${sourceRef.objectType}:${sourceRef.objectId}`;
}

function collectSourceRefKeys(sourceRefs: unknown): string[] {
  if (!Array.isArray(sourceRefs)) {
    return [];
  }

  return sourceRefs
    .filter(isRecord)
    .map((sourceRef) => ({
      objectType: sourceRef.objectType,
      objectId: sourceRef.objectId
    }))
    .filter(
      (sourceRef): sourceRef is Pick<LlmReadinessSourceRef, "objectType" | "objectId"> =>
        typeof sourceRef.objectType === "string" && typeof sourceRef.objectId === "string"
    )
    .map(sourceRefKey)
    .sort();
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameStructuredCandidate(
  expected: Record<string, LlmReadinessStructuredCandidateValue> | undefined,
  actual: unknown
): boolean {
  if (expected === undefined && actual === undefined) {
    return true;
  }

  if (!isRecord(actual) || expected === undefined) {
    return false;
  }

  const expectedEntries = Object.entries(expected).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const actualEntries = Object.entries(actual).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return (
    expectedEntries.length === actualEntries.length &&
    expectedEntries.every(([expectedKey, expectedValue], index) => {
      const [actualKey, actualValue] = actualEntries[index] ?? [];
      return expectedKey === actualKey && expectedValue === actualValue;
    })
  );
}

export function validateLlmReadinessEvalOutputCandidateMatch(
  fixture: unknown,
  candidate: unknown
): LlmReadinessEvalOutputMatchValidation {
  const evaluation = evaluateLlmReadinessEvalOutputCandidateMatch(fixture, candidate);
  return {
    valid: evaluation.valid,
    errors: evaluation.errors
  };
}

export function evaluateLlmReadinessEvalOutputCandidateMatch(
  fixture: unknown,
  candidate: unknown
): LlmReadinessEvalOutputMatchDetails {
  const errors: string[] = [];
  const checks: LlmReadinessEvalOutputMatchChecks = {
    outputKindMatches: false,
    humanApprovalMatches: false,
    writesProductObjectMatches: false,
    sourceRefsMatch: false,
    textMatches: false,
    structuredCandidateMatches: false
  };

  const fixtureValidation = validateLlmReadinessEvalFixture(fixture);
  for (const fixtureError of fixtureValidation.errors) {
    errors.push(`fixture.${fixtureError}`);
  }

  const candidateValidation = isRecord(fixture) && isRecord(fixture.input)
    ? validateLlmReadinessDraftOutputForInput(
      candidate,
      fixture.input as unknown as LlmReadinessEvalFixture["input"]
    )
    : validateLlmReadinessModelOutputCandidate(candidate);
  for (const candidateError of candidateValidation.errors) {
    errors.push(`candidate.${candidateError}`);
  }

  if (!isRecord(fixture) || !isRecord(fixture.expectedOutput) || !isRecord(candidate)) {
    return { valid: errors.length === 0, errors, checks };
  }

  const expectedOutput = fixture.expectedOutput as unknown as LlmReadinessModelOutputCandidate;
  const outputCandidate = candidate as unknown as LlmReadinessModelOutputCandidate;

  checks.outputKindMatches = outputCandidate.kind === expectedOutput.kind;
  if (!checks.outputKindMatches) {
    errors.push("candidate.kind must match fixture expectedOutput.kind");
  }

  checks.humanApprovalMatches =
    outputCandidate.humanApprovalRequired === expectedOutput.humanApprovalRequired;
  if (!checks.humanApprovalMatches) {
    errors.push("candidate.humanApprovalRequired must match fixture expectedOutput.humanApprovalRequired");
  }

  checks.writesProductObjectMatches =
    outputCandidate.writesProductObject === expectedOutput.writesProductObject;
  if (!checks.writesProductObjectMatches) {
    errors.push("candidate.writesProductObject must match fixture expectedOutput.writesProductObject");
  }

  checks.sourceRefsMatch =
    Array.isArray(outputCandidate.sourceRefs) &&
    Array.isArray(expectedOutput.sourceRefs) &&
    sameStringList(collectSourceRefKeys(outputCandidate.sourceRefs), collectSourceRefKeys(expectedOutput.sourceRefs));
  if (
    Array.isArray(outputCandidate.sourceRefs) &&
    Array.isArray(expectedOutput.sourceRefs) &&
    !checks.sourceRefsMatch
  ) {
    errors.push("candidate.sourceRefs must match fixture expectedOutput.sourceRefs");
  }

  checks.textMatches =
    typeof outputCandidate.text === "string" &&
    typeof expectedOutput.text === "string" &&
    normalizeDraftText(outputCandidate.text) === normalizeDraftText(expectedOutput.text);
  if (
    typeof outputCandidate.text === "string" &&
    typeof expectedOutput.text === "string" &&
    !checks.textMatches
  ) {
    errors.push("candidate.text must match fixture expectedOutput.text");
  }

  checks.structuredCandidateMatches = sameStructuredCandidate(
    expectedOutput.structuredCandidate,
    outputCandidate.structuredCandidate
  );
  if (!checks.structuredCandidateMatches) {
    errors.push("candidate.structuredCandidate must match fixture expectedOutput.structuredCandidate");
  }

  return { valid: errors.length === 0, errors, checks };
}
